/**
 * Porta de envio de SMS (contracts/shared-edge.contract.md). So `phone-verify-start` fala com ela.
 *
 * Os drivers `log` e `stub` sao SIMULADOS e so existem com FARO_ENV `local` ou `test`: fora disso
 * `resolveSender` devolve null e a funcao responde `sms_unavailable` (falha fechada).
 */
import type { FaroEnv } from "../env.ts";

export interface SmsSender {
  send(toE164: string, text: string): Promise<{ ok: boolean; providerId?: string }>;
}

type SenderEnv = Pick<FaroEnv, "smsDriver" | "faroEnv">;
type DriverFactory = (env: SenderEnv) => SmsSender;

/**
 * Drivers reais, por nome de SMS_DRIVER.
 * TODO(SMS_PROVIDER): o provedor ainda nao foi ativado (sera o Google). Quando for, o driver entra aqui
 * (`google: (env) => new GoogleSmsSender(env)`), com as credenciais lidas so de variaveis do servidor.
 * Ate la nao existe driver real: qualquer nome diferente de `log`/`stub` resolve para null.
 */
const REAL_DRIVERS: Record<string, DriverFactory> = {};

/** Escreve o SMS no log da funcao. SO local/test: e o unico lugar em que o codigo aparece em log. */
class LogSender implements SmsSender {
  send(toE164: string, text: string): Promise<{ ok: boolean; providerId?: string }> {
    console.log(`[sms:log] para=${toE164.slice(-4)} texto=${text}`);
    return Promise.resolve({ ok: true, providerId: "log" });
  }
}

/** Nao escreve o codigo em lugar nenhum (E2E com codigo fixo). */
class StubSender implements SmsSender {
  send(_toE164: string, _text: string): Promise<{ ok: boolean; providerId?: string }> {
    return Promise.resolve({ ok: true, providerId: "stub" });
  }
}

export function resolveSender(
  env: SenderEnv,
  realDrivers: Record<string, DriverFactory> = REAL_DRIVERS,
): SmsSender | null {
  const driver = env.smsDriver;
  if (driver === "log" || driver === "stub") {
    if (env.faroEnv !== "local" && env.faroEnv !== "test") return null;
    return driver === "log" ? new LogSender() : new StubSender();
  }
  if (driver === "" || !Object.prototype.hasOwnProperty.call(realDrivers, driver)) return null;
  return realDrivers[driver](env);
}

/** Texto exato do SMS (sem acentos, duas linhas; a segunda e o formato de preenchimento automatico do navegador). */
export function buildOtpMessage(code: string): string {
  return `Faro: seu codigo e ${code}. Vale por 10 minutos. Nao compartilhe.\n@tagfaro.com.br #${code}`;
}
