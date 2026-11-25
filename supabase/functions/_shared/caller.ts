/**
 * Identidade do chamador de uma Edge Function (logica pura, sem importar o supabase-js: testavel sem rede).
 *
 * Regra: a identidade so vem de um verificador que valida o token no servidor de Auth (`auth.getUser(token)`).
 * Quem decide se vale a pena perguntar e a FORMA do token, nunca a igualdade com uma chave configurada:
 *  - cabecalho ausente ou fora de `Bearer <token>`          => null
 *  - chave publishable (`sb_publishable_...`, nao e JWT)     => null, sem chamar o verificador
 *  - lixo (nao tem tres segmentos base64url)                 => null, sem chamar o verificador
 *  - JWT (inclui a chave anon legada, que e um JWT sem usuario) => o verificador decide; recusa => null
 *  - qualquer excecao do verificador                         => null (chamador anonimo, nunca erro 500)
 */

/** Tres segmentos base64url separados por ponto. */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export async function resolveCaller<U>(
  req: Request,
  verify: (token: string) => Promise<U | null>,
): Promise<U | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match || !JWT_SHAPE.test(match[1])) return null;
  try {
    return await verify(match[1]);
  } catch {
    return null;
  }
}
