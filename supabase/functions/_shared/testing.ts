/**
 * Auxiliares dos testes de handler (so testes importam este arquivo; nada daqui roda em producao).
 * Falsos estruturais: nenhum cliente real, nenhuma rede, nenhuma variavel de ambiente.
 */
import type { FaroEnv } from "./env.ts";

export const TEST_ENV: FaroEnv = {
  supabaseUrl: "http://supabase.test",
  anonKey: "anon-key-de-teste",
  serviceRoleKey: "service-key-de-teste",
  hashSalt: "sal-de-teste-0123456789",
  otpPepper: "pepper-de-teste-0123456789-0123456789",
  faroEnv: "test",
  smsDriver: "",
  smsStubCode: null,
  smsDailyCap: 500,
  siteUrl: "http://localhost:4200",
};

export interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

export type LimitMode = "allow" | "deny" | "error" | "throw";

/** Resposta do `rate_limit_check` falso para cada modo. */
export function limiterReply(mode: LimitMode): { data: unknown; error: unknown } | "throw" {
  switch (mode) {
    case "allow":
      return { data: { allowed: true, denied_bucket: null, retry_after_seconds: 0 }, error: null };
    case "deny":
      return { data: { allowed: false, denied_bucket: "x", retry_after_seconds: 37 }, error: null };
    case "error":
      return { data: null, error: { message: "falha do limitador" } };
    default:
      return "throw";
  }
}

/**
 * `rpc` falso: grava toda chamada em `calls`. `limits` mapeia o nome do balde (o primeiro item de p_checks) para o
 * modo; balde nao listado: permite. `others` responde as demais funcoes (padrao: `{ data: null, error: null }`).
 */
export function fakeRpc(
  calls: RpcCall[],
  limits: Record<string, LimitMode> = {},
  others: Record<string, { data?: unknown; error?: unknown }> = {},
) {
  return (fn: string, args: Record<string, unknown> = {}): Promise<{ data?: unknown; error: unknown }> => {
    calls.push({ fn, args });
    if (fn === "rate_limit_check") {
      const checks = args.p_checks as Array<{ bucket: string }>;
      const reply = limiterReply(limits[checks[0].bucket] ?? "allow");
      if (reply === "throw") return Promise.reject(new Error("limitador fora do ar"));
      return Promise.resolve(reply);
    }
    const o = others[fn];
    return Promise.resolve({ data: o?.data ?? null, error: o?.error ?? null });
  };
}

/** Pedido POST com corpo JSON e cabecalhos opcionais. */
export function postJson(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://x/fn", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Relogio e sono falsos: o sono resolve em seguida (macrotarefa), para que promessas ja resolvidas ganhem a corrida. */
export function fakeClock() {
  const state = { t: 1_000_000, slept: [] as number[] };
  return {
    state,
    now: () => state.t,
    sleep: (ms: number) => {
      state.slept.push(ms);
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          state.t += ms;
          resolve();
        }, 0)
      );
    },
  };
}
