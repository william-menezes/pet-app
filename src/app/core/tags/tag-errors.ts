/**
 * Códigos de erro das RPCs do tutor (contrato `tutor-rpcs.contract.md`, tabela "Códigos de erro") e o texto
 * que a tela mostra para cada um. Nenhum texto revela a situação de uma tag que não é do tutor.
 */
export type TagError =
  | 'invalid_code'
  | 'tag_unavailable'
  | 'wrong_pin'
  | 'locked'
  | 'pet_not_found'
  | 'pet_has_tag'
  | 'phone_not_confirmed'
  | 'not_entitled'
  | 'not_owner'
  | 'no_active_tag'
  | 'too_many_requests'
  | 'replacement_limit'
  | 'network';

export const TAG_ERRORS: readonly TagError[] = [
  'invalid_code',
  'tag_unavailable',
  'wrong_pin',
  'locked',
  'pet_not_found',
  'pet_has_tag',
  'phone_not_confirmed',
  'not_entitled',
  'not_owner',
  'no_active_tag',
  'too_many_requests',
  'replacement_limit',
];

/** "alguns minutos" quando o servidor não diz quanto falta; senão minutos (arredondado para cima) ou segundos. */
export function formatRetry(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) return $localize`alguns minutos`;
  if (seconds < 60) return seconds === 1 ? $localize`1 segundo` : $localize`${seconds}:seconds: segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? $localize`1 minuto` : $localize`${minutes}:minutes: minutos`;
}

export function tagErrorMessage(error: TagError, retryAfterSeconds?: number): string {
  switch (error) {
    case 'invalid_code':
      return $localize`Confira o código. Ele fica embaixo do QR.`;
    case 'tag_unavailable':
      return $localize`Não é possível usar esta tag. Fale com o suporte.`;
    case 'wrong_pin':
      return $localize`PIN incorreto. Confira o cartão.`;
    case 'locked':
      return retryAfterSeconds === undefined
        ? $localize`Muitas tentativas. Tente de novo em alguns minutos.`
        : $localize`Muitas tentativas. Tente de novo em ${formatRetry(retryAfterSeconds)}:time:.`;
    case 'pet_not_found':
      return $localize`Não encontramos este pet.`;
    case 'pet_has_tag':
      return $localize`Este pet já tem uma tag.`;
    case 'phone_not_confirmed':
      return $localize`Confirme seu celular para continuar.`;
    case 'not_entitled':
      return $localize`Não foi possível vincular mais uma tag.`;
    case 'not_owner':
      return $localize`Não encontramos esta tag na sua conta.`;
    case 'no_active_tag':
      return $localize`Vincule uma tag a este pet primeiro.`;
    case 'too_many_requests':
      return $localize`Muitos pedidos em pouco tempo. Tente de novo em ${formatRetry(retryAfterSeconds)}:time:.`;
    case 'replacement_limit':
      return $localize`Você já tem pedidos demais em aberto. Fale com o suporte.`;
    case 'network':
      return $localize`Não conseguimos conectar. Verifique sua conexão e tente de novo.`;
  }
}
