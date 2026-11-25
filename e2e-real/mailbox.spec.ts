import { expect, test } from '@playwright/test';
import { waitForLink } from './support/mailbox';
import { stack, uniqueEmail, TEST_PASSWORD } from './support/stack';

/** T038: fumaca do coletor. Cria um usuario por POST /auth/v1/signup e obtem um link com token_hash=. */
test('o coletor local entrega o link de confirmacao com token_hash', async () => {
  const email = uniqueEmail('mbx');
  const res = await fetch(`${stack.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: stack.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, data: { name: 'Fumaca', terms_version: '2026-11' } }),
  });
  expect(res.status).toBe(200);
  const link = await waitForLink(email, 'token_hash=');
  expect(link).toContain('/auth/confirmar-email?token_hash=');
  expect(link).toMatch(/type=(email|signup)/);
});
