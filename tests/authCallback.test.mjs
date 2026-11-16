import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAuthCallback } from '../src/services/authCallback.mjs';

test('parseAuthCallback extrai código PKCE de callback Supabase', () => {
  assert.deepEqual(
    parseAuthCallback('meufinanceiro://auth/callback?code=abc-123'),
    { kind: 'pkce', code: 'abc-123', type: null }
  );
});

test('parseAuthCallback extrai tokens implícitos no fragmento sem confundir parâmetros', () => {
  assert.deepEqual(
    parseAuthCallback('meufinanceiro://auth/callback#access_token=access&refresh_token=refresh&type=recovery'),
    { kind: 'implicit', accessToken: 'access', refreshToken: 'refresh', type: 'recovery' }
  );
});

test('parseAuthCallback rejeita retorno ausente ou incompleto', () => {
  assert.deepEqual(parseAuthCallback('meufinanceiro://auth/callback?error=access_denied'), { kind: 'error', type: null, message: 'access_denied' });
  assert.equal(parseAuthCallback('meufinanceiro://auth/callback#access_token=access'), null);
  assert.equal(parseAuthCallback(null), null);
});


test('reconhece recuperação PKCE no caminho nativo, sem depender de type', () => {
  assert.deepEqual(parseAuthCallback('meufinanceiro://auth/recovery?code=abc-123'),
    { kind: 'pkce', code: 'abc-123', type: 'recovery' });
});

test('reconhece recuperação em links Expo Go e Web', () => {
  assert.equal(parseAuthCallback('exp://127.0.0.1:8081/--/auth/recovery?code=abc').type, 'recovery');
  assert.equal(parseAuthCallback('http://localhost:8081/?recover=1&code=abc').type, 'recovery');
});

test('reconhece erros do Supabase sem expor tokens', () => {
  assert.deepEqual(parseAuthCallback('meufinanceiro://auth/recovery#error=access_denied&error_description=Expired'),
    { kind: 'error', type: 'recovery', message: 'Expired' });
});
