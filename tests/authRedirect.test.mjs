import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthRedirectUrl } from '../src/services/authRedirect.mjs';

test('createAuthRedirectUrl cria callbacks nativos com o caminho correto', () => {
  const createUrl = (path) => `meufinanceiro://${path}`;

  assert.equal(
    createAuthRedirectUrl({ platform: 'android', createUrl }),
    'meufinanceiro://auth/callback'
  );
  assert.equal(
    createAuthRedirectUrl({ platform: 'ios', recovery: true, createUrl }),
    'meufinanceiro://auth/recovery'
  );
});

test('createAuthRedirectUrl preserva a origem Web e sinaliza recuperação', () => {
  assert.equal(
    createAuthRedirectUrl({ platform: 'web', origin: 'https://meu-financeiro.example' }),
    'https://meu-financeiro.example/'
  );
  assert.equal(
    createAuthRedirectUrl({ platform: 'web', recovery: true, origin: 'https://meu-financeiro.example' }),
    'https://meu-financeiro.example/?recover=1'
  );
});
