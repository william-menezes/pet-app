import { assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { escapeHtml, formatWhen, historyUrl, locationNoticeEmail, type NoticeInfo, scanNoticeEmail } from "./email-templates.ts";

const SITE = "https://app.faro.test/";
const INFO: NoticeInfo = {
  to: "ana@faro.test",
  pet_name: "Paçoca",
  tutor_first_name: "Ana",
  occurred_at: "2026-11-22T17:05:00Z", // 14:05 em Brasilia
  geo_method: "ip",
  city: "São Paulo",
  region: "SP",
};

// Snapshots: constantes aqui no teste (o `deno test` roda sem permissoes, sem ler arquivo). Mudar o texto de um e-mail
// exige mudar o snapshot de proposito.
const SCAN_TEXT = [
  "Olá, Ana.",
  "Alguém escaneou a tag do Paçoca em 22/11/2026 às 14:05.",
  "Localização aproximada: São Paulo, SP. Ela vem da rede de quem escaneou e pode errar alguns quilômetros.",
  "Veja o histórico no Faro: https://app.faro.test/app/scans",
  "Você recebe este aviso sempre que a tag é lida. Ele é gratuito.",
].join("\n\n");

const SCAN_HTML = '<div style="font-family:Inter,Arial,sans-serif;color:#13201E;max-width:480px;margin:0 auto;padding:24px">' +
  "<p>Olá, Ana.</p>" +
  "<p>Alguém escaneou a tag do <strong>Paçoca</strong> em 22/11/2026 às 14:05.</p>" +
  "<p>Localização aproximada: São Paulo, SP. Ela vem da rede de quem escaneou e pode errar alguns quilômetros.</p>" +
  '<p><a href="https://app.faro.test/app/scans" style="color:#25337A">Ver o histórico no Faro</a></p>' +
  '<p style="color:#5b6761;font-size:13px">Você recebe este aviso sempre que a tag é lida. Ele é gratuito.</p>' +
  "</div>";

const LOCATION_TEXT = [
  "Olá, Ana.",
  "Quem encontrou a tag do Paçoca enviou a localização precisa do aparelho dela.",
  "Veja no mapa do histórico: https://app.faro.test/app/scans",
  "Você recebe este aviso sempre que a tag é lida ou alguém envia a localização. Ele é gratuito.",
].join("\n\n");

const LOCATION_HTML = '<div style="font-family:Inter,Arial,sans-serif;color:#13201E;max-width:480px;margin:0 auto;padding:24px">' +
  "<p>Olá, Ana.</p>" +
  "<p>Quem encontrou a tag do <strong>Paçoca</strong> enviou a localização precisa do aparelho dela.</p>" +
  '<p><a href="https://app.faro.test/app/scans" style="color:#25337A">Ver no mapa do histórico</a></p>' +
  '<p style="color:#5b6761;font-size:13px">Você recebe este aviso sempre que a tag é lida ou alguém envia a localização. Ele é gratuito.</p>' +
  "</div>";

Deno.test("snapshot: e-mail de tag escaneada (assunto, texto e HTML)", () => {
  const e = scanNoticeEmail(INFO, SITE);
  assertEquals(e.subject, "A tag do Paçoca foi escaneada");
  assertEquals(e.text, SCAN_TEXT);
  assertEquals(e.html, SCAN_HTML);
});

Deno.test("snapshot: e-mail de localizacao enviada (assunto, texto e HTML)", () => {
  const e = locationNoticeEmail(INFO, SITE);
  assertEquals(e.subject, "Quem achou o Paçoca enviou a localização");
  assertEquals(e.text, LOCATION_TEXT);
  assertEquals(e.html, LOCATION_HTML);
});

Deno.test("tag escaneada sem localizacao: avisa que nao foi possivel estimar", () => {
  const e = scanNoticeEmail({ ...INFO, city: undefined, region: undefined, geo_method: "none" }, SITE);
  assertEquals(e.text.includes("Não conseguimos estimar a localização desta leitura."), true);
  assertFalse(e.text.includes("Localização aproximada"));
});

Deno.test("tag escaneada: so a cidade, ou so a regiao, tambem entram", () => {
  assertEquals(scanNoticeEmail({ ...INFO, region: undefined }, SITE).text.includes("Localização aproximada: São Paulo."), true);
  assertEquals(scanNoticeEmail({ ...INFO, city: undefined }, SITE).text.includes("Localização aproximada: SP."), true);
});

Deno.test("sem primeiro nome: saudacao generica", () => {
  assertEquals(scanNoticeEmail({ ...INFO, tutor_first_name: undefined }, SITE).text.startsWith("Olá.\n\n"), true);
});

Deno.test("os modelos nao carregam dado de quem escaneou: so o que NoticeInfo permite", () => {
  const dirty = { ...INFO, ip_hash: "hash-secreto", ip: "203.0.113.9", lat: -23.123456, lng: -46.654321 } as unknown as NoticeInfo;
  for (const e of [scanNoticeEmail(dirty, SITE), locationNoticeEmail(dirty, SITE)]) {
    const all = `${e.subject}\n${e.html}\n${e.text}`;
    for (const forbidden of ["hash-secreto", "203.0.113.9", "-23.123456", "-46.654321", "ana@faro.test"]) assertFalse(all.includes(forbidden));
  }
});

Deno.test("HTML: o nome do pet e a cidade sao escapados", () => {
  const e = scanNoticeEmail({ ...INFO, pet_name: '<script>alert("x")</script>', city: "A&B" }, SITE);
  assertFalse(e.html.includes("<script>"));
  assertEquals(e.html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"), true);
  assertEquals(e.html.includes("A&amp;B"), true);
});

Deno.test("escapeHtml, historyUrl e formatWhen", () => {
  assertEquals(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  assertEquals(historyUrl("https://x.test///"), "https://x.test/app/scans");
  assertEquals(formatWhen("2026-11-22T17:05:00Z"), "22/11/2026 às 14:05");
  assertEquals(formatWhen("2026-11-22T02:30:00Z"), "21/11/2026 às 23:30"); // horario de Brasilia (UTC-3)
  assertEquals(formatWhen("nao-e-data"), "agora há pouco");
});
