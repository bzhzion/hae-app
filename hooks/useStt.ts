import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { makeApi } from '@/lib/api';
import { resolveAiConfig } from '@/lib/aiConfig';
import { showToast } from '@/stores/toast';
import i18n from '@/i18n';

export type SttState = 'idle' | 'recording' | 'transcribing';

export function useStt() {
  const [state, setState] = useState<SttState>('idle');
  const { serverUrl, token } = useAuthStore();
  const { currentProjectId, currentProjectOwnerType, currentProjectOwnerId } = useProjectStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const start = useCallback(async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        showToast('Permission micro refusée');
        return;
      }
      if (Platform.OS !== 'web') {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      }
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      setState('recording');
    } catch (e: any) {
      showToast('Erreur STT');
    }
  }, [recorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (state !== 'recording') return null;
    setState('transcribing');

    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setState('idle');
      showToast('Enregistrement vide');
      return null;
    }

    try {
      const api = makeApi(serverUrl!, token!);
      const cfg = await resolveAiConfig(api, currentProjectId, currentProjectOwnerType, currentProjectOwnerId);

      const baseUrl: string = cfg?.stt_base_url || cfg?.ai_base_url;
      const apiKey: string = cfg?.stt_api_key || cfg?.ai_api_key;
      const model: string = cfg?.stt_model || 'whisper-1';

      if (!baseUrl || !apiKey) {
        showToast('Config STT manquante — configure l\'IA dans les réglages');
        setState('idle');
        return null;
      }

      // Azure OpenAI needs /openai/deployments/{model}/audio/transcriptions?api-version=...
      // Standard OpenAI-compatible: {baseUrl}/audio/transcriptions with model in body
      const isAzure = baseUrl.includes('.openai.azure.com');
      let sttUrl: string;
      const headers: Record<string, string> = {};
      if (isAzure) {
        const resourceBase = baseUrl.replace(/\/openai\/v1\/?$/, '').replace(/\/$/, '');
        sttUrl = `${resourceBase}/openai/deployments/${model}/audio/transcriptions?api-version=2024-06-01`;
        headers['api-key'] = apiKey;
      } else {
        sttUrl = `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      console.log('[STT] url:', sttUrl, 'azure:', isAzure, 'key_len:', apiKey?.length);

      const lang = i18n.language ?? 'fr';
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blobResp = await fetch(uri);
        const blob = await blobResp.blob();
        form.append('file', blob, 'rec.webm');
      } else {
        form.append('file', { uri, type: 'audio/m4a', name: 'rec.m4a' } as any);
      }
      if (!isAzure) form.append('model', model);
      form.append('language', lang);

      const resp = await fetch(sttUrl, {
        method: 'POST',
        headers,
        body: form,
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setState('idle');
      return data.text?.trim() ?? null;
    } catch (e: any) {
      console.error('[STT]', e);
      showToast('Erreur STT');
      setState('idle');
      return null;
    }
  }, [state, recorder, serverUrl, token]);

  const toggle = useCallback(async (): Promise<string | null> => {
    if (state === 'idle') {
      await start();
      return null;
    }
    return stopAndTranscribe();
  }, [state, start, stopAndTranscribe]);

  return { state, toggle };
}
