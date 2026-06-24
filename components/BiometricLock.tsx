import { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useBiometricStore } from '@/stores/biometric';

export default function BiometricLock() {
  const { enabled, locked, setLocked, load } = useBiometricStore();
  const appState = useRef(AppState.currentState);
  const authenticating = useRef(false);
  const cameFromBackground = useRef(false);

  useEffect(() => { load(); }, []);

  const authenticate = useCallback(async () => {
    if (authenticating.current) return;
    if (Platform.OS === 'web') { setLocked(false); return; }
    const has = await LocalAuthentication.hasHardwareAsync();
    if (!has) { setLocked(false); return; }
    authenticating.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Déverrouiller Hae',
        fallbackLabel: 'Code PIN',
        cancelLabel: 'Annuler',
      });
      if (result.success) setLocked(false);
    } finally {
      authenticating.current = false;
    }
  }, [setLocked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        cameFromBackground.current = true;
        if (enabled) setLocked(true);
      }
      if (next === 'active' && cameFromBackground.current) {
        cameFromBackground.current = false;
        if (enabled) authenticate();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled, authenticate, setLocked]);

  if (!locked) return null;

  return (
    <View style={s.overlay}>
      <Text style={s.icon}>🔒</Text>
      <Text style={s.title}>Hae est verrouillé</Text>
      <TouchableOpacity style={s.btn} onPress={authenticate}>
        <Text style={s.btnText}>Déverrouiller</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FAFAF8', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  icon:    { fontSize: 48, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 32 },
  btn:     { backgroundColor: '#A00000', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
