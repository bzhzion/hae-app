import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const BRAND = '#A00000';

type SlideType = 'text' | 'steps' | 'columns';

interface SlideConfig {
  key: string;
  type: SlideType;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  bg: string;
  accent: string;
}

const SLIDES: SlideConfig[] = [
  { key: 'hae',      type: 'text',    icon: 'sun',          iconColor: BRAND,     bg: '#FAFAF8', accent: 'rgba(160,0,0,0.07)' },
  { key: 'gtd',      type: 'text',    icon: 'book-open',    iconColor: '#1A1A1A', bg: '#F5F5F0', accent: 'rgba(26,26,26,0.05)' },
  { key: 'workflow', type: 'steps',   icon: 'check-square', iconColor: BRAND,     bg: '#FAFAF8', accent: 'rgba(160,0,0,0.07)' },
  { key: 'columns',  type: 'columns', icon: 'layout',       iconColor: '#1A1A1A', bg: '#F5F5F0', accent: 'rgba(26,26,26,0.05)' },
  { key: 'cards',    type: 'text',    icon: 'edit-3',       iconColor: BRAND,     bg: '#FAFAF8', accent: 'rgba(160,0,0,0.07)' },
  { key: 'team',     type: 'text',    icon: 'users',        iconColor: '#1A1A1A', bg: '#F5F5F0', accent: 'rgba(26,26,26,0.05)' },
  { key: 'ai',       type: 'text',    icon: 'zap',          iconColor: BRAND,     bg: '#FAFAF8', accent: 'rgba(160,0,0,0.07)' },
];

const WORKFLOW_STEPS = ['capture', 'clarify', 'organize', 'review', 'act'];

const COLUMN_KEYS = ['inbox', 'next', 'urgent', 'someday', 'waiting', 'done'];
const COLUMN_COLORS = ['#6B6B63', '#2563EB', BRAND, '#9CA3AF', '#D97706', '#16A34A'];

function StepsContent({ t }: { t: (k: string) => string }) {
  return (
    <View style={sc.stepList}>
      {WORKFLOW_STEPS.map((k, i) => (
        <View key={k} style={sc.stepRow}>
          <View style={sc.stepBadge}>
            <Text style={sc.stepNum}>{i + 1}</Text>
          </View>
          <View style={sc.stepText}>
            <Text style={sc.stepName}>{t(`onboarding.workflow.steps.${k}.name`)}</Text>
            <Text style={sc.stepDesc}>{t(`onboarding.workflow.steps.${k}.desc`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ColumnsContent({ t }: { t: (k: string) => string }) {
  return (
    <View style={sc.colList}>
      {COLUMN_KEYS.map((k, i) => (
        <View key={k} style={sc.colRow}>
          <View style={[sc.colDot, { backgroundColor: COLUMN_COLORS[i] }]} />
          <View style={sc.colText}>
            <Text style={sc.colName}>{t(`onboarding.columns.items.${k}.name`)}</Text>
            <Text style={sc.colDesc}>{t(`onboarding.columns.items.${k}.desc`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const markDone = useOnboardingStore(s => s.markDone);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const { t } = useTranslation();

  const finish = () => {
    markDone();
    router.replace('/(auth)/login');
  };

  const goTo = (i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const slide = SLIDES[index];

  return (
    <View style={[s.root, { backgroundColor: slide.bg }]}>
      <TouchableOpacity style={[s.skip, { top: insets.top + 12 }]} onPress={finish}>
        <Text style={s.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={item => item.key}
        style={s.list}
        renderItem={({ item }) => (
          <ScrollView
            style={{ width }}
            contentContainerStyle={[
              s.slideContent,
              { paddingTop: insets.top + 56, paddingBottom: 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require('../assets/icon-transparent.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <View style={[s.iconWrap, { backgroundColor: item.accent }]}>
              <Feather name={item.icon} size={56} color={item.iconColor} />
            </View>
            <Text style={s.title}>{t(`onboarding.${item.key}.title`)}</Text>

            {item.type === 'text' && (
              <Text style={s.body}>{t(`onboarding.${item.key}.body`)}</Text>
            )}
            {item.type === 'steps' && <StepsContent t={t} />}
            {item.type === 'columns' && <ColumnsContent t={t} />}
          </ScrollView>
        )}
      />

      <View style={[s.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.pagination}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>

        <View style={s.nav}>
          <TouchableOpacity
            style={[s.prevBtn, index === 0 && s.invisible]}
            onPress={() => index > 0 && goTo(index - 1)}
            disabled={index === 0}
          >
            <Feather name="arrow-left" size={20} color="#1A1A1A" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.nextBtn, index === SLIDES.length - 1 && s.nextBtnFinal]}
            onPress={() => index < SLIDES.length - 1 ? goTo(index + 1) : finish()}
          >
            <Text style={s.nextBtnText}>
              {index === SLIDES.length - 1 ? t('onboarding.start') : t('onboarding.next')}
            </Text>
            {index < SLIDES.length - 1 && (
              <Feather name="arrow-right" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  skip:         { position: 'absolute', right: 20, zIndex: 10, paddingHorizontal: 12, paddingVertical: 6 },
  skipText:     { fontSize: 13, fontWeight: '600', color: '#8A8A80' },
  list:         { flex: 1 },
  slideContent: { alignItems: 'center', paddingHorizontal: 28, flexGrow: 1 },
  logo:         { width: 46, height: 46, marginBottom: 24, opacity: 0.12 },
  iconWrap:     { width: 104, height: 104, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:        { fontSize: 24, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.5, marginBottom: 16 },
  body:         { fontSize: 15, color: '#5A5A52', textAlign: 'center', lineHeight: 23 },
  footer:       { paddingHorizontal: 24, paddingTop: 12 },
  pagination:   { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D1CB' },
  dotActive:    { width: 18, backgroundColor: BRAND },
  nav:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prevBtn:      { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  invisible:    { opacity: 0 },
  nextBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 14, paddingVertical: 16 },
  nextBtnFinal: { backgroundColor: BRAND },
  nextBtnText:  { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const sc = StyleSheet.create({
  stepList: { width: '100%', gap: 10 },
  stepRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge:{ width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  stepNum:  { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1 },
  stepName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  stepDesc: { fontSize: 13, color: '#5A5A52', lineHeight: 19 },

  colList:  { width: '100%', gap: 8 },
  colRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  colDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  colText:  { flex: 1 },
  colName:  { fontSize: 12, fontWeight: '800', color: '#1A1A1A', letterSpacing: 0.5, marginBottom: 1 },
  colDesc:  { fontSize: 13, color: '#5A5A52', lineHeight: 18 },
});
