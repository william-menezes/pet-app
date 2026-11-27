import { expect, test } from '@playwright/test';

import { apiSignIn, serviceRest, stack } from './support/stack';
import { activateViaApi, adminSession, createPet, newTutor, rpc, takeTag, type PoolTag, type Tutor } from './support/tags';

/**
 * Gate do PIN, pela API HTTP real (rodada de QA da spec 003). Complementa supabase/tests/pin_contadores_laterais.test.sql com o que
 * so a pilha inteira prova: sair e entrar de novo (sessao de verdade no Auth) nao desfaz o contador nem o bloqueio, e o limite
 * por tag (20 erros em 24 h) soma entre contas diferentes.
 */

const wrongPin = (tag: PoolTag): string => (tag.pin[0] === '0' ? '1' : '0') + tag.pin.slice(1);

async function tagRow(code: string) {
  const r = await serviceRest(`tag_codes?code=eq.${code}&select=status,pin_fail_count_24h,pin_locked_until`);
  return r.body[0] as { status: string; pin_fail_count_24h: number; pin_locked_until: string | null };
}
async function attemptRow(code: string, tutorId: string) {
  const r = await serviceRest(`tag_pin_attempts?tag_code=eq.${code}&tutor_id=eq.${tutorId}&select=fail_count,locked_until`);
  return (r.body[0] ?? null) as { fail_count: number; locked_until: string | null } | null;
}
async function fail(t: Tutor, tag: PoolTag, pet: string) {
  const r = await rpc(t, 'activate_tag', { p_code: tag.code, p_pin: wrongPin(tag), p_pet_id: pet, p_replace: false, p_enable_whatsapp: false });
  return r.body as { ok: boolean; error?: string; retry_after_seconds?: number };
}

test('sair e entrar de novo (sessao real) nao zera os erros nem levanta o bloqueio da conta', async () => {
  const t = await newTutor();
  const pet = await createPet(t);
  const tag = takeTag();

  for (let i = 0; i < 3; i++) expect((await fail(t, tag, pet)).error).toBe('wrong_pin');
  expect((await attemptRow(tag.code, t.id))?.fail_count).toBe(3);

  // Sair de verdade (revoga a sessao no Auth) e entrar de novo com a senha.
  const out = await fetch(`${stack.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: stack.anonKey, Authorization: `Bearer ${t.token}` } });
  expect(out.status).toBe(204);
  const again = await apiSignIn(t.email, t.password);
  expect(again.session, 'nova sessao').not.toBeNull();
  const t2: Tutor = { ...t, token: again.session!.access_token };

  expect((await attemptRow(tag.code, t.id))?.fail_count, 'a contagem sobrevive a sair e entrar').toBe(3);
  expect((await fail(t2, tag, pet)).error).toBe('wrong_pin'); // 4o erro: continua a contagem de onde parou
  const fifth = await fail(t2, tag, pet);
  expect(fifth.error, '5o erro (somando os da sessao antiga): bloqueia').toBe('locked');
  const locked = await attemptRow(tag.code, t.id);
  expect(locked?.fail_count).toBe(5);
  expect(locked?.locked_until).not.toBeNull();

  // PIN certo durante o bloqueio: recusado; depois de sair e entrar de novo, continua recusado e o instante nao muda.
  const right = await rpc(t2, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: pet, p_replace: false, p_enable_whatsapp: false });
  expect(right.body.error).toBe('locked');
  await fetch(`${stack.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: stack.anonKey, Authorization: `Bearer ${t2.token}` } });
  const third = await apiSignIn(t.email, t.password);
  const t3: Tutor = { ...t, token: third.session!.access_token };
  const right2 = await rpc(t3, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: pet, p_replace: false, p_enable_whatsapp: false });
  expect(right2.body.error, 'nova sessao: o PIN certo ainda e recusado').toBe('locked');
  const after = await attemptRow(tag.code, t.id);
  expect(after?.fail_count).toBe(5);
  expect(after?.locked_until, 'o instante do bloqueio nao muda').toBe(locked?.locked_until);
  expect((await tagRow(tag.code)).status, 'a tag continua disponivel (nada foi vinculado)').toBe('available');
});

