import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../stores/toast';

const COLORS = {
  error:   { bg: '#1A1A1A', text: '#fff' },
  info:    { bg: '#1A1A1A', text: '#fff' },
  success: { bg: '#166534', text: '#fff' },
};

export default function ToastBanner() {
  const { message, type, hide } = useToastStore();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (timer.current) clearTimeout(timer.current);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start(hide);
    }, 3000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [message]);

  if (!message) return null;

  const colors = COLORS[type];
  return (
    <Animated.View
      accessibilityLiveRegion='polite'
      accessibilityRole='alert'
      style={[
        s.banner,
        { top: insets.top + 8, backgroundColor: colors.bg },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}>
      <Text style={[s.text, { color: colors.text }]}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: { position: 'absolute', left: 16, right: 16, zIndex: 9999, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 8 },
  text:   { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
