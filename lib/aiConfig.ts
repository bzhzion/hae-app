type ApiFn = (method: string, path: string, body?: any, opts?: { silent?: boolean }) => Promise<any>;

const hasCfg = (c: any) => !!(c?.ai_base_url || c?.stt_base_url);

export async function resolveAiConfig(
  api: ApiFn,
  projectId?: string | null,
  ownerType?: string | null,
  ownerId?: string | null,
): Promise<any> {
  if (projectId) {
    const c = await api('GET', `/api/projects/${projectId}/ai-config`, undefined, { silent: true }).catch(() => null);
    if (hasCfg(c)) return c;
  }
  if ((ownerType === 'org' || ownerType === 'organisation') && ownerId) {
    const c = await api('GET', `/api/organisations/${ownerId}/ai-config`, undefined, { silent: true }).catch(() => null);
    if (hasCfg(c)) return c;
  }
  return await api('GET', '/api/users/me/ai-config', undefined, { silent: true }).catch(() => ({}));
}