test('o limite por TAG soma entre contas: 20 erros de contas diferentes travam a tag para todos, inclusive PIN certo', async () => {
  test.setTimeout(120_000);
  const tag = takeTag();
  const tutors: { t: Tutor; pet: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const t = await newTutor();
    tutors.push({ t, pet: await createPet(t) });
  }
  // 4 contas x 5 erros = 20 erros na tag; cada conta trava ao 5o. O 20o erro trava a tag (24 h).
  let last: { error?: string; retry_after_seconds?: number } = {};
  for (const { t, pet } of tutors) {
    for (let i = 0; i < 5; i++) last = await fail(t, tag, pet);
    const a = await attemptRow(tag.code, t.id);
    expect(a?.fail_count).toBe(5);
    expect(a?.locked_until).not.toBeNull();
  }
  expect(last.error).toBe('locked');
  expect(last.retry_after_seconds, 'o 20o erro devolve o bloqueio de 24 h da tag').toBeGreaterThan(3600);
  const row = await tagRow(tag.code);
  expect(row.pin_fail_count_24h).toBe(20);
  expect(row.pin_locked_until).not.toBeNull();

  // Uma conta que nunca errou, com o PIN CERTO, recebe locked; o contador da tag nao se mexe.
  const fresh = await newTutor();
  const freshPet = await createPet(fresh);
  const r = await rpc(fresh, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: freshPet, p_replace: false, p_enable_whatsapp: false });
  expect(r.body.error).toBe('locked');
  expect((await tagRow(tag.code)).pin_fail_count_24h).toBe(20);
  expect((await attemptRow(tag.code, fresh.id)), 'a conta que so acertou nao ganhou linha de erros').toBeNull();

  // Auditoria do bloqueio: so contagem, sem PIN.
  const ev = await serviceRest(`audit_log?entity_id=eq.${tag.code}&event=in.(activation_locked_account,activation_locked_tag)&select=event,detail`);
  expect(ev.body.filter((e: { event: string }) => e.event === 'activation_locked_account')).toHaveLength(4);
  expect(ev.body.filter((e: { event: string }) => e.event === 'activation_locked_tag')).toHaveLength(1);
  expect(JSON.stringify(ev.body)).not.toContain(tag.pin);

  // Excluir uma das contas apaga a linha dela, mas o contador e o bloqueio da TAG ficam.
  await fetch(`${stack.url}/auth/v1/admin/users/${tutors[0].t.id}`, {
    method: 'DELETE',
    headers: { apikey: stack.serviceKey, Authorization: `Bearer ${stack.serviceKey}` },
  });
  expect(await attemptRow(tag.code, tutors[0].t.id)).toBeNull();
  const kept = await tagRow(tag.code);
  expect(kept.pin_fail_count_24h).toBe(20);
  expect(kept.pin_locked_until).not.toBeNull();

  // A reemissao pelo admin (o unico caminho que zera): tag liberada, PIN novo vale, o antigo nao.
  const admin = await adminSession();
  const re = await fetch(`${stack.url}/rest/v1/rpc/admin_reissue_pin`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, Authorization: `Bearer ${admin.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: tag.code }),
  });
  const reBody = (await re.json()) as { ok: boolean; new_pin?: string };
  expect(reBody.ok).toBe(true);
  expect(reBody.new_pin).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  const zero = await tagRow(tag.code);
  expect(zero.pin_fail_count_24h).toBe(0);
  expect(zero.pin_locked_until).toBeNull();
  const old = await rpc(fresh, 'activate_tag', { p_code: tag.code, p_pin: tag.pin, p_pet_id: freshPet, p_replace: false, p_enable_whatsapp: false });
  expect(old.body.error, 'o PIN antigo nao vale depois da reemissao').toBe('wrong_pin');
  const ok = await rpc(fresh, 'activate_tag', { p_code: tag.code, p_pin: reBody.new_pin, p_pet_id: freshPet, p_replace: false, p_enable_whatsapp: false });
  expect(ok.body.ok).toBe(true);
});

test('o PIN certo de outra tag, liberar e trocar tag nao mexem nos erros de uma tag alvo (pilha real)', async () => {
  const t = await newTutor();
  const petA = await createPet(t, 'A');
  const petB = await createPet(t, 'B');
  const target = takeTag();
  const other1 = takeTag();
  const other2 = takeTag();

  for (let i = 0; i < 2; i++) expect((await fail(t, target, petA)).error).toBe('wrong_pin');
  await activateViaApi(t, other1, petA);
  const rel = await rpc(t, 'release_tag', { p_code: other1.code, p_reason: 'released' });
  expect(rel.body.ok).toBe(true);
  await activateViaApi(t, other2, petB);
  const swap = await rpc(t, 'activate_tag', { p_code: other1.code, p_pin: rel.body.new_pin, p_pet_id: petB, p_replace: true, p_enable_whatsapp: false });
  expect(swap.body.ok, 'troca de tag no pet B').toBe(true);
  expect((await attemptRow(target.code, t.id))?.fail_count).toBe(2);
  expect((await tagRow(target.code)).pin_fail_count_24h).toBe(2);
});
