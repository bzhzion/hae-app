import { useState, useEffect } from 'react';
import { makeApi } from '@/lib/api';
import { resolveAiConfig } from '@/lib/aiConfig';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';

export interface AiAvailability {
  aiReady: boolean;
  sttReady: boolean;
  cfg: any;
  loading: boolean;
}

export function useAiConfig(): AiAvailability {
  const { serverUrl, token } = useAuthStore();
  const { currentProjectId, currentProjectOwnerType, currentProjectOwnerId } = useProjectStore();
  const [state, setState] = useState<AiAvailability>({ aiReady: false, sttReady: false, cfg: null, loading: true });

  useEffect(() => {
    if (!serverUrl || !token) {
      setState({ aiReady: false, sttReady: false, cfg: null, loading: false });
      return;
    }
    const api = makeApi(serverUrl, token);
    setState(s => ({ ...s, loading: true }));
    resolveAiConfig(api, currentProjectId, currentProjectOwnerType, currentProjectOwnerId)
      .then(cfg => {
        const aiReady = !!(cfg?.ai_base_url && cfg?.ai_api_key);
        const sttReady = !!(cfg?.stt_api_key || cfg?.ai_api_key) && !!(cfg?.stt_base_url || cfg?.ai_base_url);
        setState({ aiReady, sttReady, cfg, loading: false });
      })
      .catch(() => setState({ aiReady: false, sttReady: false, cfg: null, loading: false }));
  }, [serverUrl, token, currentProjectId, currentProjectOwnerType, currentProjectOwnerId]);

  return state;
}
