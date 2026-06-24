import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const BRAND = '#A00000';

const PRESETS = [
  { label: 'OpenAI',     url: 'https://api.openai.com/v1',          model: 'gpt-4o' },
  { label: 'Mistral',    url: 'https://api.mistral.ai/v1',           model: 'mistral-large-latest' },
  { label: 'Groq',       url: 'https://api.groq.com/openai/v1',      model: 'llama-3.3-70b-versatile' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1',        model: 'openai/gpt-4o' },
  { label: 'Ollama',     url: 'http://localhost:11434/v1',            model: 'llama3.2' },
];

type ApiFn = (method: string, path: string, body?: any, opts?: { silent?: boolean; noRetry?: boolean }) => Promise<any>;

interface Props {
  api: ApiFn;
  configPath: string;
  titleKey: 'titleUser' | 'titleOrg' | 'titleProject';
  subtitleKey: 'subtitleUser' | 'subtitleOrg' | 'subtitleProject';
}

export default function AiConfigSection({ api, configPath, titleKey, subtitleKey }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [sttBaseUrl, setSttBaseUrl] = useState('');
  const [sttApiKey, setSttApiKey] = useState('');
  const [sttModel, setSttModel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await api('GET', configPath, undefined, { silent: true, noRetry: true });
      setAiBaseUrl(cfg?.ai_base_url ?? '');
      setAiApiKey(cfg?.ai_api_key ?? '');
      setAiModel(cfg?.ai_model ?? '');
      setSttBaseUrl(cfg?.stt_base_url ?? '');
      setSttApiKey(cfg?.stt_api_key ?? '');
      setSttModel(cfg?.stt_model ?? '');
    } catch {}
    finally { setLoading(false); }
  }, [api, configPath]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setAiBaseUrl(preset.url);
    setAiModel(preset.model);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('PUT', configPath, {
        ai_base_url: aiBaseUrl.trim() || null,
        ai_api_key: aiApiKey.trim() || null,
        ai_model: aiModel.trim() || null,
        stt_base_url: sttBaseUrl.trim() || null,
        stt_api_key: sttApiKey.trim() || null,
        stt_model: sttModel.trim() || null,
      });
      await load();
      setExpanded(false);
    } catch (e: any) { Alert.alert(t('aiConfig.error'), e.message); }
    finally { setSaving(false); }
  };

  const remove = () => {
    Alert.alert(t('aiConfig.deleteTitle'), t('aiConfig.deleteMsg'), [
      { text: t('aiConfig.cancel'), style: 'cancel' },
      { text: t('aiConfig.delete'), style: 'destructive', onPress: async () => {
        try { await api('DELETE', configPath); await load(); } catch {}
      }},
    ]);
  };

  const hasConfig = !!(aiApiKey);

  return (
    <View>
      <TouchableOpacity style={s.sectionHead} onPress={() => setExpanded(v => !v)} activeOpacity={0.7} accessibilityRole='button' accessibilityState={{ expanded }}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionLabel}>{t(`aiConfig.${titleKey}`).toUpperCase()}</Text>
          <Text style={s.subtitle}>{t(`aiConfig.${subtitleKey}`)}</Text>
        </View>
        <View style={s.right}>
          {loading
            ? <ActivityIndicator size="small" color={BRAND} />
            : <View style={[s.dot, { backgroundColor: hasConfig ? BRAND : '#D1D1CB' }]} accessible={true} accessibilityLabel={hasConfig ? 'Configured' : 'Not configured'} />
          }
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#8A8A80" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.form}>
          {/* Pilules presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsRow} contentContainerStyle={s.pillsContent}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.label}
                style={[s.pill, aiBaseUrl === p.url && s.pillActive]}
                onPress={() => applyPreset(p)}
                accessibilityRole='button'
                accessibilityState={{ selected: aiBaseUrl === p.url }}
              >
                <Text style={[s.pillText, aiBaseUrl === p.url && s.pillTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.fieldLabel}>{t('aiConfig.llmBaseUrl')}</Text>
          <TextInput style={s.input} value={aiBaseUrl} onChangeText={setAiBaseUrl}
            placeholder="https://api.openai.com/v1" placeholderTextColor="#A0A098"
            autoCapitalize="none" keyboardType="url" accessibilityLabel='LLM base URL' />

          <Text style={s.fieldLabel}>{t('aiConfig.apiKey')}</Text>
          <TextInput style={s.input} value={aiApiKey} onChangeText={setAiApiKey}
            placeholder="sk-..." placeholderTextColor="#A0A098"
            autoCapitalize="none" secureTextEntry accessibilityLabel='API key' />

          <Text style={s.fieldLabel}>{t('aiConfig.llmModel')}</Text>
          <TextInput style={s.input} value={aiModel} onChangeText={setAiModel}
            placeholder="gpt-4o" placeholderTextColor="#A0A098" autoCapitalize="none" accessibilityLabel='LLM model' />

          <Text style={s.sectionSep}>{t('aiConfig.sttSection')}</Text>

          <Text style={s.fieldLabel}>{t('aiConfig.sttBaseUrl')}</Text>
          <TextInput style={s.input} value={sttBaseUrl} onChangeText={setSttBaseUrl}
            placeholder={t('aiConfig.sttBaseUrlPlaceholder')} placeholderTextColor="#A0A098"
            autoCapitalize="none" keyboardType="url" accessibilityLabel='STT base URL' />

          <Text style={s.fieldLabel}>{t('aiConfig.sttApiKey')}</Text>
          <TextInput style={s.input} value={sttApiKey} onChangeText={setSttApiKey}
            placeholder={t('aiConfig.sttApiKeyPlaceholder')} placeholderTextColor="#A0A098"
            autoCapitalize="none" secureTextEntry accessibilityLabel='STT API key' />

          <Text style={s.fieldLabel}>{t('aiConfig.sttModel')}</Text>
          <TextInput style={s.input} value={sttModel} onChangeText={setSttModel}
            placeholder="whisper-1" placeholderTextColor="#A0A098" autoCapitalize="none" accessibilityLabel='STT model' />

          <View style={s.actions}>
            {hasConfig && (
              <TouchableOpacity style={s.deleteBtn} onPress={remove} accessibilityRole='button'>
                <Text style={s.deleteBtnText}>{t('aiConfig.delete')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, { flex: 1 }]} onPress={save} disabled={saving} accessibilityRole='button' accessibilityState={{ disabled: saving }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('aiConfig.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionHead:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  sectionLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63' },
  subtitle:      { fontSize: 11, color: '#8A8A80', marginTop: 2 },
  right:         { flexDirection: 'row', alignItems: 'center' },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  form:          { marginTop: 12 },
  pillsRow:      { marginBottom: 4 },
  pillsContent:  { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  pill:          { borderRadius: 20, borderWidth: 1.5, borderColor: '#EBEBEB', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  pillActive:    { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  pillText:      { fontSize: 12, fontWeight: '600', color: '#6B6B63' },
  pillTextActive:{ color: BRAND },
  fieldLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#8A8A80', marginTop: 10, marginBottom: 4 },
  sectionSep:    { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#A0A098', marginTop: 16, marginBottom: 4, borderTopWidth: 1, borderColor: '#F0F0EC', paddingTop: 12 },
  input:         { fontSize: 14, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  actions:       { flexDirection: 'row', gap: 8, marginTop: 12 },
  saveBtn:       { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn:     { borderWidth: 1.5, borderColor: '#F0CECE', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  deleteBtnText: { color: BRAND, fontSize: 14, fontWeight: '600' },
});
