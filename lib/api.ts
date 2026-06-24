import { showToast } from '../stores/toast';

export function makeApi(serverUrl: string, token: string) {
  return async function api(method: string, path: string, body?: any, opts?: { silent?: boolean; noRetry?: boolean }): Promise<any> {
    const silent = opts?.silent ?? false;
    const delays = opts?.noRetry ? [] : [1000, 2000, 4000];
    let lastErr: Error = new Error('Réseau indisponible');
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      try {
        const r = await fetch(`${serverUrl}${path}`, {
          method,
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        clearTimeout(timeout);
        if (r.status === 401) {
          if (!silent) showToast('Session expirée, reconnecte-toi');
          throw new Error('401');
        }
        if (r.status === 403) {
          if (!silent) showToast('Accès refusé');
          throw new Error('403');
        }
        if (!r.ok) throw new Error(await r.text());
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
