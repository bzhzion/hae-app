import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Marked from 'react-native-marked';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useStt } from '../hooks/useStt';
import { useAiConfig } from '../hooks/useAiConfig';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { showToast } from '../stores/toast';
import { makeApi } from '../lib/api';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/project';
import { resolveAiConfig } from '../lib/aiConfig';

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#A00000'];

function CalendarPicker({ value, onChange, onClear, onCancel }: {
  value: number | null;
  onChange: (ts: number) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const init = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [selDate, setSelDate] = useState<Date | null>(value ? new Date(value) : null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const today = new Date();

  const isSelected = (d: number) => selDate
    && selDate.getFullYear() === viewYear
    && selDate.getMonth() === viewMonth
    && selDate.getDate() === d;

  const isToday = (d: number) =>
    today.getFullYear() === viewYear
    && today.getMonth() === viewMonth
    && today.getDate() === d;

  const pick = (d: number) => {
    const dt = new Date(viewYear, viewMonth, d, 12, 0, 0);
    setSelDate(dt);
    onChange(dt.getTime());
  };

  return (
    <View>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn} accessibilityLabel="Previous month" accessibilityRole="button">
          <Text style={cal.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{monthNames[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn} accessibilityLabel="Next month" accessibilityRole="button">
          <Text style={cal.navArrow}>›</Text>
        </TouchableOpacity>
      </View>
      <View>
        <View style={cal.row}>
          {DAY_NAMES.map((d, i) => (
            <Text key={i} style={cal.dayName}>{d}</Text>
          ))}
        </View>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => (
          <View key={w} style={cal.row}>
            {cells.slice(w * 7, w * 7 + 7).map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[cal.cell, d && isSelected(d) ? cal.cellSel : undefined, d && isToday(d) && !isSelected(d) ? cal.cellToday : undefined]}
                onPress={() => d && pick(d)}
                activeOpacity={d ? 0.6 : 1}
                disabled={!d}
                accessibilityRole="button"
                accessibilityState={{ selected: !!(d && isSelected(d)) }}
                accessibilityLabel={d ? `${d} ${monthNames[viewMonth]} ${viewYear}` : undefined}
              >
                <Text style={[cal.cellText, d && isSelected(d) ? cal.cellTextSel : undefined, d && isToday(d) && !isSelected(d) ? cal.cellTextToday : undefined]}>
                  {d ?? ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
      <View style={[s.editRow, { marginTop: 16 }]}>
        {selDate && (
          <TouchableOpacity style={s.saveBtn} onPress={() => selDate && onChange(selDate.getTime())}>
            <Text style={s.saveBtnText}>Confirmer</Text>
          </TouchableOpacity>
        )}
        {value && (
          <TouchableOpacity style={s.cancelBtn} onPress={onClear}>
            <Text style={[s.cancelBtnText, { color: BRAND }]}>Effacer</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Card {
  id: string; title: string; description?: string;
  due_date?: number | null; stopwatch_total?: number;
  stopwatch_started_at?: number | null; column_id?: string; project_id?: string;
}
interface Label { id: string; name: string; color: string; }
interface Member { id: string; name: string; avatar_url?: string; }
interface ChecklistItem { id: string; text: string; is_done: number; }
interface Checklist { id: string; title: string; items: ChecklistItem[]; }
interface Comment { id: string; content: string; user_id: string; created_at: number; user_name?: string; }
interface Attachment { id: string; filename: string; size: number; mime_type: string; created_at: number; }
interface CardDetail extends Card {
  labels: Label[]; members: Member[]; checklists: Checklist[]; attachments: Attachment[]; is_subscribed?: boolean;
}
interface Column { id: string; name: string; type: string; }

interface Props {
  card: Card | null;
  expandAnim: Animated.Value;
  token: string;
  serverUrl: string;
  projectId: string;
  insets: { top: number; bottom: number };
  onClose: () => void;
  onCardUpdated: (card: Partial<Card> & { id: string }) => void;
  onCardDeleted: (cardId: string) => void;
  onNeedRefetch: () => void;
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.play(); });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 300 }}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function CardDetailSheet({
  card, expandAnim, token, serverUrl, projectId, insets,
  onClose, onCardUpdated, onCardDeleted, onNeedRefetch,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ?? 'fr';
  const { currentProjectOwnerType, currentProjectOwnerId } = useProjectStore();
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [projectMembers, setProjectMembers] = useState<Member[]>([]);
  const [projectColumns, setProjectColumns] = useState<Column[]>([]);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const { state: sttState, toggle: sttToggle } = useStt();
  const { state: sttCommentState, toggle: sttCommentToggle } = useStt();
  const handleDescMic = useCallback(async () => {
    const text = await sttToggle();
    if (text) setDescDraft(prev => prev ? prev + ' ' + text : text);
  }, [sttToggle]);

  const improveDesc = useCallback(async () => {
    if (!descDraft.trim() || !detail) return;
    setImprovingDesc(true);
    try {
      const cfg = await resolveAiConfig(api, projectId, currentProjectOwnerType, currentProjectOwnerId);
      if (!cfg?.ai_base_url || !cfg?.ai_api_key) {
        showToast('Config IA manquante — configure dans les réglages');
        return;
      }
      const prompt = `You are a GTD assistant. Improve this task description: make it clearer, more structured and actionable. Keep Markdown. No commentary, return only the improved description. Respond in language code: ${lang}.\n\nTask title: ${detail.title}\n\nCurrent description:\n${descDraft}`;
      const resp = await fetch(`${cfg.ai_base_url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.ai_api_key}` },
        body: JSON.stringify({ model: cfg.ai_model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1024 }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const improved = data.choices?.[0]?.message?.content?.trim();
      if (improved) setDescDraft(improved);
    } catch {
      showToast('Erreur IA');
    } finally {
      setImprovingDesc(false);
    }
  }, [descDraft, detail, api, projectId]);

  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);

  const { aiReady, sttReady } = useAiConfig();

  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [generatingChecklist, setGeneratingChecklist] = useState(false);
  const [improvingDesc, setImprovingDesc] = useState(false);
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const [swDisplay, setSwDisplay] = useState(0);
  const swInterval = useRef<ReturnType<typeof setInterval> | null>(null);


  const [imageViewerAtt, setImageViewerAtt] = useState<Attachment | null>(null);
  const [videoViewerAtt, setVideoViewerAtt] = useState<Attachment | null>(null);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [loadingAttId, setLoadingAttId] = useState<string | null>(null);
  const [playingAttId, setPlayingAttId] = useState<string | null>(null);
  const soundRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const startSwTick = useCallback((total: number, startedAt: number) => {
    clearInterval(swInterval.current!);
    const base = total + Math.floor((Date.now() - startedAt) / 1000);
    setSwDisplay(base);
    swInterval.current = setInterval(() => setSwDisplay(p => p + 1), 1000);
  }, []);

  const reload = useCallback(async () => {
    if (!card) return;
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        api('GET', `/api/cards/${card.id}`),
        api('GET', `/api/cards/${card.id}/comments`),
      ]);
      setDetail(d);
      setComments(Array.isArray(c) ? c : []);
      if (d.stopwatch_started_at) {
        startSwTick(d.stopwatch_total ?? 0, d.stopwatch_started_at);
      } else {
        clearInterval(swInterval.current!);
        setSwDisplay(d.stopwatch_total ?? 0);
      }
    } catch {}
    finally { setLoading(false); }
  }, [card, api, startSwTick]);

  const loadProjectData = useCallback(async () => {
    try {
      const [labels, proj] = await Promise.all([
        api('GET', `/api/projects/${projectId}/labels`),
        api('GET', `/api/projects/${projectId}`),
      ]);
      setProjectLabels(Array.isArray(labels) ? labels : []);
      setProjectMembers(Array.isArray(proj?.members) ? proj.members : []);
      setProjectColumns(Array.isArray(proj?.columns) ? proj.columns : []);
    } catch {}
  }, [projectId, api]);

  useEffect(() => {
    if (!card) return;
    setDetail(null);
    setComments([]);
    setEditingTitle(false);
    setEditingDesc(false);
    setAddingChecklist(false);
    setAddingItemFor(null);
    setNewComment('');
    reload();
    loadProjectData();
    return () => {
      clearInterval(swInterval.current!);
      if (soundRef.current) { soundRef.current.pause(); soundRef.current.remove(); soundRef.current = null; }
    };
  }, [card?.id]);

  const patchCard = async (fields: Partial<Card>) => {
    if (!card) return;
    try {
      const updated = await api('PATCH', `/api/cards/${card.id}`, fields);
      setDetail(prev => prev ? { ...prev, ...updated } : updated);
      onCardUpdated({ id: card.id, ...updated });
    } catch (e) { Alert.alert('Erreur', String(e)); }
  };

  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (!t) return;
    await patchCard({ title: t });
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await patchCard({ description: descDraft.trim() });
    setEditingDesc(false);
  };

  const createLabel = async () => {
    const name = newLabelName.trim();
    if (!name) return;
    try {
      const label = await api('POST', `/api/projects/${projectId}/labels`, { name, color: newLabelColor });
      setProjectLabels(prev => [...prev, label]);
      setNewLabelName('');
      setNewLabelColor('#6366f1');
      setCreatingLabel(false);
      await toggleLabelById(label);
    } catch {}
  };

  const toggleLabelById = async (label: Label) => {
    if (!detail || !card) return;
    const has = detail.labels.some(l => l.id === label.id);
    if (!has) {
      await api('POST', `/api/cards/${card.id}/labels`, { labelId: label.id });
      const newLabels = [...detail.labels, label];
      setDetail(prev => prev ? { ...prev, labels: newLabels } : prev);
      onCardUpdated({ id: card.id, labels: newLabels } as any);
    }
  };

  const toggleLabel = async (label: Label) => {
    if (!detail || !card) return;
    const has = detail.labels.some(l => l.id === label.id);
    try {
      let newLabels: Label[];
      if (has) {
        await api('DELETE', `/api/cards/${card.id}/labels/${label.id}`);
        newLabels = detail.labels.filter(l => l.id !== label.id);
      } else {
        await api('POST', `/api/cards/${card.id}/labels`, { labelId: label.id });
        newLabels = [...detail.labels, label];
      }
      setDetail(prev => prev ? { ...prev, labels: newLabels } : prev);
      onCardUpdated({ id: card.id, labels: newLabels } as any);
    } catch {}
  };

  const toggleMember = async (member: Member) => {
    if (!detail || !card) return;
    const has = detail.members.some(m => m.id === member.id);
    try {
      if (has) {
        await api('DELETE', `/api/cards/${card.id}/members/${member.id}`);
        setDetail(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== member.id) } : prev);
      } else {
        await api('POST', `/api/cards/${card.id}/members`, { userId: member.id });
        setDetail(prev => prev ? { ...prev, members: [...prev.members, member] } : prev);
      }
    } catch {}
  };

  const addChecklist = async () => {
    if (!newChecklistTitle.trim() || !card) return;
    try {
      const cl = await api('POST', `/api/cards/${card.id}/checklists`, { title: newChecklistTitle.trim() });
      setDetail(prev => prev ? { ...prev, checklists: [...prev.checklists, { ...cl, items: [] }] } : prev);
      setNewChecklistTitle('');
      setAddingChecklist(false);
    } catch {}
  };

  const generateChecklist = useCallback(async () => {
    if (!detail || !card) return;
    setGeneratingChecklist(true);
    try {
      const cfg = await resolveAiConfig(api, projectId, currentProjectOwnerType, currentProjectOwnerId);
      if (!cfg?.ai_base_url || !cfg?.ai_api_key) {
        showToast('Config IA manquante — configure dans les réglages');
        return;
      }
      const labelNames = (detail.labels ?? []).map((l: Label) => l.name).join(', ');
      const prompt = `You are a GTD assistant. Generate a practical checklist for this task. Respond in language code: ${lang}.\n\nTitle: ${detail.title}\nDescription: ${detail.description || 'None'}\nLabels: ${labelNames || 'None'}\n\nRespond ONLY with a JSON object: {"title":"...","items":["...","..."]}. Between 3 and 8 concise, actionable items.`;
      const resp = await fetch(`${cfg.ai_base_url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.ai_api_key}` },
        body: JSON.stringify({ model: cfg.ai_model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, max_tokens: 512 }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      const title: string = parsed.title || detail.title;
      const items: string[] = Array.isArray(parsed.items) ? parsed.items : [];
      if (!items.length) { showToast('L\'IA n\'a pas généré d\'éléments'); return; }
      const cl = await api('POST', `/api/cards/${card.id}/checklists`, { title });
      const createdItems = await Promise.all(items.map((text: string) => api('POST', `/api/checklists/${cl.id}/items`, { text })));
      const fullCl = { ...cl, items: createdItems };
      setDetail(prev => {
        if (!prev) return prev;
        const newChecklists = [...prev.checklists, fullCl];
        const allItems = newChecklists.flatMap(c => c.items);
        onCardUpdated({ id: prev.id, checklist_total: allItems.length, checklist_done: allItems.filter((i: ChecklistItem) => i.is_done).length });
        return { ...prev, checklists: newChecklists };
      });
    } catch (e: any) {
      showToast('Erreur IA');
    } finally {
      setGeneratingChecklist(false);
    }
  }, [detail, card, api, projectId, onCardUpdated]);

  const deleteChecklist = (clId: string) => {
    Alert.alert('Supprimer', 'Supprimer cette checklist ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await api('DELETE', `/api/checklists/${clId}`);
        setDetail(prev => {
          if (!prev) return prev;
          const newChecklists = prev.checklists.filter(c => c.id !== clId);
          const allItems = newChecklists.flatMap(cl => cl.items);
          onCardUpdated({ id: prev.id, checklist_total: allItems.length, checklist_done: allItems.filter(i => i.is_done).length });
          return { ...prev, checklists: newChecklists };
        });
      }},
    ]);
  };

  const addItem = async (clId: string) => {
    if (!newItemText.trim()) return;
    try {
      const item = await api('POST', `/api/checklists/${clId}/items`, { text: newItemText.trim() });
      setDetail(prev => {
        if (!prev) return prev;
        const newChecklists = prev.checklists.map(cl => cl.id === clId ? { ...cl, items: [...cl.items, item] } : cl);
        const allItems = newChecklists.flatMap(cl => cl.items);
        onCardUpdated({ id: prev.id, checklist_total: allItems.length, checklist_done: allItems.filter(i => i.is_done).length });
        return { ...prev, checklists: newChecklists };
      });
      setNewItemText('');
      setAddingItemFor(null);
    } catch {}
  };

  const toggleItem = async (clId: string, item: ChecklistItem) => {
    try {
      const updated = await api('PATCH', `/api/items/${item.id}`, { is_done: item.is_done ? 0 : 1 });
      setDetail(prev => {
        if (!prev) return prev;
        const newChecklists = prev.checklists.map(cl => cl.id === clId ? {
          ...cl, items: cl.items.map(i => i.id === item.id ? { ...i, is_done: updated.is_done } : i),
        } : cl);
        const allItems = newChecklists.flatMap(cl => cl.items);
        onCardUpdated({
          id: prev.id,
          checklist_total: allItems.length,
          checklist_done: allItems.filter(i => i.is_done).length,
        });
        return { ...prev, checklists: newChecklists };
      });
    } catch {}
  };

  const deleteItem = async (clId: string, itemId: string) => {
    try {
      await api('DELETE', `/api/items/${itemId}`);
      setDetail(prev => {
        if (!prev) return prev;
        const newChecklists = prev.checklists.map(cl => cl.id === clId ? {
          ...cl, items: cl.items.filter(i => i.id !== itemId),
        } : cl);
        const allItems = newChecklists.flatMap(cl => cl.items);
        onCardUpdated({ id: prev.id, checklist_total: allItems.length, checklist_done: allItems.filter(i => i.is_done).length });
        return { ...prev, checklists: newChecklists };
      });
    } catch {}
  };

  const uploadAttachment = async () => {
    if (!card) return;
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAtt(true);
    try {
      if (!asset.mimeType) {
        Alert.alert('Erreur', 'Type de fichier non reconnu');
        setUploadingAtt(false);
        return;
      }
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType } as any);
      const r = await fetch(`${serverUrl}/api/cards/${card.id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!r.ok) throw new Error(await r.text());
      const att = await r.json();
      setDetail(prev => prev ? { ...prev, attachments: [...(prev.attachments ?? []), att] } : prev);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Upload échoué');
    } finally {
      setUploadingAtt(false);
    }
  };

  const downloadAttachment = async (att: Attachment) => {
    const url = `${serverUrl}/api/attachments/${att.id}/download`;
    const safeName = att.filename.replace(/[/\\]/g, '_').replace(/\.\./g, '__');
    const localUri = `${FileSystem.cacheDirectory}${safeName}`;
    try {
      const dl = await FileSystem.downloadAsync(url, localUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dl.uri, { dialogTitle: att.filename });
      } else {
        Alert.alert('Téléchargé', `Fichier : ${att.filename}`);
      }
    } catch {
      Alert.alert('Erreur', 'Téléchargement échoué');
    }
  };

  const deleteAttachment = (attId: string) => {
    Alert.alert('Supprimer', 'Supprimer cette pièce jointe ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await api('DELETE', `/api/attachments/${attId}`);
          setDetail(prev => prev ? { ...prev, attachments: (prev.attachments ?? []).filter(a => a.id !== attId) } : prev);
        } catch {}
      }},
    ]);
  };

  const stopAudio = () => {
    if (soundRef.current) {
      soundRef.current.pause();
      soundRef.current.remove();
      soundRef.current = null;
    }
    setPlayingAttId(null);
  };

  const toggleAudio = async (att: Attachment) => {
    if (playingAttId === att.id) { stopAudio(); return; }
    stopAudio();
    setLoadingAttId(att.id);
    try {
      const localUri = `${FileSystem.cacheDirectory}${att.id}_${att.filename}`;
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        await FileSystem.downloadAsync(`${serverUrl}/api/attachments/${att.id}/download`, localUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await setAudioModeAsync({ playsInSilentMode: true });
      const player = createAudioPlayer({ uri: localUri });
      soundRef.current = player;
      player.play();
      setPlayingAttId(att.id);
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          soundRef.current = null;
          setPlayingAttId(null);
        }
      });
    } catch { Alert.alert('Erreur', 'Lecture impossible'); }
    finally { setLoadingAttId(null); }
  };

  const openVideo = async (att: Attachment) => {
    await stopAudio();
    setLoadingAttId(att.id);
    try {
      const localUri = `${FileSystem.cacheDirectory}${att.id}_${att.filename}`;
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        await FileSystem.downloadAsync(`${serverUrl}/api/attachments/${att.id}/download`, localUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setVideoViewerAtt({ ...att, filename: localUri });
    } catch { Alert.alert('Erreur', 'Chargement impossible'); }
    finally { setLoadingAttId(null); }
  };

  const handleCommentMic = async () => {
    const text = await sttCommentToggle();
    if (text) setNewComment(prev => prev ? `${prev} ${text}` : text);
  };

  const postComment = async () => {
    if (!newComment.trim() || !card) return;
    setSendingComment(true);
    try {
      const c = await api('POST', `/api/cards/${card.id}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, c]);
      setNewComment('');
    } catch {}
    finally { setSendingComment(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api('DELETE', `/api/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const saveEditComment = async () => {
    if (!editCommentId || !editCommentText.trim()) return;
    try {
      await api('PATCH', `/api/comments/${editCommentId}`, { content: editCommentText.trim() });
      setComments(prev => prev.map(c => c.id === editCommentId ? { ...c, content: editCommentText.trim() } : c));
      setEditCommentId(null);
      setEditCommentText('');
    } catch (e: any) {
      if (e?.message !== '401') showToast('Impossible de sauvegarder');
    }
  };

  const startStopwatch = async () => {
    if (!card) return;
    try {
      await api('POST', `/api/cards/${card.id}/stopwatch/start`);
      const now = Date.now();
      startSwTick(swDisplay, now - swDisplay * 1000);
      setDetail(prev => prev ? { ...prev, stopwatch_started_at: now } : prev);
    } catch {}
  };

  const stopStopwatch = async () => {
    if (!card) return;
    clearInterval(swInterval.current!);
    try {
      const r = await api('POST', `/api/cards/${card.id}/stopwatch/stop`);
      setSwDisplay(r.total);
      setDetail(prev => prev ? { ...prev, stopwatch_started_at: null, stopwatch_total: r.total } : prev);
    } catch {}
  };

  const trashColId = projectColumns.find(c => c.type === 'gtd_trash')?.id ?? null;
  const isInTrash = !!card && !!trashColId && card.column_id === trashColId;

  const archiveCard = () => {
    Alert.alert('Archiver', 'Archiver cette carte ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Archiver', style: 'destructive', onPress: async () => {
        if (!card) return;
        try {
          if (trashColId) {
            await api('PATCH', `/api/cards/${card.id}`, { column_id: trashColId });
          } else {
            await api('DELETE', `/api/cards/${card.id}`);
          }
          onCardDeleted(card.id);
          onClose();
        } catch (e) { Alert.alert('Erreur', String(e)); }
      }},
    ]);
  };

  const deleteCardPermanently = () => {
    Alert.alert(
      '⚠️ Suppression définitive',
      'Cette action est irréversible. La carte sera supprimée pour toujours.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer définitivement', style: 'destructive', onPress: async () => {
          if (!card) return;
          try {
            await api('DELETE', `/api/cards/${card.id}`);
            onCardDeleted(card.id);
            onClose();
          } catch (e) { Alert.alert('Erreur', String(e)); }
        }},
      ]
    );
  };

  const moveCard = async (columnId: string) => {
    setShowMovePicker(false);
    if (!card) return;
    try {
      await api('PATCH', `/api/cards/${card.id}`, { column_id: columnId });
      onNeedRefetch();
      onClose();
    } catch (e) { Alert.alert('Erreur', String(e)); }
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isRunning = !!detail?.stopwatch_started_at;
  const dueDate = detail?.due_date ?? card?.due_date;
  const isDueOverdue = dueDate ? dueDate < Date.now() : false;

  if (!card) return null;

  return (
    <Animated.View style={[s.overlay, {
      opacity: expandAnim,
      transform: [{ scale: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }],
    }]}>
<View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.topAction} onPress={() => setShowMovePicker(true)} accessibilityRole="button">
          <Text style={s.topActionText}>Deplacer</Text>
        </TouchableOpacity>
        {isInTrash ? (
          <TouchableOpacity style={[s.topAction, s.topActionDanger]} onPress={deleteCardPermanently} accessibilityRole="button">
            <Text style={[s.topActionText, { color: BRAND }]}>⚠ Supprimer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.topAction, s.topActionDanger]} onPress={archiveCard} accessibilityRole="button">
            <Text style={[s.topActionText, { color: BRAND }]}>Archiver</Text>
          </TouchableOpacity>
        )}
      </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Labels */}
          <View style={s.labelsRow}>
            {(detail?.labels ?? []).map(l => (
              <TouchableOpacity
                key={l.id}
                style={[s.labelChip, { backgroundColor: l.color + '22', borderColor: l.color + '55' }]}
                onPress={() => toggleLabel(l)}
                accessibilityLabel={'Remove label ' + l.name}
                accessibilityRole="button"
              >
                <Text style={[s.labelChipText, { color: l.color }]}>{l.name}</Text>
                <Text style={[s.labelChipX, { color: l.color + 'AA' }]}>x</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.addChip} onPress={() => setShowLabelPicker(true)} accessibilityRole="button" accessibilityLabel="Add label">
              <Text style={s.addChipText}>+ Label</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          {editingTitle ? (
            <View style={s.editBlock}>
              <TextInput
                style={s.titleInput}
                value={titleDraft}
                onChangeText={setTitleDraft}
                autoFocus
                multiline
              />
              <View style={s.editRow}>
                <TouchableOpacity style={s.saveBtn} onPress={saveTitle}>
                  <Text style={s.saveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingTitle(false)}>
                  <Text style={s.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity activeOpacity={0.7} onPress={() => { setTitleDraft(detail?.title ?? card.title); setEditingTitle(true); }} accessibilityHint="Tap to edit title" accessibilityRole="button">
              <Text style={s.title}>{detail?.title ?? card.title}</Text>
            </TouchableOpacity>
          )}

          {/* Meta: due date + stopwatch */}
          <View style={s.metaRow}>
            <TouchableOpacity style={[s.metaBadge, isDueOverdue && s.metaBadgeOverdue]} onPress={() => setShowDuePicker(true)} accessibilityLabel={dueDate ? 'Due: ' + new Date(dueDate).toLocaleDateString() : 'Set due date'} accessibilityRole="button">
              <Text style={s.metaIcon}>📅</Text>
              <Text style={[s.metaText, isDueOverdue && { color: BRAND }]}>
                {dueDate
                  ? new Date(dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : 'Echeance'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.metaBadge, isRunning && s.metaBadgeRunning]}
              onPress={isRunning ? stopStopwatch : startStopwatch}
              accessibilityLabel={isRunning ? 'Stop stopwatch' : 'Start stopwatch'}
              accessibilityRole="button"
            >
              <Text style={s.metaIcon}>{isRunning ? '⏹' : '▶'}</Text>
              <Text style={[s.metaText, isRunning && { color: BRAND }]}>{fmt(swDisplay)}</Text>
            </TouchableOpacity>
          </View>

          {/* Members */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>MEMBRES</Text>
              <TouchableOpacity onPress={() => setShowMemberPicker(true)} accessibilityLabel="Add member" accessibilityRole="button">
                <Text style={s.sectionPlus}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={s.membersRow}>
              {(detail?.members ?? []).map(m => (
                <TouchableOpacity key={m.id} style={s.avatar} onPress={() => toggleMember(m)} accessibilityLabel={'Remove ' + m.name} accessibilityRole="button">
                  <Text style={s.avatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
              {(detail?.members ?? []).length === 0 && (
                <Text style={s.dimText}>Aucun membre</Text>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={[s.section, { paddingBottom: 16 }]}>
            <Text style={s.sectionLabel}>DESCRIPTION</Text>
            {editingDesc ? (
              <View style={s.editBlock}>
                {/* Markdown toolbar */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mdToolbar} contentContainerStyle={s.mdToolbarContent}>
                  {([
                    { label: 'B',   wrap: ['**','**'] },
                    { label: 'I',   wrap: ['_','_'] },
                    { label: '`',   wrap: ['`','`'] },
                    { label: 'H1',  line: '# ' },
                    { label: 'H2',  line: '## ' },
                    { label: '- ',  line: '- ' },
                    { label: '1.',  line: '1. ' },
                    { label: '> ',  line: '> ' },
                  ] as any[]).map((t) => (
                    <TouchableOpacity
                      key={t.label}
                      style={s.mdBtn}
                      onPress={() => {
                        if (t.wrap) {
                          setDescDraft(d => d + t.wrap[0] + 'texte' + t.wrap[1]);
                        } else if (t.line) {
                          setDescDraft(d => d + (d.endsWith('\n') || d === '' ? '' : '\n') + t.line);
                        }
                      }}
                    >
                      <Text style={s.mdBtnText}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={s.descInput}
                  value={descDraft}
                  onChangeText={setDescDraft}
                  multiline
                  autoFocus
                  placeholder="Ajouter une description (Markdown supporté)..."
                  placeholderTextColor="#A0A098"
                />
                <View style={s.editRow}>
                  <TouchableOpacity style={s.saveBtn} onPress={saveDesc}>
                    <Text style={s.saveBtnText}>Enregistrer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingDesc(false)}>
                    <Text style={s.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.micBtnDesc, sttState === 'recording' && s.micBtnDescActive, !sttReady && s.aiDisabled]} onPress={handleDescMic} disabled={!sttReady} accessibilityLabel="Dicter">
                    {sttState === 'transcribing'
                      ? <ActivityIndicator size="small" color="#A00000" />
                      : <Ionicons name="mic" size={14} color={sttState === 'recording' ? '#fff' : (!sttReady ? '#C8C8C0' : '#A00000')} />}
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.wandBtn, (!descDraft.trim() || improvingDesc || !aiReady) && { opacity: 0.4 }]} onPress={improveDesc} disabled={!descDraft.trim() || improvingDesc || !aiReady} accessibilityLabel="Améliorer avec IA">
                    {improvingDesc
                      ? <ActivityIndicator size="small" color={BRAND} />
                      : <Ionicons name="color-wand-outline" size={14} color={BRAND} />}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity activeOpacity={0.85} onPress={() => { setDescDraft(detail?.description ?? ''); setEditingDesc(true); }} accessibilityHint="Tap to edit description" accessibilityRole="button">
                {detail?.description ? (
                  <View style={s.descCard}>
                    <Marked
                      value={detail.description}
                      flatListProps={{ scrollEnabled: false, style: { backgroundColor: 'transparent' } }}
                      theme={{ colors: { text: '#3A3A36', link: '#A00000', code: '#E8E8E4', border: '#D8D8D4' } }}
                      styles={{
                        text:       { fontSize: 13, color: '#3A3A36', lineHeight: 19 },
                        paragraph:  { marginBottom: 4 },
                        h1:         { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
                        h2:         { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
                        h3:         { fontSize: 14, fontWeight: '600', color: '#2A2A2A' },
                        h4:         { fontSize: 13, fontWeight: '600', color: '#3A3A36' },
                        h5:         { fontSize: 13, fontWeight: '600', color: '#4A4A44' },
                        h6:         { fontSize: 12, fontWeight: '600', color: '#6A6A64' },
                        codespan:   { fontSize: 11, backgroundColor: '#EEEEE8', borderRadius: 3 },
                        code:       { backgroundColor: '#EEEEE8', borderRadius: 6, padding: 8 },
                        blockquote: { borderLeftWidth: 2, borderLeftColor: '#D0D0C8', paddingLeft: 8, backgroundColor: 'transparent' },
                        strong:     { fontWeight: '700', color: '#1A1A1A' },
                        em:         { fontStyle: 'italic', color: '#4A4A44' },
                        li:         { fontSize: 13, color: '#3A3A36', lineHeight: 19 },
                      }}
                    />
                  </View>
                ) : (
                  <Text style={s.dimText}>Appuyer pour ajouter une description...</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Checklists */}
          {loading && !detail && <ActivityIndicator color={BRAND} style={{ marginVertical: 16 }} accessibilityLabel="Loading" />}
          {(detail?.checklists ?? []).map(cl => {
            const done = cl.items.filter(i => i.is_done).length;
            const total = cl.items.length;
            const pct = total > 0 ? done / total : 0;
            return (
              <View key={cl.id} style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={s.sectionLabel}>{cl.title.toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={s.clProgress}>{done}/{total}</Text>
                    <TouchableOpacity onPress={() => deleteChecklist(cl.id)} accessibilityLabel={'Delete checklist ' + cl.title} accessibilityRole="button">
                      <Text style={s.xBtn}>x</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.clBar}>
                  <View style={[s.clFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                </View>
                {cl.items.map(item => (
                  <View key={item.id} style={s.clItem}>
                    <TouchableOpacity
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 2 }}
                      style={[s.clCheck, !!item.is_done && s.clCheckDone]}
                      onPress={() => toggleItem(cl.id, item)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: !!item.is_done }}
                      accessibilityLabel={item.text}
                    >
                      {!!item.is_done && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} pointerEvents="none">
                      <Text style={[s.clText, !!item.is_done && s.clTextDone]} numberOfLines={0}>{item.text}</Text>
                    </View>
                    <TouchableOpacity hitSlop={{ top: 4, bottom: 4, left: 8, right: 4 }} onPress={() => deleteItem(cl.id, item.id)} accessibilityLabel={'Delete ' + item.text} accessibilityRole="button">
                      <Text style={s.xBtn}>x</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {addingItemFor === cl.id ? (
                  <View style={s.addItemRow}>
                    <TextInput
                      style={s.addItemInput}
                      value={newItemText}
                      onChangeText={setNewItemText}
                      placeholder="Nouvel element..."
                      placeholderTextColor="#A0A098"
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => addItem(cl.id)}
                    />
                    <TouchableOpacity style={s.saveSmallBtn} onPress={() => addItem(cl.id)}>
                      <Text style={s.saveSmallText}>OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setAddingItemFor(null); setNewItemText(''); }}>
                      <Text style={s.xBtn}>x</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.addSubBtn} onPress={() => { setAddingItemFor(cl.id); setNewItemText(''); }}>
                    <Text style={s.addSubBtnText}>+ Element</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Add checklist */}
          {addingChecklist ? (
            <View style={[s.section, { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 12 }]}>
              <TextInput
                style={s.addClInput}
                value={newChecklistTitle}
                onChangeText={setNewChecklistTitle}
                placeholder="Titre de la checklist..."
                placeholderTextColor="#A0A098"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={addChecklist}
              />
              <View style={s.editRow}>
                <TouchableOpacity style={s.saveBtn} onPress={addChecklist}>
                  <Text style={s.saveBtnText}>Creer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setAddingChecklist(false); setNewChecklistTitle(''); }}>
                  <Text style={s.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[s.section, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <TouchableOpacity style={s.addSubBtn} onPress={() => setAddingChecklist(true)}>
                <Text style={s.addSubBtnText}>+ Checklist</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.wandBtn, (generatingChecklist || !aiReady) && { opacity: 0.4 }]} onPress={generateChecklist} disabled={generatingChecklist || !aiReady} accessibilityLabel="Générer checklist avec IA">
                {generatingChecklist
                  ? <ActivityIndicator size="small" color={BRAND} />
                  : <Ionicons name="color-wand-outline" size={14} color={BRAND} />}
              </TouchableOpacity>
            </View>
          )}

          {/* Attachments */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>PIÈCES JOINTES{(detail?.attachments?.length ?? 0) > 0 ? ` (${detail!.attachments.length})` : ''}</Text>
              <TouchableOpacity onPress={uploadAttachment} disabled={uploadingAtt} accessibilityLabel="Add attachment" accessibilityRole="button">
                {uploadingAtt
                  ? <ActivityIndicator size="small" color={BRAND} accessibilityLabel="Uploading" />
                  : <Text style={s.sectionPlus}>+</Text>
                }
              </TouchableOpacity>
            </View>
            {(detail?.attachments ?? []).map(att => {
              const isImage = att.mime_type.startsWith('image/');
              if (isImage) {
                return (
                  <View key={att.id} style={s.attImageWrap}>
                    <TouchableOpacity onPress={() => setImageViewerAtt(att)} activeOpacity={0.9} accessibilityLabel={'View image ' + att.filename} accessibilityRole="button">
                      <Image
                        source={{ uri: `${serverUrl}/api/attachments/${att.id}/download`, headers: { Authorization: `Bearer ${token}` } }}
                        style={s.attImage}
                        resizeMode="cover"
                        accessibilityLabel={att.filename}
                      />
                    </TouchableOpacity>
                    <View style={s.attImageFooter}>
                      <Text style={s.attFilename} numberOfLines={1}>{att.filename}</Text>
                      <TouchableOpacity onPress={() => deleteAttachment(att.id)} accessibilityLabel={'Delete ' + att.filename} accessibilityRole="button">
                        <Text style={s.xBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }
              const ext = att.filename.split('.').pop()?.toLowerCase() ?? '';
              const AUDIO_EXTS = new Set(['mp3','m4a','aac','ogg','flac','wav','opus']);
              const VIDEO_EXTS = new Set(['mp4','mov','webm','mkv','avi']);
              const isAudio = att.mime_type.startsWith('audio/') || AUDIO_EXTS.has(ext);
              const isVideo = att.mime_type.startsWith('video/') || VIDEO_EXTS.has(ext);
              const isLoading = loadingAttId === att.id;
              const isPlaying = playingAttId === att.id;
              const iconName = att.mime_type === 'application/pdf' ? 'document-text-outline'
                : isAudio ? 'musical-notes-outline'
                : isVideo ? 'film-outline'
                : 'attach-outline';
              const onChipPress = isAudio ? () => toggleAudio(att)
                : isVideo ? () => openVideo(att)
                : () => downloadAttachment(att);
              return (
                <TouchableOpacity key={att.id} style={s.attChip} onPress={onChipPress} disabled={isLoading} accessibilityLabel={isAudio ? (isPlaying ? 'Pause ' + att.filename : 'Play ' + att.filename) : isVideo ? 'Play video ' + att.filename : 'Download ' + att.filename} accessibilityRole="button">
                  {isLoading
                    ? <ActivityIndicator size="small" color={BRAND} style={{ width: 20 }} accessibilityLabel="Loading file" />
                    : isPlaying
                      ? <Ionicons name="pause-circle-outline" size={20} color={BRAND} />
                      : <Ionicons name={iconName} size={20} color="#6B6B63" />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={s.attChipName} numberOfLines={1}>{att.filename}</Text>
                    <Text style={s.attChipSize}>{(att.size / 1024).toFixed(0)} Ko{isPlaying ? ' · lecture...' : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => downloadAttachment(att)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={'Download ' + att.filename} accessibilityRole="button">
                    <Ionicons name="download-outline" size={16} color="#8A8A80" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAttachment(att.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={'Delete ' + att.filename} accessibilityRole="button">
                    <Text style={s.xBtn}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            {(detail?.attachments?.length === 0 || !detail?.attachments) && !uploadingAtt && (
              <Text style={s.dimText}>Aucune pièce jointe</Text>
            )}
          </View>

          {/* Comments */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>
              COMMENTAIRES{comments.length > 0 ? ` (${comments.length})` : ''}
            </Text>
            {comments.map(c => (
              <View key={c.id} style={s.comment}>
                <View style={s.commentHead}>
                  <Text style={s.commentAuthor}>{c.user_name ?? 'Moi'}</Text>
                  <Text style={s.commentDate}>
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
                    {editCommentId !== c.id && (
                      <TouchableOpacity onPress={() => { setEditCommentId(c.id); setEditCommentText(c.content); }} accessibilityLabel="Edit comment" accessibilityRole="button">
                        <Text style={[s.xBtn, { color: '#6B6B63' }]}>✎</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deleteComment(c.id)} accessibilityLabel="Delete comment" accessibilityRole="button">
                      <Text style={s.xBtn}>x</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {editCommentId === c.id ? (
                  <View style={{ gap: 6 }}>
                    <TextInput
                      style={[s.commentInput, { borderColor: '#A00000', borderWidth: 1 }]}
                      value={editCommentText}
                      onChangeText={setEditCommentText}
                      multiline
                      autoFocus
                    />
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                      <TouchableOpacity onPress={() => setEditCommentId(null)}>
                        <Text style={{ fontSize: 12, color: '#6B6B63', fontWeight: '600' }}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveEditComment}>
                        <Text style={{ fontSize: 12, color: '#A00000', fontWeight: '700' }}>Enregistrer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={s.commentText}>{c.content}</Text>
                )}
              </View>
            ))}
            <View style={s.commentInputRow}>
              <TextInput
                style={s.commentInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Ajouter un commentaire..."
                placeholderTextColor="#A0A098"
                multiline
                accessibilityLabel="Add a comment"
              />
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[s.micBtnDesc, sttCommentState === 'recording' && s.micBtnDescActive, !sttReady && s.aiDisabled]}
                onPress={handleCommentMic}
                disabled={!sttReady}
                accessibilityLabel="Dicter commentaire"
              >
                {sttCommentState === 'transcribing'
                  ? <ActivityIndicator size="small" color={BRAND} />
                  : <Ionicons name="mic-outline" size={14} color={sttCommentState === 'recording' ? '#fff' : (!sttReady ? '#C8C8C0' : BRAND)} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sendBtn, (!newComment.trim() || sendingComment) && s.sendBtnOff]}
                onPress={postComment}
                disabled={!newComment.trim() || sendingComment}
                accessibilityLabel="Send comment"
                accessibilityRole="button"
                accessibilityState={{ disabled: !newComment.trim() || sendingComment }}
              >
                {sendingComment
                  ? <ActivityIndicator color="#fff" size="small" accessibilityLabel="Sending" />
                  : <Text style={s.sendBtnText}>^</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

      {/* Label picker */}
      <Modal visible={showLabelPicker} transparent animationType="slide" onRequestClose={() => { setShowLabelPicker(false); setCreatingLabel(false); }}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => { setShowLabelPicker(false); setCreatingLabel(false); }} />
        <View style={[s.sheet, s.sheetTall, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>LABELS DU PROJET</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
            {projectLabels.length === 0 && !creatingLabel && <Text style={s.dimText}>Aucun label. Creer le premier.</Text>}
            {projectLabels.map(l => {
              const active = detail?.labels.some(x => x.id === l.id) ?? false;
              return (
                <TouchableOpacity key={l.id} style={s.sheetRow} onPress={() => toggleLabel(l)}>
                  <View style={[s.labelDot, { backgroundColor: l.color }]} />
                  <Text style={s.sheetRowText}>{l.name}</Text>
                  {active && <Text style={[s.sheetCheck, { color: l.color }]}>v</Text>}
                </TouchableOpacity>
              );
            })}
            {creatingLabel ? (
              <View style={s.newLabelForm}>
                <TextInput
                  style={s.newLabelInput}
                  value={newLabelName}
                  onChangeText={setNewLabelName}
                  placeholder="Nom du label..."
                  placeholderTextColor="#A0A098"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={createLabel}
                />
                <View style={s.colorRow}>
                  {PRESET_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[s.colorDot, { backgroundColor: c }, newLabelColor === c && s.colorDotSel]}
                      onPress={() => setNewLabelColor(c)}
                    />
                  ))}
                </View>
                <View style={[s.editRow, { marginTop: 8 }]}>
                  <TouchableOpacity style={s.saveBtn} onPress={createLabel}>
                    <Text style={s.saveBtnText}>Creer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => { setCreatingLabel(false); setNewLabelName(''); }}>
                    <Text style={s.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.sheetRow} onPress={() => setCreatingLabel(true)}>
                <Text style={[s.sheetRowText, { color: BRAND, fontWeight: '700' }]}>+ Nouveau label</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Member picker */}
      <Modal visible={showMemberPicker} transparent animationType="slide" onRequestClose={() => setShowMemberPicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowMemberPicker(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>Membres du projet</Text>
          {projectMembers.map(m => {
            const active = detail?.members.some(x => x.id === m.id) ?? false;
            return (
              <TouchableOpacity key={m.id} style={s.sheetRow} onPress={() => toggleMember(m)}>
                <View style={s.avatarSm}><Text style={s.avatarSmText}>{m.name.slice(0, 2).toUpperCase()}</Text></View>
                <Text style={s.sheetRowText}>{m.name}</Text>
                {active && <Text style={s.sheetCheck}>v</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>

      {/* Move picker */}
      <Modal visible={showMovePicker} transparent animationType="slide" onRequestClose={() => setShowMovePicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowMovePicker(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>{t('cards.moveToColumn')}</Text>
          {projectColumns
            .filter(col => col.id !== (detail?.column_id ?? card?.column_id) && col.type !== 'gtd_trash')
            .map(col => {
              const typeKey = col.type?.replace(/^gtd_/, '') as string;
              const label = typeKey && i18n.exists(`columns.${typeKey}`) ? t(`columns.${typeKey}`) : col.name;
              return (
                <TouchableOpacity key={col.id} style={s.sheetRow} onPress={() => moveCard(col.id)}>
                  <Text style={s.sheetRowText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </Modal>

      {/* Due date picker */}
      <Modal visible={showDuePicker} transparent animationType="slide" onRequestClose={() => setShowDuePicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowDuePicker(false)} />
        <View style={[s.sheet, s.sheetTall, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>ECHEANCE</Text>
          <CalendarPicker
            value={dueDate ?? null}
            onChange={async (ts) => { await patchCard({ due_date: ts }); setShowDuePicker(false); }}
            onClear={async () => { await patchCard({ due_date: null }); setShowDuePicker(false); }}
            onCancel={() => setShowDuePicker(false)}
          />
        </View>
      </Modal>
      {/* Video player modal */}
      <Modal visible={!!videoViewerAtt} transparent animationType="fade" onRequestClose={() => setVideoViewerAtt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }} accessibilityViewIsModal={true}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setVideoViewerAtt(null)}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
          {videoViewerAtt && <VideoPlayer uri={videoViewerAtt.filename} />}
          {videoViewerAtt && (
            <TouchableOpacity
              style={{ marginTop: 20, backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 }}
              onPress={() => { const orig = (detail?.attachments ?? []).find(a => a.id === videoViewerAtt.id); if (orig) downloadAttachment(orig); }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Telecharger</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Image viewer modal */}
      <Modal visible={!!imageViewerAtt} transparent animationType="fade" onRequestClose={() => setImageViewerAtt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }} accessibilityViewIsModal={true}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setImageViewerAtt(null)}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
          {imageViewerAtt && (
            <Image
              source={{ uri: `${serverUrl}/api/attachments/${imageViewerAtt.id}/download`, headers: { Authorization: `Bearer ${token}` } }}
              style={{ width: '90%', height: '70%' }}
              resizeMode="contain"
              accessibilityLabel={imageViewerAtt?.filename ?? 'Image'}
            />
          )}
          {imageViewerAtt && (
            <TouchableOpacity
              style={{ marginTop: 20, backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 }}
              onPress={() => { if (imageViewerAtt) downloadAttachment(imageViewerAtt); }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>⬇ Télécharger</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay:          { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: BG },
  topBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#EBEBEB', gap: 8 },
  closeBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EBEBEB', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:     { fontSize: 13, color: '#4A4A44', fontWeight: '600' },
  topAction:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F0EC' },
  topActionDanger:  { backgroundColor: '#FFF0F0' },
  topActionText:    { fontSize: 12, fontWeight: '600', color: '#4A4A44' },
  body:             { paddingHorizontal: 24, paddingTop: 16 },

  labelsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  labelChip:        { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  labelChipText:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  labelChipX:       { fontSize: 11, fontWeight: '600' },
  addChip:          { borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C4C4BE', paddingHorizontal: 8, paddingVertical: 4 },
  addChipText:      { fontSize: 11, fontWeight: '600', color: '#6B6B63' },

  editBlock:        { marginBottom: 4 },
  editRow:          { flexDirection: 'row', gap: 8, marginTop: 8 },
  title:            { fontSize: 24, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.6, lineHeight: 30, marginBottom: 14 },
  titleInput:       { fontSize: 22, fontWeight: '600', color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, padding: 12, marginBottom: 4, lineHeight: 28 },
  saveBtn:          { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnText:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelBtn:        { backgroundColor: '#F0F0EC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  cancelBtnText:    { color: '#4A4A44', fontSize: 13, fontWeight: '600' },
  micBtnDesc:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#A00000', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  wandBtn:          { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  aiDisabled:       { borderColor: '#C8C8C0', opacity: 0.4 },
  micBtnDescActive: { backgroundColor: '#A00000' },

  metaRow:          { flexDirection: 'row', gap: 8, marginBottom: 20 },
  metaBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  metaBadgeOverdue: { backgroundColor: '#FFF0F0' },
  metaBadgeRunning: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#F5D0D0' },
  metaIcon:         { fontSize: 14 },
  metaText:         { fontSize: 13, fontWeight: '600', color: '#4A4A44' },

  section:          { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0EC' },
  sectionHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#6B6B63', marginBottom: 2 },
  sectionPlus:      { fontSize: 20, color: BRAND, lineHeight: 22, fontWeight: '300' },

  membersRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar:           { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND + '18', borderWidth: 1.5, borderColor: BRAND + '44', alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 12, fontWeight: '700', color: BRAND },
  dimText:          { fontSize: 13, color: '#8A8A80', fontStyle: 'italic' },

  descInput:        { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  descCard:         { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 14, paddingTop: 12, borderWidth: 1, borderColor: '#E8E8E4', marginTop: 10 },
  mdToolbar:        { marginBottom: 8 },
  mdToolbarContent: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  mdBtn:            { borderRadius: 6, borderWidth: 1, borderColor: '#EBEBEB', paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F8F8F4' },
  mdBtnText:        { fontSize: 12, fontWeight: '700', color: '#4A4A44', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  descText:         { fontSize: 15, color: '#4A4A44', lineHeight: 22 },

  clBar:            { height: 4, backgroundColor: '#EBEBEB', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  clFill:           { height: 4, backgroundColor: BRAND, borderRadius: 2 },
  clProgress:       { fontSize: 11, fontWeight: '600', color: '#6B6B63' },
  clItem:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  clCheck:          { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#C4C4BE', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  clCheckDone:      { backgroundColor: BRAND, borderColor: BRAND },
  clText:           { flex: 1, fontSize: 14, color: '#2A2A24', lineHeight: 20 },
  clTextDone:       { color: '#8A8A80', textDecorationLine: 'line-through' },
  xBtn:             { fontSize: 14, color: '#8A8A80', fontWeight: '500', paddingHorizontal: 4 },
  addItemRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  addItemInput:     { flex: 1, fontSize: 14, borderBottomWidth: 1, borderBottomColor: BRAND, paddingVertical: 6, color: '#1A1A1A' },
  saveSmallBtn:     { backgroundColor: BRAND, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  saveSmallText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  addSubBtn:        { marginTop: 10, alignSelf: 'flex-start' },
  addSubBtnText:    { fontSize: 13, fontWeight: '600', color: BRAND, letterSpacing: 0.2 },
  addClInput:       { fontSize: 15, color: '#1A1A1A', borderBottomWidth: 1.5, borderBottomColor: BRAND, paddingVertical: 8, marginBottom: 4 },

  attImageWrap:     { marginBottom: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F0F0EC' },
  attImage:         { width: '100%', height: 200, marginHorizontal: 0 },
  attImageFooter:   { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6 },
  attFilename:      { flex: 1, fontSize: 12, color: '#4A4A44', fontWeight: '500' },
  attChip:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F0', borderRadius: 10, padding: 10, marginBottom: 8, gap: 8 },

  attChipName:      { fontSize: 13, fontWeight: '600', color: '#2A2A24' },
  attChipSize:      { fontSize: 11, color: '#6B6B63' },

  comment:          { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 12, marginBottom: 8 },
  commentHead:      { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 },
  commentAuthor:    { fontSize: 12, fontWeight: '700', color: '#2A2A24' },
  commentDate:      { fontSize: 11, color: '#6B6B63' },
  commentText:      { fontSize: 14, color: '#2A2A24', lineHeight: 20 },
  commentInputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  commentInput:     { flex: 1, fontSize: 14, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 12, padding: 12, minHeight: 42, maxHeight: 120, textAlignVertical: 'top', backgroundColor: '#fff' },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:       { opacity: 0.35 },
  sendBtnText:      { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },

  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '60%' },
  sheetTitle:       { fontSize: 13, fontWeight: '700', letterSpacing: 1, color: '#6B6B63', marginBottom: 16 },
  sheetRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F0' },
  sheetRowText:     { fontSize: 15, fontWeight: '500', color: '#1A1A1A', flex: 1 },
  sheetCheck:       { fontSize: 16, fontWeight: '700', color: BRAND },
  labelDot:         { width: 12, height: 12, borderRadius: 6 },
  avatarSm:         { width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND + '18', alignItems: 'center', justifyContent: 'center' },
  avatarSmText:     { fontSize: 11, fontWeight: '700', color: BRAND },

  sheetTall:        { maxHeight: '75%' },

  newLabelForm:     { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0EC' },
  newLabelInput:    { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  colorRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorDot:         { width: 28, height: 28, borderRadius: 14 },
  colorDotSel:      { borderWidth: 3, borderColor: '#1A1A1A' },
});

const CELL = 40;
const cal = StyleSheet.create({
  nav:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0EC' },
  navArrow:     { fontSize: 22, color: '#1A1A1A', lineHeight: 26, fontWeight: '300' },
  monthLabel:   { fontSize: 15, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.2 },
  row:          { flexDirection: 'row' },
  dayName:      { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#6B6B63', letterSpacing: 0.5, paddingVertical: 6 },
  cell:         { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: CELL / 2 },
  cellSel:      { backgroundColor: BRAND },
  cellToday:    { borderWidth: 1.5, borderColor: BRAND },
  cellText:     { fontSize: 14, fontWeight: '500', color: '#2A2A24' },
  cellTextSel:  { color: '#fff', fontWeight: '700' },
  cellTextToday:{ color: BRAND, fontWeight: '700' },
});
