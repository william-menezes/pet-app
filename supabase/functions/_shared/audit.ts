/**
 * Auditoria de eventos de autenticacao via log_auth_event (service_role).
 * Falha de auditoria e registrada SEM dado pessoal e nao derruba a operacao
 * (exceto onde o contrato da funcao disser o contrario).
 * `detalhe` e minimo: proibido e-mail, telefone, codigo, link, senha e IP.
 */

/** Parte do cliente Supabase que a auditoria usa (estrutural: os testes nao precisam do supabase-js). */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data?: unknown; error: unknown }>;
}

export async function logEvent(
  svc: RpcClient,
  evento: string,
  ator: string | null,
  ipHash: string,
  userAgent: string,
  detalhe: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await svc.rpc("log_auth_event", {
      p_evento: evento,
      p_ator: ator,
      p_ip_hash: ipHash,
      p_user_agent: userAgent.substring(0, 256),
      p_detalhe: detalhe,
    });
    if (error) console.error("audit: falha ao gravar evento", evento);
  } catch {
    console.error("audit: falha ao gravar evento", evento);
  }
}
