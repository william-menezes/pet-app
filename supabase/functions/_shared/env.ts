/**
 * Carregamento e validacao de variaveis de ambiente das Edge Functions
 * (contracts/shared-edge.contract.md). Falha fechada: segredo ausente ou fraco => MisconfiguredError
 * (a funcao responde 500 `misconfigured`). Nenhum valor e escrito em log nem na mensagem do erro.
 */

export interface FaroEnv {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  /** >= 16 caracteres */
  hashSalt: string;
  /** >= 32 caracteres */
  otpPepper: string;
  faroEnv: "local" | "test" | "staging" | "production";
  /** '' quando nao configurado */
  smsDriver: string;
  /** So lido quando smsDriver === 'stub' */
  smsStubCode: string | null;
  /** Padrao 500 */
  smsDailyCap: number;
  siteUrl: string;
}

export class MisconfiguredError extends Error {
  constructor(public readonly variable: string) {
    // Somente o NOME da variavel; nunca o valor.
    super(`misconfigured: ${variable}`);
    this.name = "MisconfiguredError";
  }
}

const FARO_ENVS = ["local", "test", "staging", "production"] as const;
const DEFAULT_SMS_DAILY_CAP = 500;

type Reader = (name: string) => string | undefined;

const denoReader: Reader = (name) => Deno.env.get(name);

/**
 * `read` e injetavel para os testes (o CI roda `deno test` sem permissao de env).
 * Em producao usa Deno.env.get.
 */
export function loadEnv(
  need: { pepper?: boolean },
  read: Reader = denoReader,
): FaroEnv {
  const required = (name: string): string => {
    const v = read(name);
    if (v === undefined || v.trim() === "") throw new MisconfiguredError(name);
    return v;
  };

  const supabaseUrl = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

  const hashSalt = required("HASH_SALT");
  if (hashSalt.length < 16) throw new MisconfiguredError("HASH_SALT");

  let otpPepper = "";
  if (need.pepper) {
    otpPepper = required("PHONE_OTP_PEPPER");
    if (otpPepper.length < 32) throw new MisconfiguredError("PHONE_OTP_PEPPER");
  } else {
    otpPepper = read("PHONE_OTP_PEPPER") ?? "";
  }

  const rawEnv = (read("FARO_ENV") ?? "").trim();
  const faroEnv = (FARO_ENVS as readonly string[]).includes(rawEnv)
    ? (rawEnv as FaroEnv["faroEnv"])
    : "production";

  const smsDriver = (read("SMS_DRIVER") ?? "").trim();
  const rawStub = (read("SMS_STUB_CODE") ?? "").trim();
  const smsStubCode = smsDriver === "stub" && /^[0-9]{6}$/.test(rawStub)
    ? rawStub
    : null;

  const capParsed = Number.parseInt((read("SMS_DAILY_CAP") ?? "").trim(), 10);
  const smsDailyCap = Number.isFinite(capParsed) && capParsed >= 1
    ? capParsed
    : DEFAULT_SMS_DAILY_CAP;

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    hashSalt,
    otpPepper,
    faroEnv,
    smsDriver,
    smsStubCode,
    smsDailyCap,
    siteUrl: (read("SITE_URL") ?? "").trim(),
  };
}
