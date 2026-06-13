import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const BRAND = '#A00000';

interface Slide {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  bg: string;
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: 'check-circle',
    iconColor: BRAND,
    bg: '#FAFAF8',
    title: 'Bienvenue dans Hae',
    subtitle: 'Gérez vos projets avec la méthode GTD.\nCapturez tout, organisez, agissez.',
  },
  {
    key: 'kanban',
    icon: 'layout',
    iconColor: '#1A1A1A',
    bg: '#F5F5F0',
    title: 'Projets & Kanban',
    subtitle: 'Colonnes GTD : Inbox, Next, Urgent...\nGlissez vos tâches, suivez leur avancement.',
  },
  {
    key: 'team',
    icon: 'users',
    iconColor: BRAND,
    bg: '#FAFAF8',
    title: 'Équipe & Organisations',
    subtitle: 'Invitez vos collaborateurs, assignez des tâches.\nTravaillez ensemble, en temps réel.',
  },
  {
    key: 'ai',
    icon: 'cpu',
    iconColor: '#1A1A1A',
    bg: '#F5F5F0',
    title: 'Intelligence Artificielle',
    subtitle: 'Dictez vos tâches, l\'IA les structure.\nChecklists et résumés générés automatiquement.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const markDone = useOnboardingStore(s => s.markDone);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = () => {
    markDone();
    router.replace('/(auth)/login');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      finish();
    }
  };

  const slide = SLIDES[index];

  return (
    <View style={[s.container, { backgroundColor: slide.bg }]}>
      <TouchableOpacity style={[s.skip, { top: insets.top + 12 }]} onPress={finish}>
        <Text style={s.skipText}>Passer</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <View style={[s.slide, { backgroundColor: item.bg }]}>
            <Image
              source={require('../assets/icon-transparent.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <View style={s.iconWrap}>
              <Feather name={item.icon} size={72} color={item.iconColor} />
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={[s.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={[s.btn, index === SLIDES.length - 1 && s.btnFinal]} onPress={next}>
          <Text style={s.btnText}>
            {index === SLIDES.length - 1 ? 'Commencer' : 'Suivant'}
          </Text>
          {index < SLIDES.length - 1 && <Feather name="arrow-right" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1 },
  skip:       { position: 'absolute', right: 20, zIndex: 10, paddingHorizontal: 12, paddingVertical: 6 },
  skipText:   { fontSize: 13, fontWeight: '600', color: '#8A8A80' },
  slide:      { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  logo:       { width: 64, height: 64, marginBottom: 40, opacity: 0.15 },
  iconWrap:   { width: 128, height: 128, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  title:      { fontSize: 26, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14 },
  subtitle:   { fontSize: 15, color: '#6B6B63', textAlign: 'center', lineHeight: 22 },
  footer:     { paddingHorizontal: 24, paddingTop: 24 },
  dots:       { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D1CB' },
  dotActive:  { width: 20, backgroundColor: BRAND },
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 16 },
  btnFinal:   { backgroundColor: BRAND },
  btnText:    { fontSize: 16, fontWeight: '700', color: '#fff' },
});
