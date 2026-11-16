// Interpreta apenas retornos de autenticação; nunca logue tokens ou códigos.
function toUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { return new URL(value); } catch { return null; }
}

export function parseAuthCallback(value) {
  const url = toUrl(value);
  if (!url) return null;

  const fragments = new URLSearchParams(url.hash.replace(/^#/, ''));
  // Com esquemas nativos, "auth" é o hostname. No Expo Go, é parte do path.
  const route = `${url.hostname}${url.pathname}`.replace(/\/+/g, '/');
  const routeIsRecovery = /(?:^|\/)auth\/recovery(?:\/|$)/.test(route);
  const hintedType = url.searchParams.get('type') || fragments.get('type');
  const type = routeIsRecovery || url.searchParams.get('recover') === '1'
    ? 'recovery'
    : hintedType;

  const error = url.searchParams.get('error_description') ||
    fragments.get('error_description') ||
    url.searchParams.get('error') ||
    fragments.get('error');
  if (error) return { kind: 'error', type, message: error };

  const code = url.searchParams.get('code');
  if (code) return { kind: 'pkce', code, type };

  const accessToken = fragments.get('access_token') || url.searchParams.get('access_token');
  const refreshToken = fragments.get('refresh_token') || url.searchParams.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { kind: 'implicit', accessToken, refreshToken, type };
}
