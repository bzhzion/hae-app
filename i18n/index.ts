import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import fr from './fr';
import ko from './ko';

export type Language = 'en' | 'fr' | 'ko';
export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

const LANG_KEY = 'hae-language';

export async function loadSavedLanguage(): Promise<Language> {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved && ['en', 'fr', 'ko'].includes(saved)) return saved as Language;
  } catch {}
  return 'en';
}

export async function saveLanguage(lang: Language) {
  await AsyncStorage.setItem(LANG_KEY, lang);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, ko: { translation: ko } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
