import { useCallback, useState } from 'react';

export type SttState = 'idle' | 'recording' | 'transcribing';

export function useStt() {
  const [state] = useState<SttState>('idle');

  const toggle = useCallback(async (): Promise<string | null> => {
    return null;
  }, []);

  return { state, toggle };
}
