export function createAuthRedirectUrl({ platform, recovery = false, origin, createUrl }) {
  const path = recovery ? 'auth/recovery' : 'auth/callback';

  if (platform === 'web') {
    if (!origin) throw new Error('A origem Web é obrigatória para o redirecionamento.');
    return `${origin}/${recovery ? '?recover=1' : ''}`;
  }

  if (typeof createUrl !== 'function') {
    throw new Error('O construtor de deep link nativo não está disponível.');
  }

  return createUrl(path);
}
