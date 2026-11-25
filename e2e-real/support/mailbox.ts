/**
 * Coletor de e-mail local do stack (spec 004, quickstart.md secao 7). Tenta a API do Mailpit e, se nao existir, a do Inbucket.
 * `waitForLink(email, contains)` espera ate 15 s e devolve a primeira URL do corpo que contem `contains`.
 */
const MAIL_URL = () => process.env['E2E_MAIL_URL'] ?? 'http://127.0.0.1:54324';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decode(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#x3D;|&#61;/gi, '=')
    .replace(/&#x2F;|&#47;/gi, '/')
    .replace(/&quot;/g, '"');
}

function extractUrls(body: string): string[] {
  return [...decode(body).matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
}

async function mailpitBodies(email: string): Promise<string[] | null> {
  const res = await fetch(`${MAIL_URL()}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { messages?: { ID: string }[] };
  const out: string[] = [];
  for (const m of data.messages ?? []) {
    const r = await fetch(`${MAIL_URL()}/api/v1/message/${m.ID}`);
    if (!r.ok) continue;
    const msg = (await r.json()) as { HTML?: string; Text?: string };
    out.push(`${msg.HTML ?? ''}\n${msg.Text ?? ''}`);
  }
  return out;
}

async function inbucketBodies(email: string): Promise<string[] | null> {
  const local = email.split('@')[0];
  const res = await fetch(`${MAIL_URL()}/api/v1/mailbox/${encodeURIComponent(local)}`).catch(() => null);
  if (!res || !res.ok) return null;
  const list = (await res.json()) as { id: string }[];
  const out: string[] = [];
  for (const m of list) {
    const r = await fetch(`${MAIL_URL()}/api/v1/mailbox/${encodeURIComponent(local)}/${m.id}`);
    if (!r.ok) continue;
    const msg = (await r.json()) as { body?: { html?: string; text?: string } };
    out.push(`${msg.body?.html ?? ''}\n${msg.body?.text ?? ''}`);
  }
  return out;
}

/** Todos os corpos de e-mail recebidos por `email` agora. */
export async function bodiesFor(email: string): Promise<string[]> {
  return (await mailpitBodies(email)) ?? (await inbucketBodies(email)) ?? [];
}

export async function waitForLink(
  email: string,
  contains: string,
  timeoutMs = 15_000,
  exclude: string[] = [],
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const body of await bodiesFor(email)) {
      const hit = extractUrls(body).find((u) => u.includes(contains) && !exclude.includes(u));
      if (hit) return hit;
    }
    await sleep(500);
  }
  throw new Error(`nenhum e-mail com link contendo "${contains}" chegou para o destinatario em ${timeoutMs} ms`);
}

/** Quantos e-mails o destinatario tem agora. */
export async function countFor(email: string): Promise<number> {
  return (await bodiesFor(email)).length;
}
