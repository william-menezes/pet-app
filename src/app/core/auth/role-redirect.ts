/**
 * role-redirect.ts — T016
 *
 * Util puro: mapeia o papel do usuário à rota de destino.
 * FR-005 (tutor → /app) e FR-006 (admin → /admin).
 *
 * Nota de segurança: esse mapeamento serve APENAS para a UX de roteamento.
 * A autorização real dos dados de admin é feita pela RLS via is_admin() no banco.
 * Um guard burlado NÃO concede acesso a dados protegidos.
 */
import type { Role } from './auth.store';

export type AuthRoute = '/app' | '/admin';

/**
 * Retorna a rota de destino para o papel informado.
 * Padrão (null ou desconhecido): /app (acesso básico como tutor).
 */
export function roleRedirect(role: Role | null): AuthRoute {
  return role === 'admin' ? '/admin' : '/app';
}
