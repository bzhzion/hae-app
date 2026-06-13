import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const BRAND = '#A00000';

const PRESETS = [
  { id: 'claude',     label: 'Claude',       recommended: true,  url: 'https://openrouter.ai/api/v1',              model: 'anthropic/claude-haiku-4-5',  keyUrl: 'https://openrouter.ai/settings/keys',      keyNote: null },
  { id: 'openai',     label: 'OpenAI',       recommended: false, url: 'https://api.openai.com/v1',                 model: 'gpt-4.1-mini',                keyUrl: 'https://platform.openai.com/api-keys',     keyNote: null },
  { id: 'mistral',    label: 'Mistral',      recommended: false, url: 'https://api.mistral.ai/v1',                 model: 'mistral-small-latest',        keyUrl: 'https://console.mistral.ai/api-keys',      keyNote: null },
  { id: 'groq',       label: 'Groq',         recommended: false, url: 'https://api.groq.com/openai/v1',            model: 'llama-3.3-70b-versatile',     keyUrl: 'https://console.groq.com/keys',            keyNote: null },
  { id: 'openrouter', label: 'OpenRouter',   recommended: false, url: 'https://openrouter.ai/api/v1',              model: 'openai/gpt-4o',               keyUrl: 'https://openrouter.ai/settings/keys',      keyNote: null },
  { id: 'gemini',     label: 'Gemini',       recommended: false, url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash',     keyUrl: 'https://aistudio.google.com/apikey',       keyNote: null },
  { id: 'azure',      label: 'Azure AI',     recommended: false, url: 'https://models.inference.ai.azure.com',     model: 'gpt-4o-mini',                 keyUrl: 'https://github.com/settings/tokens',       keyNote: 'azureHint' },
  { id: 'ollama',     label: 'Ollama',       recommended: false, url: 'http://localhost:11434/v1',                  model: 'llama3.2',                    keyUrl: null,                                       keyNote: null },
  { id: 'custom',     label: '···',          recommended: false, url: '',                                           model: '',                            keyUrl: null,                                       keyNote: 'customHint' },
];

type ApiFn = (method: string, path: string, body?: any, opts?: { silent?: boolean; noRetry?: boolean }) => Promise<any>;

type TitleKey = 'titleUser' | 'titleOrg' | 'titleProject';

const CASCADE_LEVELS: TitleKey[] = ['titleProject', 'titleOrg', 'titleUser'];
const CASCADE_LABEL_KEYS = ['cascadeProject', 'cascadeOrg', 'cascadeUser'] as const;
const CASCADE_BADGES = ['①', '②', '③'];

interface Props {
  api: ApiFn;
  configPath: string;
  titleKey: TitleKey;
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
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await api('GET', configPath, undefined, { silent: true, noRetry: true });
      const url = cfg?.ai_base_url ?? '';
      const model = cfg?.ai_model ?? '';
      setAiBaseUrl(url);
      setAiApiKey(cfg?.ai_api_key ?? '');
      setAiModel(model);
      setSttBaseUrl(cfg?.stt_base_url ?? '');
      setSttApiKey(cfg?.stt_api_key ?? '');
      setSttModel(cfg?.stt_model ?? '');
      const match = PRESETS.find(p => p.url === url && p.model === model);
      setActivePresetId(match?.id ?? null);
    } catch {}
    finally { setLoading(false); }
  }, [api, configPath]);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setAiBaseUrl(preset.url);
    setAiModel(preset.model);
    setActivePresetId(preset.id);
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
          <View style={s.titleRow}>
            <Text style={s.sectionLabel}>{t(`aiConfig.${titleKey}`).toUpperCase()}</Text>
            <Text style={s.priorityBadge}>
              {CASCADE_BADGES[CASCADE_LEVELS.indexOf(titleKey)]}
            </Text>
          </View>
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
          {/* Cascade priority visual */}
          <View style={s.cascadeBox}>
            <Text style={s.cascadeLabel}>{t('aiConfig.cascadeLabel')}</Text>
            <View style={s.cascadeRow}>
              {CASCADE_LEVELS.map((level, i) => {
                const active = level === titleKey;
                return (
                  <View key={level} style={s.cascadeItem}>
                    <View style={[s.cascadeChip, active && s.cascadeChipActive]}>
                      <Text style={[s.cascadeBadge, active && s.cascadeBadgeActive]}>{CASCADE_BADGES[i]}</Text>
                      <Text style={[s.cascadeChipText, active && s.cascadeChipTextActive]}>
                        {t(`aiConfig.${CASCADE_LABEL_KEYS[i]}`)}
                      </Text>
                    </View>
                    {i < CASCADE_LEVELS.length - 1 && (
                      <Text style={s.cascadeArrow}>›</Text>
                    )}
                  </View>
                );
              })}
            </View>
            <Text style={s.cascadeNote}>{t('aiConfig.cascadeNote')}</Text>
          </View>
          {/* Pilules presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillsRow} contentContainerStyle={s.pillsContent}>
            {PRESETS.map(p => {
              const active = activePresetId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.pill, active && s.pillActive, p.recommended && s.pillRecommended]}
                  onPress={() => applyPreset(p)}
                  accessibilityRole='button'
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.pillText, active && s.pillTextActive, p.recommended && !active && s.pillTextRecommended]}>
                    {p.recommended ? '★ ' : ''}{p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.fieldLabel}>{t('aiConfig.llmBaseUrl')}</Text>
          <TextInput style={s.input} value={aiBaseUrl} onChangeText={setAiBaseUrl}
            placeholder="https://api.openai.com/v1" placeholderTextColor="#A0A098"
            autoCapitalize="none" keyboardType="url" accessibilityLabel='AI server address' />

          <Text style={s.fieldLabel}>{t('aiConfig.apiKey')}</Text>
          <TextInput style={s.input} value={aiApiKey} onChangeText={setAiApiKey}
            placeholder="sk-..." placeholderTextColor="#A0A098"
            autoCapitalize="none" secureTextEntry accessibilityLabel='API key' />

          {/* Bandeau clé API contextuel selon preset */}
          {(() => {
            const preset = PRESETS.find(p => p.id === activePresetId);
            if (!preset || preset.id === 'custom') return null;
            if (preset.keyUrl === null) {
              return (
                <View style={s.keyHintLocal}>
                  <Feather name="check-circle" size={13} color="#16A34A" />
                  <Text style={s.keyHintLocalText}>{t('aiConfig.apiKeyHintLocal')}</Text>
                </View>
              );
            }
            const noteText = preset.keyNote ? t(`aiConfig.${preset.keyNote}`) : null;
            return (
              <View>
                {noteText && (
                  <View style={s.keyHintNote}>
                    <Feather name="info" size={13} color="#2563EB" />
                    <Text style={s.keyHintNoteText}>{noteText}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={s.keyHintBtn}
                  onPress={() => Linking.openURL(preset.keyUrl!)}
                  accessibilityRole="link"
                >
                  <Feather name="key" size={13} color={BRAND} />
                  <Text style={s.keyHintBtnText}>{t('aiConfig.apiKeyHint')} {preset.label}</Text>
                  <Feather name="external-link" size={12} color={BRAND} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            );
          })()}

          <Text style={s.fieldLabel}>{t('aiConfig.llmModel')}</Text>
          <TextInput style={s.input} value={aiModel} onChangeText={setAiModel}
            placeholder="gpt-4o" placeholderTextColor="#A0A098" autoCapitalize="none" accessibilityLabel='AI model' />

          <View style={s.sectionSep}>
            <Text style={s.sectionSepText}>{t('aiConfig.sttSection')}</Text>
            <Text style={s.sectionSepDesc}>{t('aiConfig.sttSectionDesc')}</Text>
          </View>

          <Text style={s.fieldLabel}>{t('aiConfig.sttBaseUrl')}</Text>
          <TextInput style={s.input} value={sttBaseUrl} onChangeText={setSttBaseUrl}
            placeholder={t('aiConfig.sttBaseUrlPlaceholder')} placeholderTextColor="#A0A098"
            autoCapitalize="none" keyboardType="url" accessibilityLabel='Voice server address' />

          <Text style={s.fieldLabel}>{t('aiConfig.sttApiKey')}</Text>
          <TextInput style={s.input} value={sttApiKey} onChangeText={setSttApiKey}
            placeholder={t('aiConfig.sttApiKeyPlaceholder')} placeholderTextColor="#A0A098"
            autoCapitalize="none" secureTextEntry accessibilityLabel='Voice API key' />

          <Text style={s.fieldLabel}>{t('aiConfig.sttModel')}</Text>
          <TextInput style={s.input} value={sttModel} onChangeText={setSttModel}
            placeholder="whisper-1" placeholderTextColor="#A0A098" autoCapitalize="none" accessibilityLabel='Voice model' />

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
  sectionHead:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63' },
  priorityBadge:    { fontSize: 14, color: '#8A8A80' },
  subtitle:         { fontSize: 11, color: '#8A8A80', marginTop: 2 },
  right:            { flexDirection: 'row', alignItems: 'center' },
  dot:              { width: 8, height: 8, borderRadius: 4 },
  form:             { marginTop: 12 },
  cascadeBox:       { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 12, marginBottom: 14 },
  cascadeLabel:     { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#8A8A80', marginBottom: 8 },
  cascadeRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cascadeItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cascadeChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1.5, borderColor: '#DDDDD8', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4 },
  cascadeChipActive:{ borderColor: BRAND, backgroundColor: '#FFF5F5' },
  cascadeBadge:     { fontSize: 12, color: '#8A8A80' },
  cascadeBadgeActive:{ color: BRAND },
  cascadeChipText:  { fontSize: 11, fontWeight: '600', color: '#6B6B63' },
  cascadeChipTextActive:{ color: BRAND, fontWeight: '700' },
  cascadeArrow:     { fontSize: 16, color: '#BEBEB8', marginHorizontal: 2 },
  cascadeNote:      { fontSize: 10, color: '#8A8A80', lineHeight: 14 },
  pillsRow:      { marginBottom: 4 },
  pillsContent:  { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  pill:                { borderRadius: 20, borderWidth: 1.5, borderColor: '#EBEBEB', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  pillActive:          { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  pillRecommended:     { borderColor: '#D4A900', backgroundColor: '#FFFBEB' },
  pillText:            { fontSize: 12, fontWeight: '600', color: '#6B6B63' },
  pillTextActive:      { color: BRAND },
  pillTextRecommended: { color: '#92700A' },
  fieldLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#8A8A80', marginTop: 10, marginBottom: 4 },
  sectionSep:        { marginTop: 16, marginBottom: 4, borderTopWidth: 1, borderColor: '#F0F0EC', paddingTop: 12 },
  sectionSepText:    { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#A0A098', marginBottom: 4 },
  sectionSepDesc:    { fontSize: 11, color: '#8A8A80', lineHeight: 16 },
  keyHintBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, borderWidth: 1, borderColor: '#F0CECE' },
  keyHintBtnText:    { fontSize: 12, fontWeight: '600', color: BRAND, flex: 1 },
  keyHintLocal:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, borderWidth: 1, borderColor: '#BBF7D0' },
  keyHintLocalText:  { fontSize: 12, color: '#16A34A', fontWeight: '500', flex: 1 },
  keyHintNote:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  keyHintNoteText:   { fontSize: 12, color: '#1D4ED8', flex: 1, lineHeight: 17 },
  input:         { fontSize: 14, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  actions:       { flexDirection: 'row', gap: 8, marginTop: 12 },
  saveBtn:       { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn:     { borderWidth: 1.5, borderColor: '#F0CECE', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  deleteBtnText: { color: BRAND, fontSize: 14, fontWeight: '600' },
});
