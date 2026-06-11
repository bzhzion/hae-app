import { useCallback, useState } from 'react';
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
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      showToast('Permission micro refusée');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
    recorder.record();
    setState('recording');
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

      const lang = i18n.language ?? 'fr';
      const form = new FormData();
      form.append('file', { uri, type: 'audio/m4a', name: 'rec.m4a' } as any);
      form.append('model', model);
      form.append('language', lang);

      const resp = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setState('idle');
      return data.text?.trim() ?? null;
    } catch (e: any) {
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
