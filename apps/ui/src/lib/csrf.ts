let cachedToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch('/api/v1/auth/csrf-token', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch CSRF token');
  const body = (await res.json()) as { token: string };
  cachedToken = body.token;
  return cachedToken;
}

export function invalidateCsrfToken(): void {
  cachedToken = null;
}
