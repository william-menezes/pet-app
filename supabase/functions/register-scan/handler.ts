/**
 * Orquestracao da Edge Function `register-scan` (spec 003, T051; contracts/public-page.contract.md, research.md
 * secoes 6 e 7). Separada do `Deno.serve` para ser testavel com falsos.
 *
 * Chamada so pelo servidor SSR do app (e pelo pg_cron, no modo `resend`), com a chave `x-faro-ssr-key`. Sem a chave: 401
 * de corpo vazio. Tres acoes (campo `action`, padrao `scan`):
 *   scan      {code, ip_hash, geo?:{lat,lng,city,region}, user_jwt?}
 *             -> {"owner":true} | {"owner":false,"scan_token"?:"..."}. Sempre 200; qualquer falha: {"owner":false}.
 *   location  {scan_token, lat, lng, accuracy_m}  -> {"updated":bool}. Token invalido ou vencido: 200 sem efeito.
 *   resend    {}                                  -> {"sent":n,"failed":m}. Reenvia avisos pendentes (ate 3 tentativas, 24 h).
 *
 * Regras (o banco decide; esta funcao orquestra):
 *   - dono logado (JWT validado = tutor do vinculo ativo): nada e gravado e nenhum aviso sai;
 *   - deduplicacao de 10 minutos e token de localizacao de uso unico: em `register_scan` e `set_scan_location`;
 *   - o IP chega so como `ip_hash` (HMAC feito no servidor SSR); aqui nunca existe IP em claro;
 *   - o aviso por e-mail sai FORA do caminho da resposta (`defer`); sem provedor ou com falha de envio, o scan fica gravado
 *     com `notified_at` nulo e aparece no historico do mesmo jeito (o job de reenvio tenta de novo);
 *   - tag disponivel, bloqueada ou anulada: o scan e gravado para a fila do admin, sem e-mail (decidido na RPC).
 *
 * Nada de PIN, chave, token, IP, e-mail ou telefone em log: esta funcao nao escreve log.
 */
import { requireSsrKey } from "../_shared/auth.ts";
import type { EmailSender } from "../_shared/email.ts";
import { locationNoticeEmail, type NoticeInfo, scanNoticeEmail } from "../_shared/email-templates.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/responses.ts";

/** Corpo maximo aceito. */
export const SCAN_MAX_BODY = 4096;
/** Teto global de chamadas por minuto (`scan_global_min`). */
export const SCAN_GLOBAL_LIMIT = 600;
/** Limites por ip_hash (security-hardening.contract.md secao 3). */
export const SCAN_IP_MIN_LIMIT = 20;
export const SCAN_IP_HOUR_LIMIT = 200;
/** Reenvios por rodada do job. */
export const RESEND_BATCH = 50;

