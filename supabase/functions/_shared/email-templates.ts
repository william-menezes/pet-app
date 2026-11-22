/**
 * Modelos dos e-mails ao tutor (spec 003, T052). Dois modelos, em PT-BR:
 *  - "tag escaneada": alguem leu o QR da tag;
 *  - "localizacao enviada": quem achou enviou a localizacao precisa.
 *
 * Privacidade: nada de quem escaneou (nem IP, nem hash, nem aparelho) e nenhuma coordenada no e-mail: so a cidade e a
 * regiao APROXIMADAS (quando o scan as trouxe) e o link para o historico no app. O aviso e gratuito para sempre.
 * Modulo puro (sem rede, sem env): o teste de snapshot roda sem permissoes.
 */
import type { EmailMessage } from "./email.ts";

/** O que `register_scan`/`set_scan_location` devolvem em `notify` (so o necessario para o aviso). */
export interface NoticeInfo {
  to: string;
  pet_name: string;
  tutor_first_name?: string;
  occurred_at: string;
  geo_method?: string;
  city?: string;
  region?: string;
}

export type EmailContent = Pick<EmailMessage, "subject" | "html" | "text">;

/** Escapa o texto que entra em HTML (nome do pet e cidade sao digitados por pessoas ou vem de cabecalho). */
export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** "22/11/2026 às 14:05", no horario de Brasilia. Entrada invalida: "agora há pouco". */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "agora há pouco";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

function greeting(info: NoticeInfo): string {
  return info.tutor_first_name ? `Olá, ${info.tutor_first_name}.` : "Olá.";
}

function place(info: NoticeInfo): string {
  if (info.city && info.region) return `${info.city}, ${info.region}`;
  return info.city ?? info.region ?? "";
}

function layout(innerHtml: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#13201E;max-width:480px;margin:0 auto;padding:24px">${innerHtml}</div>`;
}

/** Link do histórico de scans no app (`/app/scans`), sobre SITE_URL. */
export function historyUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/app/scans`;
}

/** "Tag escaneada". */
export function scanNoticeEmail(info: NoticeInfo, siteUrl: string): EmailContent {
  const when = formatWhen(info.occurred_at);
  const where = place(info);
  const url = historyUrl(siteUrl);
  const whereText = where
    ? `Localização aproximada: ${where}. Ela vem da rede de quem escaneou e pode errar alguns quilômetros.`
    : "Não conseguimos estimar a localização desta leitura.";
  const text = [
    greeting(info),
    `Alguém escaneou a tag do ${info.pet_name} em ${when}.`,
    whereText,
    `Veja o histórico no Faro: ${url}`,
    "Você recebe este aviso sempre que a tag é lida. Ele é gratuito.",
  ].join("\n\n");
  const html = layout(
    `<p>${escapeHtml(greeting(info))}</p>` +
      `<p>Alguém escaneou a tag do <strong>${escapeHtml(info.pet_name)}</strong> em ${escapeHtml(when)}.</p>` +
      `<p>${escapeHtml(whereText)}</p>` +
      `<p><a href="${escapeHtml(url)}" style="color:#25337A">Ver o histórico no Faro</a></p>` +
      `<p style="color:#5b6761;font-size:13px">Você recebe este aviso sempre que a tag é lida. Ele é gratuito.</p>`,
  );
  return { subject: `A tag do ${info.pet_name} foi escaneada`, html, text };
}

/** "Localização enviada". */
export function locationNoticeEmail(info: NoticeInfo, siteUrl: string): EmailContent {
  const url = historyUrl(siteUrl);
  const text = [
    greeting(info),
    `Quem encontrou a tag do ${info.pet_name} enviou a localização precisa do aparelho dela.`,
    `Veja no mapa do histórico: ${url}`,
    "Você recebe este aviso sempre que a tag é lida ou alguém envia a localização. Ele é gratuito.",
  ].join("\n\n");
  const html = layout(
    `<p>${escapeHtml(greeting(info))}</p>` +
      `<p>Quem encontrou a tag do <strong>${escapeHtml(info.pet_name)}</strong> enviou a localização precisa do aparelho dela.</p>` +
      `<p><a href="${escapeHtml(url)}" style="color:#25337A">Ver no mapa do histórico</a></p>` +
      `<p style="color:#5b6761;font-size:13px">Você recebe este aviso sempre que a tag é lida ou alguém envia a localização. Ele é gratuito.</p>`,
  );
  return { subject: `Quem achou o ${info.pet_name} enviou a localização`, html, text };
}
