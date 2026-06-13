import { showToast } from '../stores/toast';
import { useAuthStore } from '../stores/auth';

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(serverUrl: string): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setToken, setRefreshToken, logout } = useAuthStore.getState();
    if (!refreshToken) { logout(); return null; }
    try {
      const r = await fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!r.ok) { logout(); return null; }
      const data = await r.json();
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken ?? null);
      return data.accessToken as string;
    } catch {
      logout();
      return null;
    }
  })();
  try { return await refreshing; } finally { refreshing = null; }
}

export function makeApi(serverUrl: string, token: string) {
  return async function api(method: string, path: string, body?: any, opts?: { silent?: boolean; noRetry?: boolean }): Promise<any> {
    const silent = opts?.silent ?? false;
    const delays = opts?.noRetry ? [] : [1000, 2000, 4000];
    let lastErr: Error = new Error('Réseau indisponible');
    let currentToken = token;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      try {
        const r = await fetch(`${serverUrl}${path}`, {
          method,
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        clearTimeout(timeout);
        if (r.status === 401) {
          const newToken = await tryRefresh(serverUrl);
          if (newToken) {
            currentToken = newToken;
            // Retry immédiatement avec le nouveau token
            const r2 = await fetch(`${serverUrl}${path}`, {
              method,
              headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
              body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (!r2.ok) {
              if (r2.status === 401) { if (!silent) showToast('Session expirée, reconnecte-toi'); throw new Error('401'); }
              const t2 = await r2.text().catch(() => '');
              let m2 = 'Erreur serveur';
              try { const j2 = JSON.parse(t2); if (typeof j2.error === 'string') m2 = j2.error; } catch {}
              throw new Error(m2);
            }
            if (r2.status === 204) return null;
            return r2.json();
          }
          if (!silent) showToast('Session expirée, reconnecte-toi');
          throw new Error('401');
        }
        if (r.status === 403) {
          if (!silent) showToast('Accès refusé');
          throw new Error('403');
        }
        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          let errMsg = 'Erreur serveur';
          try { const j = JSON.parse(errText); if (typeof j.error === 'string') errMsg = j.error; } catch {}
          throw new Error(errMsg);
        }
        if (r.status === 204) return null;
        return r.json();
      } catch (e: any) {
        clearTimeout(timeout);
        lastErr = e;
        if (e.message === '401' || e.message === '403') throw e;
        if (attempt < delays.length) await new Promise(res => setTimeout(res, delays[attempt]));
      }
    }
    if (!silent) showToast('Erreur réseau, réessaie');
    throw lastErr;
  };
}