export interface RegisterDeps {
  keys(): readonly string[];
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  /** Valida o JWT e devolve o id do usuario, ou null (anonimo, vencido, invalido). Pode lancar. */
  getViewer(jwt: string): Promise<string | null>;
  /** Porta de e-mail; null quando nao ha provedor (TODO(EMAIL_PROVIDER)) ou o driver nao vale neste ambiente. */
  sender(): EmailSender | null;
  siteUrl: string;
  /** Roda a promessa fora do caminho da resposta (`EdgeRuntime.waitUntil`); a promessa nunca rejeita. */
  defer(p: Promise<unknown>): void;
  /** Teto global (`scan_global_min`): true quando estourou. Falha ou ausencia: segue. */
  globalLimit?(scope: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Contador por chave (`rate_limit_hit`): true quando estourou. Falha ou ausencia: segue. */
  rateHit?(scope: string, key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** `notify` da RPC -> NoticeInfo (so os campos do formato esperado), ou null. */
function noticeFrom(v: unknown): (NoticeInfo & { scan_id: string }) | null {
  if (!isRec(v)) return null;
  const to = str(v.to, 320);
  const pet = str(v.pet_name, 200);
  const scanId = str(v.scan_id, 64);
  const at = str(v.occurred_at, 64);
  if (to === null || pet === null || scanId === null || at === null) return null;
  const info: NoticeInfo & { scan_id: string } = { scan_id: scanId, to, pet_name: pet, occurred_at: at };
  const first = str(v.tutor_first_name, 80);
  if (first !== null) info.tutor_first_name = first;
  const method = str(v.geo_method, 8);
  if (method !== null) info.geo_method = method;
  const city = str(v.city, 80);
  if (city !== null) info.city = city;
  const region = str(v.region, 80);
  if (region !== null) info.region = region;
  return info;
}

/** Tentativas de gravar notified_at depois de o e-mail ter saido. */
export const MARK_ATTEMPTS = 3;

/**
 * Marca o aviso como enviado, conferindo o resultado: o e-mail JA saiu, e se a marcacao falhar em silencio o job de
 * reenvio manda o mesmo e-mail de novo. Repete algumas vezes (erro devolvido ou excecao); nunca rejeita.
 * O reenvio ainda e limitado pelo banco (3 tentativas por scan, so ate 24 h, reserva por scan_notices_pending).
 */
async function markNoticeSent(deps: RegisterDeps, scanId: string): Promise<boolean> {
  for (let i = 0; i < MARK_ATTEMPTS; i++) {
    try {
      const r = await deps.rpc("scan_notice_sent", { p_scan_id: scanId });
      if (!r.error && isRec(r.data) && r.data.ok === true) return true;
    } catch {
      // tenta de novo
    }
  }
  return false;
}

/** Envia o aviso e, no de scan, marca `notified_at`. Nunca rejeita. Devolve se o e-mail saiu. */
async function sendNotice(
  deps: RegisterDeps,
  sender: EmailSender,
  info: NoticeInfo & { scan_id: string },
  kind: "scan" | "location",
): Promise<boolean> {
  try {
    const content = kind === "scan" ? scanNoticeEmail(info, deps.siteUrl) : locationNoticeEmail(info, deps.siteUrl);
    const r = await sender.send({ to: info.to, ...content });
    if (!r.ok) return false;
    if (kind === "scan") await markNoticeSent(deps, info.scan_id);
    return true;
  } catch {
    return false;
  }
}

async function safeHit(fn: Promise<boolean> | undefined): Promise<boolean> {
  if (fn === undefined) return false;
  try {
    return (await fn) === true;
  } catch {
    return false;
  }
}

async function overIpLimit(deps: RegisterDeps, ipHash: string): Promise<boolean> {
  if (!deps.rateHit) return false;
  if (await safeHit(deps.rateHit("scan_ip_min", ipHash, SCAN_IP_MIN_LIMIT, 60))) return true;
  return await safeHit(deps.rateHit("scan_ip_hour", ipHash, SCAN_IP_HOUR_LIMIT, 3600));
}

async function doScan(body: Rec, deps: RegisterDeps): Promise<Rec> {
  const code = str(body.code, 64);
  const ipHash = str(body.ip_hash, 128);
  if (code === null || ipHash === null) return { owner: false };
  // Limites por origem: estouro devolve 200 sem efeito (nao consulta o dono, nao grava scan, nao envia e-mail).
  if (await overIpLimit(deps, ipHash)) return { owner: false };

  let viewer: string | null = null;
  const jwt = str(body.user_jwt, 4096);
  if (jwt !== null) {
    try {
      viewer = await deps.getViewer(jwt);
    } catch {
      viewer = null;
    }
  }

  const geo = isRec(body.geo) ? body.geo : {};
  const lat = num(geo.lat);
  const lng = num(geo.lng);

  let res: { data: unknown; error: unknown };
  try {
    res = await deps.rpc("register_scan", {
      p_code: code,
      p_ip_hash: ipHash,
      p_viewer: viewer,
      p_geo_lat: lat !== null && lng !== null ? lat : null,
      p_geo_lng: lat !== null && lng !== null ? lng : null,
      p_geo_city: str(geo.city, 200),
      p_geo_region: str(geo.region, 200),
    });
  } catch {
    return { owner: false };
  }
  if (res.error || !isRec(res.data) || res.data.ok !== true) return { owner: false };

  if (res.data.owner === true) return { owner: true };

  const out: Rec = { owner: false };
  const token = str(res.data.scan_token, 128);
  if (token !== null) out.scan_token = token;

  const info = res.data.recorded === true ? noticeFrom(res.data.notify) : null;
  if (info !== null) {
    const sender = deps.sender();
    if (sender !== null) deps.defer(sendNotice(deps, sender, info, "scan"));
  }
  return out;
}

async function doLocation(body: Rec, deps: RegisterDeps): Promise<Rec> {
  const token = str(body.scan_token, 128);
  const lat = num(body.lat);
  const lng = num(body.lng);
  const acc = num(body.accuracy_m);
  if (token === null || lat === null || lng === null || acc === null) return { updated: false };

  let res: { data: unknown; error: unknown };
  try {
    res = await deps.rpc("set_scan_location", {
      p_token: token,
      p_lat: lat,
      p_lng: lng,
      p_accuracy_m: Math.round(acc),
    });
  } catch {
    return { updated: false };
  }
  if (res.error || !isRec(res.data) || res.data.updated !== true) return { updated: false };

  const info = noticeFrom(res.data.notify);
  if (info !== null) {
    const sender = deps.sender();
    if (sender !== null) deps.defer(sendNotice(deps, sender, info, "location"));
  }
  return { updated: true };
}

async function doResend(deps: RegisterDeps): Promise<Rec> {
  // Sem provedor: nem reserva os scans (a reserva soma tentativa). Quando o provedor for ativado, o backlog das 24 h sai.
  const sender = deps.sender();
  if (sender === null) return { sent: 0, failed: 0, skipped: true };

  let res: { data: unknown; error: unknown };
  try {
    res = await deps.rpc("scan_notices_pending", { p_limit: RESEND_BATCH });
  } catch {
    return { sent: 0, failed: 0 };
  }
  if (res.error || !isRec(res.data) || !Array.isArray(res.data.items)) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const item of res.data.items) {
    const info = noticeFrom(item);
    if (info === null) continue;
    if (await sendNotice(deps, sender, info, "scan")) sent++;
    else failed++;
  }
  return { sent, failed };
}

export function createRegisterHandler(deps: RegisterDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const denied = await requireSsrKey(req, () => deps.keys());
    if (denied) return denied;
    if (req.method !== "POST") return methodNotAllowed();

    let body: unknown;
    try {
      const text = await req.text();
      if (text.length > SCAN_MAX_BODY) return jsonResponse({ owner: false });
      body = JSON.parse(text);
    } catch {
      return jsonResponse({ owner: false });
    }
    if (!isRec(body)) return jsonResponse({ owner: false });

    const action = body.action === undefined ? "scan" : body.action;
    // Teto global: conta toda chamada autorizada; no estouro, 200 sem efeito no formato da acao.
    if (deps.globalLimit && await safeHit(deps.globalLimit("scan_global_min", SCAN_GLOBAL_LIMIT, 60))) {
      return jsonResponse(action === "location" ? { updated: false } : action === "resend" ? { sent: 0, failed: 0 } : { owner: false });
    }
    try {
      switch (action) {
        case "scan":
          return jsonResponse(await doScan(body, deps));
        case "location":
          return jsonResponse(await doLocation(body, deps));
        case "resend":
          return jsonResponse(await doResend(deps));
        default:
          return jsonResponse({ ok: false, error: "unknown_action" });
      }
    } catch {
      return jsonResponse(action === "location" ? { updated: false } : { owner: false });
    }
  };
}
