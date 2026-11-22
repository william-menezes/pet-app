/**
 * Porta de envio de e-mail (spec 003, T051; research.md secao 7). Quem fala com ela e `register-scan` (aviso de scan e de
 * localizacao). O aviso ao tutor e gratuito para sempre e NUNCA bloqueia o scan: sem provedor ou com falha de envio, o
 * scan e gravado e aparece no historico do mesmo jeito.
 *
 * Os drivers `log` e `stub` sao SIMULADOS e so existem com FARO_ENV `local` ou `test`: fora disso `resolveEmailSender`
 * devolve null (falha fechada: nada e enviado e nada e registrado como enviado).
 *
 * TODO(EMAIL_PROVIDER): o provedor ainda nao foi ativado (sera o Google). Quando for, o driver entra em REAL_DRIVERS
 * (`google: (env) => new GoogleEmailSender(env)`), com as credenciais lidas so de variaveis do servidor, SPF/DKIM do
 * dominio tagfaro.com.br e a API HTTP do provedor. Ate la nao existe driver real.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<{ ok: boolean; providerId?: string }>;
}

export interface EmailEnv {
  emailDriver: string;
  faroEnv: string;
}

type DriverFactory = (env: EmailEnv) => EmailSender;

/** Drivers reais, por nome de EMAIL_DRIVER. Vazio ate o provedor ser ativado (TODO(EMAIL_PROVIDER)). */
const REAL_DRIVERS: Record<string, DriverFactory> = {};

/** Escreve so o assunto no log da funcao (so local/test). Nunca o endereco, nunca o corpo. */
class LogEmailSender implements EmailSender {
  send(msg: EmailMessage): Promise<{ ok: boolean; providerId?: string }> {
    console.log(`[email:log] assunto=${msg.subject}`);
    return Promise.resolve({ ok: true, providerId: "log" });
  }
}

/** Nao escreve nada em lugar nenhum (E2E). */
class StubEmailSender implements EmailSender {
  send(_msg: EmailMessage): Promise<{ ok: boolean; providerId?: string }> {
    return Promise.resolve({ ok: true, providerId: "stub" });
  }
}

export function resolveEmailSender(
  env: EmailEnv,
  realDrivers: Record<string, DriverFactory> = REAL_DRIVERS,
): EmailSender | null {
  const driver = env.emailDriver;
  if (driver === "log" || driver === "stub") {
    if (env.faroEnv !== "local" && env.faroEnv !== "test") return null;
    return driver === "log" ? new LogEmailSender() : new StubEmailSender();
  }
  if (driver === "" || !Object.prototype.hasOwnProperty.call(realDrivers, driver)) return null;
  return realDrivers[driver](env);
}

/** FARO_ENV valido; qualquer outro valor (ou ausente) e `production` (falha fechada), como em `loadEnv`. */
export function faroEnvFrom(raw: string | undefined): "local" | "test" | "staging" | "production" {
  const v = (raw ?? "").trim();
  return v === "local" || v === "test" || v === "staging" ? v : "production";
}
