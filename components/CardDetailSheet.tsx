import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';

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
interface CardDetail extends Card {
  labels: Label[]; members: Member[]; checklists: Checklist[]; is_subscribed?: boolean;
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

export default function CardDetailSheet({
  card, expandAnim, token, serverUrl, projectId, insets,
  onClose, onCardUpdated, onCardDeleted, onNeedRefetch,
}: Props) {
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

  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [dueDraft, setDueDraft] = useState('');

  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');

  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const [swDisplay, setSwDisplay] = useState(0);
  const swInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const api = useCallback(async (method: string, path: string, body?: any) => {
    const r = await fetch(`${serverUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    if (r.status === 204) return null;
    return r.json();
  }, [serverUrl, token]);

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
    return () => clearInterval(swInterval.current!);
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
    await patchCard({ description: descDraft.trim() || undefined });
    setEditingDesc(false);
  };

  const parseDue = (s: string): number | null => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  const saveDue = async (clearIt = false) => {
    const ts = clearIt ? null : parseDue(dueDraft);
    await patchCard({ due_date: ts });
    setShowDuePicker(false);
  };

  const toggleLabel = async (label: Label) => {
    if (!detail || !card) return;
    const has = detail.labels.some(l => l.id === label.id);
    try {
      if (has) {
        await api('DELETE', `/api/cards/${card.id}/labels/${label.id}`);
        setDetail(prev => prev ? { ...prev, labels: prev.labels.filter(l => l.id !== label.id) } : prev);
      } else {
        await api('POST', `/api/cards/${card.id}/labels`, { labelId: label.id });
        setDetail(prev => prev ? { ...prev, labels: [...prev.labels, label] } : prev);
      }
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

  const deleteChecklist = (clId: string) => {
    Alert.alert('Supprimer', 'Supprimer cette checklist ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await api('DELETE', `/api/checklists/${clId}`);
        setDetail(prev => prev ? { ...prev, checklists: prev.checklists.filter(c => c.id !== clId) } : prev);
      }},
    ]);
  };

  const addItem = async (clId: string) => {
    if (!newItemText.trim()) return;
    try {
      const item = await api('POST', `/api/checklists/${clId}/items`, { text: newItemText.trim() });
      setDetail(prev => prev ? {
        ...prev,
        checklists: prev.checklists.map(cl => cl.id === clId ? { ...cl, items: [...cl.items, item] } : cl),
      } : prev);
      setNewItemText('');
      setAddingItemFor(null);
    } catch {}
  };

  const toggleItem = async (clId: string, item: ChecklistItem) => {
    try {
      const updated = await api('PATCH', `/api/items/${item.id}`, { is_done: item.is_done ? 0 : 1 });
      setDetail(prev => prev ? {
        ...prev,
        checklists: prev.checklists.map(cl => cl.id === clId ? {
          ...cl, items: cl.items.map(i => i.id === item.id ? { ...i, is_done: updated.is_done } : i),
        } : cl),
      } : prev);
    } catch {}
  };

  const deleteItem = async (clId: string, itemId: string) => {
    try {
      await api('DELETE', `/api/items/${itemId}`);
      setDetail(prev => prev ? {
        ...prev,
        checklists: prev.checklists.map(cl => cl.id === clId ? {
          ...cl, items: cl.items.filter(i => i.id !== itemId),
        } : cl),
      } : prev);
    } catch {}
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

  const deleteCard = () => {
    Alert.alert('Supprimer', 'Mettre cette carte a la corbeille ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Corbeille', style: 'destructive', onPress: async () => {
        if (!card) return;
        try {
          await api('DELETE', `/api/cards/${card.id}`);
          onCardDeleted(card.id);
          onClose();
        } catch (e) { Alert.alert('Erreur', String(e)); }
      }},
    ]);
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
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.topAction} onPress={() => setShowMovePicker(true)}>
          <Text style={s.topActionText}>Deplacer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.topAction, s.topActionDanger]} onPress={deleteCard}>
          <Text style={[s.topActionText, { color: BRAND }]}>Corbeille</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Labels */}
          <View style={s.labelsRow}>
            {(detail?.labels ?? []).map(l => (
              <TouchableOpacity
                key={l.id}
                style={[s.labelChip, { backgroundColor: l.color + '22', borderColor: l.color + '55' }]}
                onPress={() => toggleLabel(l)}
              >
                <Text style={[s.labelChipText, { color: l.color }]}>{l.name}</Text>
                <Text style={[s.labelChipX, { color: l.color + 'AA' }]}>x</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.addChip} onPress={() => setShowLabelPicker(true)}>
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
            <TouchableOpacity activeOpacity={0.7} onPress={() => { setTitleDraft(detail?.title ?? card.title); setEditingTitle(true); }}>
              <Text style={s.title}>{detail?.title ?? card.title}</Text>
            </TouchableOpacity>
          )}

          {/* Meta: due date + stopwatch */}
          <View style={s.metaRow}>
            <TouchableOpacity style={[s.metaBadge, isDueOverdue && s.metaBadgeOverdue]} onPress={() => {
              const d = dueDate;
              if (d) {
                const dt = new Date(d);
                setDueDraft(`${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`);
              } else { setDueDraft(''); }
              setShowDuePicker(true);
            }}>
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
            >
              <Text style={s.metaIcon}>{isRunning ? '⏹' : '▶'}</Text>
              <Text style={[s.metaText, isRunning && { color: BRAND }]}>{fmt(swDisplay)}</Text>
            </TouchableOpacity>
          </View>

          {/* Members */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>MEMBRES</Text>
              <TouchableOpacity onPress={() => setShowMemberPicker(true)}>
                <Text style={s.sectionPlus}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={s.membersRow}>
              {(detail?.members ?? []).map(m => (
                <TouchableOpacity key={m.id} style={s.avatar} onPress={() => toggleMember(m)}>
                  <Text style={s.avatarText}>{m.name.slice(0, 2).toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
              {(detail?.members ?? []).length === 0 && (
                <Text style={s.dimText}>Aucun membre</Text>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>DESCRIPTION</Text>
            {editingDesc ? (
              <View style={s.editBlock}>
                <TextInput
                  style={s.descInput}
                  value={descDraft}
                  onChangeText={setDescDraft}
                  multiline
                  autoFocus
                  placeholder="Ajouter une description..."
                  placeholderTextColor="#C4C4BE"
                />
                <View style={s.editRow}>
                  <TouchableOpacity style={s.saveBtn} onPress={saveDesc}>
                    <Text style={s.saveBtnText}>Enregistrer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setEditingDesc(false)}>
                    <Text style={s.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity activeOpacity={0.7} onPress={() => { setDescDraft(detail?.description ?? ''); setEditingDesc(true); }}>
                {detail?.description
                  ? <Text style={s.descText}>{detail.description}</Text>
                  : <Text style={s.dimText}>Appuyer pour ajouter une description...</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Checklists */}
          {loading && !detail && <ActivityIndicator color={BRAND} style={{ marginVertical: 16 }} />}
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
                    <TouchableOpacity onPress={() => deleteChecklist(cl.id)}>
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
                      style={[s.clCheck, !!item.is_done && s.clCheckDone]}
                      onPress={() => toggleItem(cl.id, item)}
                    >
                      {!!item.is_done && <Text style={s.clMark}>v</Text>}
                    </TouchableOpacity>
                    <Text style={[s.clText, !!item.is_done && s.clTextDone]} numberOfLines={0}>{item.text}</Text>
                    <TouchableOpacity onPress={() => deleteItem(cl.id, item.id)}>
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
                      placeholderTextColor="#C4C4BE"
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
                placeholderTextColor="#C4C4BE"
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
            <TouchableOpacity style={s.addSubBtn} onPress={() => setAddingChecklist(true)}>
              <Text style={s.addSubBtnText}>+ Checklist</Text>
            </TouchableOpacity>
          )}

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
                  <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => deleteComment(c.id)}>
                    <Text style={s.xBtn}>x</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.commentText}>{c.content}</Text>
              </View>
            ))}
            <View style={s.commentInputRow}>
              <TextInput
                style={s.commentInput}
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Ajouter un commentaire..."
                placeholderTextColor="#C4C4BE"
                multiline
              />
              <TouchableOpacity
                style={[s.sendBtn, (!newComment.trim() || sendingComment) && s.sendBtnOff]}
                onPress={postComment}
                disabled={!newComment.trim() || sendingComment}
              >
                {sendingComment
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.sendBtnText}>^</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Label picker */}
      <Modal visible={showLabelPicker} transparent animationType="slide" onRequestClose={() => setShowLabelPicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowLabelPicker(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={s.sheetTitle}>Labels du projet</Text>
          {projectLabels.length === 0 && <Text style={s.dimText}>Aucun label dans ce projet.</Text>}
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
        </View>
      </Modal>

      {/* Member picker */}
      <Modal visible={showMemberPicker} transparent animationType="slide" onRequestClose={() => setShowMemberPicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowMemberPicker(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
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
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={s.sheetTitle}>Deplacer vers</Text>
          {projectColumns
            .filter(col => col.id !== (detail?.column_id ?? card?.column_id) && col.type !== 'gtd_trash')
            .map(col => (
              <TouchableOpacity key={col.id} style={s.sheetRow} onPress={() => moveCard(col.id)}>
                <Text style={s.sheetRowText}>{col.name}</Text>
              </TouchableOpacity>
            ))}
        </View>
      </Modal>

      {/* Due date picker */}
      <Modal visible={showDuePicker} transparent animationType="slide" onRequestClose={() => setShowDuePicker(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setShowDuePicker(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={s.sheetTitle}>Echeance</Text>
          <TextInput
            style={s.dueDateInput}
            value={dueDraft}
            onChangeText={setDueDraft}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor="#C4C4BE"
            keyboardType="numeric"
            autoFocus
          />
          <View style={s.editRow}>
            <TouchableOpacity style={s.saveBtn} onPress={() => saveDue(false)}>
              <Text style={s.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity style={s.cancelBtn} onPress={() => saveDue(true)}>
                <Text style={[s.cancelBtnText, { color: BRAND }]}>Effacer</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowDuePicker(false)}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
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
  addChipText:      { fontSize: 11, fontWeight: '600', color: '#9A9A92' },

  editBlock:        { marginBottom: 4 },
  editRow:          { flexDirection: 'row', gap: 8, marginTop: 8 },
  title:            { fontSize: 24, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.6, lineHeight: 30, marginBottom: 14 },
  titleInput:       { fontSize: 22, fontWeight: '600', color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, padding: 12, marginBottom: 4, lineHeight: 28 },
  saveBtn:          { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtnText:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelBtn:        { backgroundColor: '#F0F0EC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  cancelBtnText:    { color: '#4A4A44', fontSize: 13, fontWeight: '600' },

  metaRow:          { flexDirection: 'row', gap: 8, marginBottom: 20 },
  metaBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F0EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  metaBadgeOverdue: { backgroundColor: '#FFF0F0' },
  metaBadgeRunning: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#F5D0D0' },
  metaIcon:         { fontSize: 14 },
  metaText:         { fontSize: 13, fontWeight: '600', color: '#4A4A44' },

  section:          { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F0F0EC' },
  sectionHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#B0B0A8' },
  sectionPlus:      { fontSize: 20, color: BRAND, lineHeight: 22, fontWeight: '300' },

  membersRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar:           { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND + '18', borderWidth: 1.5, borderColor: BRAND + '44', alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 12, fontWeight: '700', color: BRAND },
  dimText:          { fontSize: 13, color: '#C4C4BE', fontStyle: 'italic' },

  descInput:        { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  descText:         { fontSize: 15, color: '#4A4A44', lineHeight: 22 },

  clBar:            { height: 4, backgroundColor: '#EBEBEB', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  clFill:           { height: 4, backgroundColor: BRAND, borderRadius: 2 },
  clProgress:       { fontSize: 11, fontWeight: '600', color: '#B0B0A8' },
  clItem:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  clCheck:          { width: 19, height: 19, borderRadius: 4, borderWidth: 1.5, borderColor: '#C4C4BE', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  clCheckDone:      { backgroundColor: BRAND, borderColor: BRAND },
  clMark:           { fontSize: 11, color: '#fff', fontWeight: '700' },
  clText:           { flex: 1, fontSize: 14, color: '#2A2A24', lineHeight: 20 },
  clTextDone:       { color: '#C4C4BE', textDecorationLine: 'line-through' },
  xBtn:             { fontSize: 14, color: '#C4C4BE', fontWeight: '500', paddingHorizontal: 4 },
  addItemRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  addItemInput:     { flex: 1, fontSize: 14, borderBottomWidth: 1, borderBottomColor: BRAND, paddingVertical: 6, color: '#1A1A1A' },
  saveSmallBtn:     { backgroundColor: BRAND, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  saveSmallText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  addSubBtn:        { marginTop: 10, alignSelf: 'flex-start' },
  addSubBtnText:    { fontSize: 13, fontWeight: '600', color: BRAND, letterSpacing: 0.2 },
  addClInput:       { fontSize: 15, color: '#1A1A1A', borderBottomWidth: 1.5, borderBottomColor: BRAND, paddingVertical: 8, marginBottom: 4 },

  comment:          { backgroundColor: '#F5F5F0', borderRadius: 10, padding: 12, marginBottom: 8 },
  commentHead:      { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 6 },
  commentAuthor:    { fontSize: 12, fontWeight: '700', color: '#2A2A24' },
  commentDate:      { fontSize: 11, color: '#B0B0A8' },
  commentText:      { fontSize: 14, color: '#2A2A24', lineHeight: 20 },
  commentInputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  commentInput:     { flex: 1, fontSize: 14, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 12, padding: 12, minHeight: 42, maxHeight: 120, textAlignVertical: 'top', backgroundColor: '#fff' },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:       { opacity: 0.35 },
  sendBtnText:      { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },

  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '60%' },
  sheetTitle:       { fontSize: 13, fontWeight: '700', letterSpacing: 1, color: '#B0B0A8', marginBottom: 16 },
  sheetRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F5F5F0' },
  sheetRowText:     { fontSize: 15, fontWeight: '500', color: '#1A1A1A', flex: 1 },
  sheetCheck:       { fontSize: 16, fontWeight: '700', color: BRAND },
  labelDot:         { width: 12, height: 12, borderRadius: 6 },
  avatarSm:         { width: 30, height: 30, borderRadius: 15, backgroundColor: BRAND + '18', alignItems: 'center', justifyContent: 'center' },
  avatarSmText:     { fontSize: 11, fontWeight: '700', color: BRAND },

  dueDateInput:     { fontSize: 20, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', borderBottomWidth: 1.5, borderBottomColor: BRAND, paddingVertical: 10, marginBottom: 4, letterSpacing: 2 },
});
