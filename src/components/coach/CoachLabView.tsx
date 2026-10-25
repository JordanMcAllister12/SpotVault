import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical, Plus, ChevronLeft, ChevronRight,
  FileText, Image as ImageIcon, Play, Trash2,
  Save, X, Upload, FolderOpen, BookOpen, Layers,
  CheckCircle2, CircleDot, AlertCircle, Clock, Search,
  TrendingUp, TrendingDown, BarChart3, GraduationCap,
  Maximize2, Minimize2, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import { DEMO_REPLAYER_HANDS } from '@/data/demoContent';
import { COACH_STUDENTS, type CoachStudent } from '@/data/coach';
import { FEATURE_FLAGS } from '@/lib/entitlements';

// ── Constants ──
const GOLD = '#d4a52c';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,11,14,0.94)';
const DARKER_PANEL = 'rgba(5,7,10,0.96)';

type LabTab = 'replayer' | 'students' | 'lessons';
type ReviewStatus = 'needs_review' | 'in_review' | 'reviewed' | 'follow_up';

interface LabLesson {
  id: string;
  coach_account_id: string;
  student_account_id: string;
  title: string;
  description: string;
  collection_type: 'lesson' | 'submission' | 'review_set';
  status: string;
  tags: string[];
  student_note: string;
  created_at: string;
  updated_at: string;
}

interface LabHand {
  id: string;
  lesson_id: string;
  hand_id: string;
  title: string;
  sort_order: number;
  review_status: ReviewStatus;
  student_preflop_note: string;
  student_flop_note: string;
  student_turn_note: string;
  student_river_note: string;
  student_general_note: string;
  coach_note: string;
  created_at: string;
  updated_at: string;
}

interface LabHandImage {
  id: string;
  lab_hand_id: string;
  image_url: string;
  caption: string;
  sort_order: number;
  created_at: string;
}

const STATUS_META: Record<ReviewStatus, { label: string; color: string; icon: typeof AlertCircle }> = {
  needs_review: { label: 'Needs Review', color: '#d4a52c', icon: AlertCircle },
  in_review: { label: 'In Review', color: '#60a5fa', icon: Clock },
  reviewed: { label: 'Reviewed', color: '#4ade80', icon: CheckCircle2 },
  follow_up: { label: 'Follow Up', color: '#fb923c', icon: CircleDot },
};

// ── Context source for the replayer ──
interface ReplayerContext {
  source: 'student' | 'lesson' | 'independent';
  studentName?: string;
  lessonTitle?: string;
  hands: LabHand[];
  currentIndex: number;
  studentNote?: string;
}

export function CoachLabView({ account }: { account: SpotVaultAccount }) {
  const [activeTab, setActiveTab] = useState<LabTab>('replayer');
  const [replayerCtx, setReplayerCtx] = useState<ReplayerContext | null>(null);

  // When a student hand is played, switch to replayer tab with context
  const playStudentHand = useCallback((student: CoachStudent, handIndex: number) => {
    const hands: LabHand[] = student.hands.map((h, i) => ({
      id: h.id,
      lesson_id: `student-${student.id}`,
      hand_id: h.id,
      title: h.title,
      sort_order: i,
      review_status: h.markedAs === 'complete' ? 'reviewed' : h.markedAs === 'needs_review' ? 'needs_review' : h.markedAs === 'reviewed' ? 'reviewed' : 'follow_up',
      student_preflop_note: '',
      student_flop_note: '',
      student_turn_note: '',
      student_river_note: '',
      student_general_note: h.notes ?? '',
      coach_note: '',
      created_at: h.uploadedAt,
      updated_at: h.uploadedAt,
    }));
    setReplayerCtx({
      source: 'student',
      studentName: student.name,
      hands,
      currentIndex: handIndex,
      studentNote: undefined,
    });
    setActiveTab('replayer');
  }, []);

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-2 px-1 pb-2 sm:px-3">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 backdrop-blur-md"
        style={{ background: 'rgba(10,12,14,0.72)', border: '1px solid rgba(192,145,30,0.18)' }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
          <FlaskConical className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <span className="text-sm font-bold text-white">Workspace</span>
        <span className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(192,145,30,0.6)' }}>Coaching workspace</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border p-1" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        {([
          { id: 'replayer' as LabTab, label: 'Replayer', icon: Play },
          { id: 'students' as LabTab, label: 'Students', icon: GraduationCap },
          { id: 'lessons' as LabTab, label: 'Lessons', icon: BookOpen },
        ]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all ${activeTab === t.id ? 'text-[#080706]' : 'text-white/50 hover:text-white/70'}`}
            style={{ background: activeTab === t.id ? GOLD : 'transparent' }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {activeTab === 'replayer' && (
          <ReplayerTab account={account} ctx={replayerCtx} onClearCtx={() => setReplayerCtx(null)} />
        )}
        {activeTab === 'students' && (
          <StudentsTab onPlayHand={playStudentHand} />
        )}
        {activeTab === 'lessons' && (
          <LessonsTab account={account} onPlayLesson={(lesson, hands, index) => {
            setReplayerCtx({
              source: 'lesson',
              lessonTitle: lesson.title,
              hands,
              currentIndex: index,
            });
            setActiveTab('replayer');
          }} />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REPLAYER TAB — central HH replayer with notes + reference images
// ════════════════════════════════════════════════════════════════

function ReplayerTab({ account, ctx, onClearCtx }: {
  account: SpotVaultAccount;
  ctx: ReplayerContext | null;
  onClearCtx: () => void;
}) {
  const [hands, setHands] = useState<LabHand[]>(() => {
    if (ctx?.hands?.length) return ctx.hands;
    return DEMO_REPLAYER_HANDS.map((h, i) => ({
      id: `demo-lab-${h.handId}`,
      lesson_id: 'demo',
      hand_id: h.handId,
      title: h.title ?? h.handId,
      sort_order: i,
      review_status: 'needs_review' as ReviewStatus,
      student_preflop_note: '', student_flop_note: '', student_turn_note: '',
      student_river_note: '', student_general_note: '', coach_note: '',
      created_at: h.date, updated_at: h.date,
    }));
  });
  const [currentIndex, setCurrentIndex] = useState(ctx?.currentIndex ?? 0);
  const [normalizedHand, setNormalizedHand] = useState<NormalizedHand | null>(null);
  const [handLoadState, setHandLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [images, setImages] = useState<LabHandImage[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [coachNoteDraft, setCoachNoteDraft] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);

  // Notes tab state
  const [noteTab, setNoteTab] = useState<'general' | 'current' | 'student' | 'coach'>('coach');

  // Image panel state
  const [imageMode, setImageMode] = useState<'carousel' | 'upload'>('carousel');
  const [pendingImages, setPendingImages] = useState<{ file: File; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Expanded presentation state
  const [expandedView, setExpandedView] = useState(false);

  // Sync from context when it changes
  useEffect(() => {
    if (ctx) {
      setHands(ctx.hands);
      setCurrentIndex(ctx.currentIndex);
    }
  }, [ctx]);

  const selectedHand = hands[currentIndex] ?? null;

  const hasStudentNotes = !!(selectedHand?.student_general_note || selectedHand?.student_preflop_note || selectedHand?.student_flop_note || selectedHand?.student_turn_note || selectedHand?.student_river_note || ctx?.studentNote);

  // Load hand into replayer
  const loadHand = useCallback(async (handRow: LabHand) => {
    setHandLoadState('loading');
    setNormalizedHand(null);

    const demo = DEMO_REPLAYER_HANDS.find(h => h.handId === handRow.hand_id);
    if (demo) {
      setNormalizedHand(demo);
      setHandLoadState('ready');
      return;
    }

    const { data, error } = await supabase
      .from('poker_hand_records')
      .select('*, raw_hand_text')
      .eq('hand_id', handRow.hand_id)
      .maybeSingle();

    if (error || !data) {
      setHandLoadState('error');
      return;
    }

    try {
      const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
      if (!normalized.actions || normalized.actions.length === 0) {
        setHandLoadState('error');
        return;
      }
      setNormalizedHand(normalized);
      setHandLoadState('ready');
    } catch {
      setHandLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (selectedHand) loadHand(selectedHand);
    else { setNormalizedHand(null); setHandLoadState('idle'); }
  }, [selectedHand?.id]);

  // Fetch images
  const fetchImages = useCallback(async () => {
    if (!selectedHand) { setImages([]); return; }
    const { data, error } = await supabase
      .from('coach_lab_hand_images')
      .select('*')
      .eq('lab_hand_id', selectedHand.id)
      .order('sort_order', { ascending: true });
    if (!error && data) {
      setImages(data as LabHandImage[]);
      setImageIndex(0);
    }
  }, [selectedHand?.id]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  // Reset to carousel mode and clear pending when switching hands
  useEffect(() => {
    setImageMode('carousel');
    setPendingImages([]);
    setExpandedView(false);
  }, [selectedHand?.id]);

  // Coach note draft sync
  useEffect(() => { setCoachNoteDraft(selectedHand?.coach_note ?? ''); }, [selectedHand?.id]);

  const saveCoachNote = async () => {
    if (!selectedHand) return;
    setSavingNote(true);
    await supabase
      .from('coach_lab_hands')
      .update({ coach_note: coachNoteDraft, updated_at: new Date().toISOString() })
      .eq('id', selectedHand.id);
    setSavingNote(false);
    setHands(prev => prev.map(h => h.id === selectedHand.id ? { ...h, coach_note: coachNoteDraft } : h));
  };

  // Upload a single image immediately (legacy quick-add)
  const uploadImage = async (file: File) => {
    if (!selectedHand || !account?.id) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `coach-lab/${account.id}/${selectedHand.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('user-uploads').upload(path, file);
    if (upErr) return;
    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
    const { data } = await supabase
      .from('coach_lab_hand_images')
      .insert({ lab_hand_id: selectedHand.id, image_url: urlData.publicUrl, sort_order: images.length })
      .select('*')
      .maybeSingle();
    if (data) setImages(prev => [...prev, data as LabHandImage]);
  };

  // Stage pending images (upload mode)
  const addPendingFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
      .map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPendingImages(prev => [...prev, ...arr]);
  };

  const removePendingImage = (idx: number) => {
    setPendingImages(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const movePendingImage = (idx: number, dir: 'left' | 'right') => {
    setPendingImages(prev => {
      const next = [...prev];
      const target = dir === 'left' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // Finalize: upload all pending images to storage + DB, then switch to carousel
  const setImages_ = async () => {
    if (!selectedHand || !account?.id || pendingImages.length === 0) return;
    setUploading(true);
    const startOrder = images.length;
    const newImages: LabHandImage[] = [];
    for (let i = 0; i < pendingImages.length; i++) {
      const { file } = pendingImages[i];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `coach-lab/${account.id}/${selectedHand.id}/${Date.now()}-${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from('user-uploads').upload(path, file);
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
      const { data } = await supabase
        .from('coach_lab_hand_images')
        .insert({ lab_hand_id: selectedHand.id, image_url: urlData.publicUrl, sort_order: startOrder + i })
        .select('*')
        .maybeSingle();
      if (data) newImages.push(data as LabHandImage);
    }
    setUploading(false);
    pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPendingImages([]);
    setImages(prev => [...prev, ...newImages]);
    setImageMode('carousel');
    if (newImages.length > 0) setImageIndex(images.length);
  };

  const deleteImage = async (imageId: string) => {
    await supabase.from('coach_lab_hand_images').delete().eq('id', imageId);
    setImages(prev => prev.filter(i => i.id !== imageId));
    setImageIndex(0);
  };

  const goToHand = (dir: 'prev' | 'next') => {
    const newIdx = dir === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIdx >= 0 && newIdx < hands.length) setCurrentIndex(newIdx);
  };

  const currentImage = images[imageIndex];

  // Context indicator
  const contextLabel = ctx
    ? ctx.source === 'student'
      ? `STUDENT REVIEW · ${ctx.studentName} · Hand ${currentIndex + 1}/${hands.length}`
      : ctx.source === 'lesson'
        ? `LESSON · ${ctx.lessonTitle} · Hand ${currentIndex + 1}/${hands.length}`
        : `Hand ${currentIndex + 1}/${hands.length}`
    : hands.length > 0
      ? `INDEPENDENT HAND REVIEW · Hand ${currentIndex + 1}/${hands.length}`
      : 'INDEPENDENT HAND REVIEW';

  // Expanded image navigation
  const goExpandedImage = (dir: 'prev' | 'next') => {
    if (dir === 'prev') setImageIndex(i => Math.max(0, i - 1));
    else setImageIndex(i => Math.min(images.length - 1, i + 1));
  };

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* ── LEFT: Hand list ── */}
      {!leftCollapsed && (
        <div className="flex w-56 shrink-0 flex-col rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: BORDER }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Hands ({hands.length})</span>
            <button onClick={() => setLeftCollapsed(true)} className="text-white/30 hover:text-white/60"><ChevronLeft size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {hands.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-white/30">
                <Play className="mx-auto mb-2 h-6 w-6 text-white/15" strokeWidth={1.5} />
                No hands loaded.<br />Select from Students or Lessons.
              </div>
            ) : (
              <div className="space-y-1">
                {hands.map((h, i) => {
                  const isSelected = i === currentIndex;
                  const statusMeta = STATUS_META[h.review_status] ?? STATUS_META.needs_review;
                  return (
                    <div key={h.id} onClick={() => setCurrentIndex(i)}
                      className={`rounded-lg border px-2.5 py-2 transition-all cursor-pointer ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                      style={{
                        background: isSelected ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${isSelected ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      <div className="flex items-center gap-1.5">
                        <span className="flex-1 truncate text-[11px] font-semibold text-white/80">{h.title || h.hand_id.slice(0, 12)}</span>
                        <statusMeta.icon size={11} style={{ color: statusMeta.color }} />
                      </div>
                      <div className="mt-0.5 text-[9px] text-white/30">Hand {i + 1}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {ctx && (
            <div className="border-t p-2" style={{ borderColor: BORDER }}>
              <button onClick={onClearCtx} className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70"
                style={{ borderColor: BORDER }}>
                <X size={11} /> Clear Context
              </button>
            </div>
          )}
        </div>
      )}
      {leftCollapsed && (
        <button onClick={() => setLeftCollapsed(false)}
          className="flex w-8 shrink-0 items-center justify-center rounded-xl border text-white/40 hover:text-white/70"
          style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <ChevronRight size={16} />
        </button>
      )}

      {/* ── CENTER: Replayer (or Expanded Image) ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Context indicator */}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(192,145,30,0.15)', background: DARK_PANEL }}>
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: GOLD }}>{contextLabel}</span>
          {expandedView && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#60a5fa]">
              <Maximize2 size={11} /> Presentation Mode
            </span>
          )}
        </div>

        {/* Hand nav */}
        {hands.length > 1 && !expandedView && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: DARK_PANEL }}>
            <button onClick={() => goToHand('prev')} disabled={currentIndex <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: '#9ca3af' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-medium text-white/60">Hand {currentIndex + 1} of {hands.length}</span>
            <button onClick={() => goToHand('next')} disabled={currentIndex >= hands.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-all disabled:opacity-30 hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: '#9ca3af' }}>
              <ChevronRight size={14} />
            </button>
            {selectedHand?.title && <span className="ml-2 truncate text-[11px] font-bold text-white/80">{selectedHand.title}</span>}
          </div>
        )}

        {/* Replayer OR Expanded Image */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border p-2 sm:p-3"
          style={{ borderColor: 'rgba(192,145,30,0.12)', background: DARKER_PANEL, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 40px -16px rgba(0,0,0,0.7)' }}>
          {expandedView ? (
            <ExpandedImageView
              images={images}
              imageIndex={imageIndex}
              onPrev={() => goExpandedImage('prev')}
              onNext={() => goExpandedImage('next')}
              onReturn={() => setExpandedView(false)}
            />
          ) : handLoadState === 'loading' ? (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
              <span className="mt-3 text-[12px] text-white/40">Loading hand...</span>
            </div>
          ) : handLoadState === 'error' ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-amber-500" strokeWidth={1.5} />
              <h3 className="mb-1 text-base font-bold text-white">Unable to load hand</h3>
              <p className="max-w-sm text-[12px] text-white/50">Hand ID: {selectedHand?.hand_id ?? 'unknown'}</p>
            </div>
          ) : normalizedHand && handLoadState === 'ready' ? (
            <div className="h-full overflow-auto">
              <HHReplayer hand={normalizedHand} variant="embedded" visualSize="main" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Play className="mb-3 h-10 w-10" strokeWidth={1.5} style={{ color: 'rgba(192,145,30,0.4)' }} />
              <h3 className="mb-1 text-base font-bold text-white">No hand loaded</h3>
              <p className="max-w-xs text-[12px] text-white/40">Select a hand from Students or Lessons to begin reviewing.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Notes (top 50%) + Images (bottom 50%) ── */}
      {!rightCollapsed && (
        <div className="flex w-72 shrink-0 flex-col gap-2">
          <button onClick={() => setRightCollapsed(true)}
            className="flex shrink-0 items-center justify-center rounded-lg border py-1 text-white/30 hover:text-white/60"
            style={{ borderColor: BORDER, background: DARK_PANEL }}>
            <ChevronRight size={14} />
          </button>

          {/* ══ TOP HALF: NOTES ══ */}
          <div className="flex min-h-0 flex-[1] flex-col rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
            {/* Tab bar */}
            <div className="flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1.5" style={{ borderColor: BORDER }}>
              {([
                { id: 'coach' as const, label: 'Coach', icon: BookOpen },
                { id: 'general' as const, label: 'General', icon: FileText },
                { id: 'current' as const, label: 'Hand', icon: Layers },
                ...(hasStudentNotes ? [{ id: 'student' as const, label: 'Student', icon: GraduationCap }] : []),
              ]).map(t => (
                <button key={t.id} onClick={() => setNoteTab(t.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-all ${noteTab === t.id ? 'text-[#080706]' : 'text-white/40 hover:text-white/70'}`}
                  style={{ background: noteTab === t.id ? GOLD : 'transparent' }}>
                  <t.icon size={10} /> {t.label}
                </button>
              ))}
              {noteTab === 'coach' && selectedHand && (
                <button onClick={saveCoachNote} disabled={savingNote}
                  className="ml-auto flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
                  style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                  <Save size={9} /> {savingNote ? '...' : 'Save'}
                </button>
              )}
            </div>

            {/* Tab content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {noteTab === 'general' && (
                <textarea value={generalNote} onChange={(e) => setGeneralNote(e.target.value)}
                  placeholder="Notes for the entire review session / bundle..."
                  className="w-full resize-none rounded-lg border p-2.5 text-[11px] leading-relaxed text-white/80 placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
                  style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)', minHeight: '100%' }} />
              )}
              {noteTab === 'current' && selectedHand && (
                <div className="space-y-2">
                  <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Hand Title</div>
                    <p className="mt-0.5 text-[11px] text-white/80">{selectedHand.title || selectedHand.hand_id}</p>
                  </div>
                  <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Review Status</div>
                    <p className="mt-0.5 text-[11px] text-white/80">{STATUS_META[selectedHand.review_status]?.label ?? selectedHand.review_status}</p>
                  </div>
                  {selectedHand.student_general_note && (
                    <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Student General Note</div>
                      <p className="mt-0.5 text-[11px] italic text-white/70">{selectedHand.student_general_note}</p>
                    </div>
                  )}
                </div>
              )}
              {noteTab === 'student' && selectedHand && hasStudentNotes && (
                <div className="space-y-2">
                  {ctx?.studentNote && (
                    <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(192,145,30,0.15)', background: 'rgba(192,145,30,0.05)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Overall Question</div>
                      <p className="mt-0.5 text-[11px] italic text-white/70">{ctx.studentNote}</p>
                    </div>
                  )}
                  {selectedHand.student_general_note && (
                    <div className="rounded-lg border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">General</div>
                      <p className="mt-0.5 text-[11px] italic text-white/70">{selectedHand.student_general_note}</p>
                    </div>
                  )}
                  {(['preflop', 'flop', 'turn', 'river'] as const).map(street => {
                    const note = selectedHand[`student_${street}_note` as keyof LabHand] as string;
                    if (!note) return null;
                    return (
                      <div key={street} className="rounded-lg border p-2" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">{street}</div>
                        <p className="mt-0.5 text-[11px] italic text-white/70">{note}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {noteTab === 'coach' && selectedHand && (
                <textarea value={coachNoteDraft} onChange={(e) => setCoachNoteDraft(e.target.value)}
                  placeholder="Key concept, mistake/leak, preferred thought process, strategic explanation..."
                  className="w-full resize-none rounded-lg border p-2.5 text-[11px] leading-relaxed text-white/80 placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
                  style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)', minHeight: '100%' }} />
              )}
              {!selectedHand && (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-[11px] text-white/30">Select a hand to add notes.</p>
                </div>
              )}
            </div>
          </div>

          {/* ══ BOTTOM HALF: REFERENCE IMAGES ══ */}
          <div className="flex min-h-0 flex-[1] flex-col rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-1.5">
                <ImageIcon size={12} className="text-white/60" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Reference Images</span>
                {images.length > 0 && <span className="text-[9px] font-mono text-white/30">({images.length})</span>}
              </div>
              <div className="flex items-center gap-1">
                {imageMode === 'carousel' && images.length > 0 && (
                  <button onClick={() => setImageMode('upload')}
                    className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ borderColor: BORDER, color: '#9ca3af', background: 'rgba(255,255,255,0.02)' }}>
                    <Pencil size={9} /> Edit
                  </button>
                )}
                {imageMode === 'carousel' && images.length > 0 && (
                  <button onClick={() => setExpandedView(true)}
                    className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                    style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                    <Maximize2 size={10} /> Expand
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 p-2">
              {!selectedHand ? (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-[10px] text-white/30">Select a hand first.</p>
                </div>
              ) : imageMode === 'upload' ? (
                <ImageUploadMode
                  pendingImages={pendingImages}
                  dragOver={dragOver}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); addPendingFiles(e.dataTransfer.files); }}
                  onBrowse={() => multiImageInputRef.current?.click()}
                  onRemove={removePendingImage}
                  onMove={movePendingImage}
                  onSet={setImages_}
                  onCancel={() => { pendingImages.forEach(p => URL.revokeObjectURL(p.previewUrl)); setPendingImages([]); setImageMode('carousel'); }}
                  uploading={uploading}
                  existingCount={images.length}
                />
              ) : images.length === 0 ? (
                <div className="flex h-full flex-col"
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); if (selectedHand) { setImageMode('upload'); addPendingFiles(e.dataTransfer.files); } }}>
                  <button onClick={() => multiImageInputRef.current?.click()}
                    className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${dragOver ? 'scale-[1.01]' : ''}`}
                    style={{
                      borderColor: dragOver ? GOLD : 'rgba(255,255,255,0.15)',
                      background: dragOver ? 'rgba(192,145,30,0.06)' : 'rgba(255,255,255,0.015)',
                    }}>
                    <Upload size={22} className="mb-2 text-white/25" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Drop Images Here</span>
                    <span className="mt-1 text-[9px] text-white/25">Range screenshots, solver outputs, graphs, charts</span>
                    <span className="mt-3 rounded-md border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest"
                      style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                      Browse Files
                    </span>
                    <span className="mt-2 text-[8px] text-white/20">PNG · JPG · WEBP · Multiple files supported</span>
                  </button>
                </div>
              ) : (
                <ImageCarouselMode
                  images={images}
                  imageIndex={imageIndex}
                  onPrev={() => setImageIndex(i => Math.max(0, i - 1))}
                  onNext={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}
                  onSelect={setImageIndex}
                  onDelete={deleteImage}
                  onExpand={() => setExpandedView(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {rightCollapsed && (
        <button onClick={() => setRightCollapsed(false)}
          className="flex w-8 shrink-0 items-center justify-center rounded-xl border text-white/40 hover:text-white/70"
          style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
      <input ref={multiImageInputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files) addPendingFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ── Expanded Image View (projects over replayer area) ──

function ExpandedImageView({ images, imageIndex, onPrev, onNext, onReturn }: {
  images: LabHandImage[];
  imageIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onReturn: () => void;
}) {
  const img = images[imageIndex];
  if (!img) return null;
  return (
    <div className="flex h-full flex-col">
      {/* Top bar: counter + caption + return */}
      <div className="flex shrink-0 items-center gap-3 px-2 pb-2">
        <span className="text-[11px] font-mono font-bold text-white/60">{imageIndex + 1} / {images.length}</span>
        {img.caption && <span className="truncate text-[11px] text-white/50">— {img.caption}</span>}
        <button onClick={onReturn}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
          <Minimize2 size={13} /> Return to Replayer
        </button>
      </div>

      {/* Large image */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img src={img.image_url} alt={img.caption || 'Reference'} className="max-h-full max-w-full object-contain" />
        {images.length > 1 && (
          <>
            <button onClick={onPrev} disabled={imageIndex === 0}
              className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              <ChevronLeft size={24} />
            </button>
            <button onClick={onNext} disabled={imageIndex >= images.length - 1}
              className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Image Upload Mode (staging area before SET) ──

function ImageUploadMode({ pendingImages, dragOver, onDragOver, onDragLeave, onDrop, onBrowse, onRemove, onMove, onSet, onCancel, uploading, existingCount }: {
  pendingImages: { file: File; previewUrl: string }[];
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number, dir: 'left' | 'right') => void;
  onSet: () => void;
  onCancel: () => void;
  uploading: boolean;
  existingCount: number;
}) {
  return (
    <div className="flex h-full flex-col gap-2">
      {/* Drop zone */}
      <button
        onClick={onBrowse}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed py-4 transition-all ${dragOver ? 'scale-[1.02]' : ''}`}
        style={{
          borderColor: dragOver ? GOLD : 'rgba(255,255,255,0.15)',
          background: dragOver ? 'rgba(192,145,30,0.08)' : 'rgba(255,255,255,0.02)',
        }}
      >
        {uploading ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
        ) : (
          <>
            <Upload size={18} className="mb-1 text-white/30" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Drop images or browse</span>
          </>
        )}
      </button>

      {/* Pending thumbnails */}
      {pendingImages.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-1.5">
            {pendingImages.map((p, i) => (
              <div key={i} className="group relative overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
                <img src={p.previewUrl} alt="" className="h-20 w-full object-cover" />
                <div className="absolute right-1 top-1 flex gap-0.5">
                  <button onClick={() => onMove(i, 'left')} disabled={i === 0}
                    className="flex h-5 w-5 items-center justify-center rounded border backdrop-blur-sm transition-all disabled:opacity-20 hover:scale-110"
                    style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    <ChevronLeft size={10} />
                  </button>
                  <button onClick={() => onMove(i, 'right')} disabled={i === pendingImages.length - 1}
                    className="flex h-5 w-5 items-center justify-center rounded border backdrop-blur-sm transition-all disabled:opacity-20 hover:scale-110"
                    style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                    <ChevronRight size={10} />
                  </button>
                  <button onClick={() => onRemove(i)}
                    className="flex h-5 w-5 items-center justify-center rounded border backdrop-blur-sm transition-all hover:scale-110 hover:border-red-500/40 hover:bg-red-500/10"
                    style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#f87171' }}>
                    <X size={10} />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[8px] truncate text-white/50">{p.file.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={onBrowse}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ borderColor: BORDER, color: '#9ca3af', background: 'rgba(255,255,255,0.02)' }}>
          <Plus size={10} /> Add More
        </button>
        {pendingImages.length > 0 && (
          <>
            <button onClick={onCancel}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-all hover:text-white/80"
              style={{ borderColor: BORDER, color: '#9ca3af' }}>
              Cancel
            </button>
            <button onClick={onSet} disabled={uploading}
              className="ml-auto flex items-center gap-1 rounded-md border px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
              style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              <CheckCircle2 size={11} /> Set Images
            </button>
          </>
        )}
      </div>
      {existingCount > 0 && (
        <p className="shrink-0 text-[8px] text-white/30">{existingCount} existing image(s) will be kept.</p>
      )}
    </div>
  );
}

// ── Image Carousel Mode (viewing saved images) ──

function ImageCarouselMode({ images, imageIndex, onPrev, onNext, onSelect, onDelete, onExpand }: {
  images: LabHandImage[];
  imageIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (i: number) => void;
  onDelete: (id: string) => void;
  onExpand: () => void;
}) {
  const currentImage = images[imageIndex];
  return (
    <div className="flex h-full flex-col">
      {/* Main image */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(0,0,0,0.5)' }}>
        {currentImage && <img src={currentImage.image_url} alt={currentImage.caption || 'Reference'} className="max-h-full max-w-full object-contain" />}
        {images.length > 1 && (
          <>
            <button onClick={onPrev} disabled={imageIndex === 0}
              className="absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={onNext} disabled={imageIndex >= images.length - 1}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 disabled:opacity-20"
              style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
              <ChevronRight size={16} />
            </button>
          </>
        )}
        <button onClick={() => currentImage && onDelete(currentImage.id)}
          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition-all hover:scale-110 hover:border-red-500/40 hover:bg-red-500/10"
          style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#f87171' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Counter + caption */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] font-mono text-white/40">{imageIndex + 1} / {images.length}</span>
        {currentImage?.caption && <span className="truncate text-[10px] text-white/50">{currentImage.caption}</span>}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
          {images.map((img, i) => (
            <button key={img.id} onClick={() => onSelect(i)}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-md border transition-all"
              style={{ borderColor: i === imageIndex ? GOLD : BORDER, opacity: i === imageIndex ? 1 : 0.5 }}>
              <img src={img.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STUDENTS TAB — compact list/table with expandable student workspace
// ════════════════════════════════════════════════════════════════

function StudentsTab({ onPlayHand }: { onPlayHand: (student: CoachStudent, handIndex: number) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'recent'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const activeStudents = COACH_STUDENTS.filter(s => s.status === 'active');

  const filtered = activeStudents.filter(s => {
    if (query && !s.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'awaiting' && s.handsWaitingReview === 0) return false;
    if (filter === 'recent' && s.daysSinceLastSession > 14) return false;
    return true;
  });

  const selectedStudent = activeStudents.find(s => s.id === selectedStudentId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Search + filters */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" strokeWidth={1.5} />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full rounded-lg border py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#d4a52c]/30"
            style={{ borderColor: BORDER, background: DARK_PANEL, paddingLeft: '2.5rem' }} />
        </div>
        <div className="flex gap-1">
          {([
            { id: 'all' as const, label: 'All' },
            { id: 'awaiting' as const, label: 'Awaiting' },
            { id: 'recent' as const, label: 'Recent' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${filter === f.id ? 'text-[#080706]' : 'text-white/50 hover:text-white/70'}`}
              style={{ borderColor: filter === f.id ? GOLD : BORDER, background: filter === f.id ? GOLD : DARK_PANEL }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student table */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        {/* Header row */}
        <div className="sticky top-0 z-10 grid gap-2 border-b px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/40"
          style={{ gridTemplateColumns: FEATURE_FLAGS.spiEnabled ? '1.5fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr 0.8fr' : '1.5fr 0.6fr 0.6fr 0.8fr 0.8fr 0.8fr', borderColor: BORDER, background: 'rgba(5,7,10,0.98)' }}>
          <span>Student</span>
          {FEATURE_FLAGS.spiEnabled && <span className="text-center">SPI</span>}
          <span className="text-center">ROI</span>
          <span className="text-center">BB/100</span>
          <span className="text-center">Submitted</span>
          <span className="text-center">Awaiting</span>
          <span className="text-center">Last Activity</span>
        </div>

        {/* Rows */}
        {filtered.map(s => (
          <div key={s.id}>
            <button onClick={() => setSelectedStudentId(selectedStudentId === s.id ? null : s.id)}
              className="grid w-full gap-2 border-b px-4 py-2.5 text-left transition-all hover:bg-white/[0.03]"
              style={{ gridTemplateColumns: FEATURE_FLAGS.spiEnabled ? '1.5fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr 0.8fr' : '1.5fr 0.6fr 0.6fr 0.8fr 0.8fr 0.8fr', borderColor: BORDER, background: selectedStudentId === s.id ? 'rgba(201,162,39,0.06)' : 'transparent' }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold"
                  style={{ borderColor: 'rgba(192,145,30,0.3)', background: 'linear-gradient(to bottom, #2a2010, #1a1408)', color: GOLD }}>
                  {s.avatarInitials}
                </div>
                <span className="truncate text-[12px] font-semibold text-white">{s.name}</span>
                {s.trend === 'improving' && <TrendingUp size={11} className="text-emerald-400" />}
                {s.trend === 'declining' && <TrendingDown size={11} className="text-red-400" />}
              </div>
              {FEATURE_FLAGS.spiEnabled && <span className="text-center text-[12px] font-bold text-white">{s.spi}</span>}
              <span className="text-center text-[12px] font-bold text-emerald-400">{s.roi}%</span>
              <span className="text-center text-[12px] font-bold text-white">+{s.bb100}</span>
              <span className="text-center text-[11px] text-white/60">{s.hands.length}</span>
              <span className="text-center">
                {s.handsWaitingReview > 0 ? (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(201,162,39,0.15)', color: GOLD }}>{s.handsWaitingReview}</span>
                ) : (
                  <span className="text-[11px] text-white/30">—</span>
                )}
              </span>
              <span className="text-center text-[10px] text-white/40">{s.lastHhUpload}</span>
            </button>

            {/* Expanded student workspace */}
            {selectedStudentId === s.id && (
              <StudentWorkspaceInline student={s} onPlayHand={(handIndex) => onPlayHand(s, handIndex)} />
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-[12px] text-white/30">No students found.</div>
        )}
      </div>
    </div>
  );
}

// ── Inline student workspace (analytics + submitted hands) ──

function StudentWorkspaceInline({ student, onPlayHand }: {
  student: CoachStudent;
  onPlayHand: (handIndex: number) => void;
}) {
  const s = student.currentSnapshot;
  return (
    <div className="border-b p-4" style={{ borderColor: BORDER, background: 'rgba(5,7,10,0.6)' }}>
      {/* Summary header */}
      <div className="mb-3 flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: BORDER, background: 'rgba(8,11,14,0.6)' }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold"
          style={{ borderColor: 'rgba(192,145,30,0.3)', background: 'linear-gradient(to bottom, #2a2010, #1a1408)', color: GOLD }}>
          {student.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">{student.name}</h3>
          <p className="text-[10px] text-white/40">{student.gameType} · {student.stakes} · Since {new Date(student.coachingSince).getFullYear()}</p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <Stat label="ABI" value={`$${s.abi}`} />
          <Stat label="ROI" value={`${s.roi}%`} green />
          {FEATURE_FLAGS.spiEnabled && <Stat label="SPI" value={`${s.spi}`} />}
          <Stat label="BB/100" value={`+${s.bb100}`} />
          <Stat label="Profit" value={`+$${s.profit.toLocaleString()}`} gold />
          {student.trend === 'improving' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><TrendingUp size={12} /> Improving</span>
          ) : student.trend === 'declining' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-400"><TrendingDown size={12} /> Declining</span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-bold text-white/40"><TrendingUp size={12} className="opacity-40" /> Stable</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Analytics */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
            <BarChart3 size={12} /> Analytics
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MetricSmall label="Volume" value={`${s.volume} tourneys`} />
            <MetricSmall label="Tourn. Results" value={`+$${s.tournamentResults.toLocaleString()}`} />
            <MetricSmall label="Bankroll" value={`$${s.bankroll.toLocaleString()}`} />
            <MetricSmall label="River Agg" value={`${s.riverAggression}`} />
            <MetricSmall label="Preflop Agg" value={`${s.preflopAggression}`} />
          </div>
          {!student.analyticsPermission && (
            <p className="mt-2 text-[10px] text-white/30">Full analytics locked — student has not granted permission.</p>
          )}
        </div>

        {/* Submitted hands */}
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
            <FileText size={12} /> Submitted Hands ({student.hands.length})
          </h4>
          <div className="space-y-1.5">
            {student.hands.length === 0 ? (
              <p className="text-[11px] text-white/30">No hands submitted.</p>
            ) : (
              student.hands.map((h, i) => {
                const statusMeta = h.markedAs === 'needs_review' ? STATUS_META.needs_review
                  : h.markedAs === 'reviewed' || h.markedAs === 'complete' ? STATUS_META.reviewed
                  : STATUS_META.follow_up;
                return (
                  <div key={h.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: 'rgba(8,11,14,0.6)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-white/80">{h.title}</div>
                      <div className="text-[9px] text-white/40">{h.stakes} · {h.position} · {h.uploadedAt}</div>
                    </div>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                      style={{ background: `${statusMeta.color}22`, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                    <button onClick={() => onPlayHand(i)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all hover:scale-110"
                      style={{ borderColor: GOLD, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                      <Play size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-mono tracking-widest uppercase text-white/40">{label}</span>
      <span className={`text-sm font-bold ${gold ? 'text-[#d4a52c]' : green ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function MetricSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: 'rgba(8,11,14,0.6)' }}>
      <div className="text-[9px] font-mono tracking-widest uppercase text-white/40">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-white/80">{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// LESSONS TAB — list + create + open lesson in replayer
// ════════════════════════════════════════════════════════════════

function LessonsTab({ account, onPlayLesson }: {
  account: SpotVaultAccount;
  onPlayLesson: (lesson: LabLesson, hands: LabHand[], index: number) => void;
}) {
  const [lessons, setLessons] = useState<LabLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddHands, setShowAddHands] = useState<LabLesson | null>(null);
  const [lessonHands, setLessonHands] = useState<Record<string, LabHand[]>>({});

  const fetchLessons = useCallback(async () => {
    if (!account?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('coach_lab_lessons')
      .select('*')
      .eq('coach_account_id', account.id)
      .in('collection_type', ['lesson', 'review_set'])
      .order('created_at', { ascending: false });
    if (!error && data) {
      setLessons(data as LabLesson[]);
      // Fetch hands for each lesson
      const handsMap: Record<string, LabHand[]> = {};
      for (const lesson of data as LabLesson[]) {
        const { data: hd } = await supabase
          .from('coach_lab_hands')
          .select('*')
          .eq('lesson_id', lesson.id)
          .order('sort_order', { ascending: true });
        handsMap[lesson.id] = (hd ?? []) as LabHand[];
      }
      setLessonHands(handsMap);
    }
    setLoading(false);
  }, [account?.id]);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">Lessons & Review Sets</span>
        <button onClick={() => setShowCreateModal(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
          <Plus size={14} /> Create Lesson
        </button>
      </div>

      {/* Lesson list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
          </div>
        ) : lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-white/15" strokeWidth={1.5} />
            <h3 className="mb-1 text-sm font-bold text-white">No lessons yet</h3>
            <p className="mb-4 max-w-xs text-[12px] text-white/40">Create your first lesson to start building coaching material.</p>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all hover:scale-105"
              style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              <Plus size={14} /> Create
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {lessons.map(l => {
              const lh = lessonHands[l.id] ?? [];
              return (
                <div key={l.id} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-white">{l.title}</h3>
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                          style={{ background: l.collection_type === 'lesson' ? 'rgba(201,162,39,0.15)' : 'rgba(96,165,250,0.15)', color: l.collection_type === 'lesson' ? GOLD : '#60a5fa' }}>
                          {l.collection_type === 'lesson' ? 'Lesson' : 'Review Set'}
                        </span>
                      </div>
                      {l.description && <p className="mt-1 text-[11px] text-white/40 line-clamp-2">{l.description}</p>}
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-white/30">
                        <span>{lh.length} hands</span>
                        <span>·</span>
                        <span>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {l.tags.length > 0 && (
                          <>
                            <span>·</span>
                            <span>{l.tags.join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => setShowAddHands(l)}
                        className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                        style={{ borderColor: BORDER, color: '#9ca3af', background: 'rgba(255,255,255,0.02)' }}>
                        <Plus size={11} /> Hands
                      </button>
                      {lh.length > 0 && (
                        <button onClick={() => onPlayLesson(l, lh, 0)}
                          className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                          style={{ borderColor: GOLD, color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
                          <Play size={11} /> Open
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hand list preview */}
                  {lh.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {lh.slice(0, 4).map((h, i) => (
                        <div key={h.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
                          <span className="text-[9px] font-mono text-white/30">{i + 1}</span>
                          <span className="flex-1 truncate text-[11px] text-white/70">{h.title || h.hand_id.slice(0, 16)}</span>
                          <span className="text-[9px] text-white/30">{h.review_status.replace('_', ' ')}</span>
                        </div>
                      ))}
                      {lh.length > 4 && <div className="text-[10px] text-white/30">+ {lh.length - 4} more...</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateLessonModal account={account} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchLessons(); }} />
      )}
      {showAddHands && (
        <AddHandsModal account={account} lesson={showAddHands} onClose={() => setShowAddHands(null)} onAdded={() => { setShowAddHands(null); fetchLessons(); }} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CREATE LESSON MODAL
// ════════════════════════════════════════════════════════════════

function CreateLessonModal({ account, onClose, onCreated }: {
  account: SpotVaultAccount;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [collectionType, setCollectionType] = useState<'lesson' | 'review_set'>('lesson');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('coach_lab_lessons').insert({
      coach_account_id: account.id,
      title: title.trim(),
      description: description.trim(),
      collection_type: collectionType,
      status: 'draft',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setCreating(false);
    if (!error) onCreated();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ borderColor: 'rgba(192,145,30,0.2)', background: DARKER_PANEL }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">New {collectionType === 'lesson' ? 'Lesson' : 'Review Set'}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['lesson', 'review_set'] as const).map(t => (
              <button key={t} onClick={() => setCollectionType(t)}
                className={`flex-1 rounded-lg border py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${collectionType === t ? 'text-[#080706]' : 'text-white/50'}`}
                style={{ borderColor: collectionType === t ? GOLD : BORDER, background: collectionType === t ? GOLD : 'transparent' }}>
                {t === 'lesson' ? 'Lesson' : 'Review Set'}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              placeholder="e.g. C-Betting, 3-Bet Pots, BB Defense..."
              className="w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
              style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)' }} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Lesson summary or student assignment..."
              className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
              style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)', minHeight: '70px' }} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. preflop, tournament, ICM"
              className="w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
              style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)' }} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white/50 transition-all hover:text-white/80"
            style={{ borderColor: BORDER, background: DARK_PANEL }}>Cancel</button>
          <button onClick={handleCreate} disabled={creating || !title.trim()}
            className="rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
            style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ADD HANDS MODAL
// ════════════════════════════════════════════════════════════════

function AddHandsModal({ account, lesson, onClose, onAdded }: {
  account: SpotVaultAccount;
  lesson: LabLesson;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<'vault' | 'demo' | 'paste'>('demo');
  const [vaultHands, setVaultHands] = useState<{ hand_id: string; played_at: string; blinds: string | null; position: string | null; net_result: number | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingVault, setLoadingVault] = useState(false);
  const [pastedText, setPastedText] = useState('');

  useEffect(() => {
    if (mode === 'vault' && account?.id) {
      setLoadingVault(true);
      supabase
        .from('poker_hand_records')
        .select('hand_id, played_at, blinds, position, net_result')
        .eq('user_id', account.id)
        .order('played_at', { ascending: false })
        .range(0, 49)
        .then(({ data }) => {
          if (data) setVaultHands(data);
          setLoadingVault(false);
        });
    }
  }, [mode, account?.id]);

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleAdd = async () => {
    let ids: string[] = [];
    if (mode === 'paste' && pastedText.trim()) {
      ids = [`PASTE-${Date.now()}`];
    } else {
      ids = Array.from(selected);
    }
    if (ids.length === 0) return;

    // Fetch existing hands count for sort_order
    const { data: existing } = await supabase
      .from('coach_lab_hands')
      .select('id')
      .eq('lesson_id', lesson.id);
    const nextOrder = existing?.length ?? 0;

    const rows = ids.map((hid, i) => ({
      lesson_id: lesson.id,
      hand_id: hid,
      sort_order: nextOrder + i,
      review_status: 'needs_review' as ReviewStatus,
    }));
    await supabase.from('coach_lab_hands').insert(rows);
    onAdded();
  };

  const demoHands = DEMO_REPLAYER_HANDS.map(h => ({ hand_id: h.handId, title: h.title ?? h.handId }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border" style={{ borderColor: 'rgba(192,145,30,0.2)', background: DARKER_PANEL }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BORDER }}>
          <h3 className="text-base font-bold text-white">Add Hands to "{lesson.title}"</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={18} /></button>
        </div>

        <div className="flex gap-1 border-b px-4 py-2" style={{ borderColor: BORDER }}>
          {([
            { id: 'demo' as const, label: 'Demo Hands', icon: Play },
            { id: 'vault' as const, label: 'From Vault', icon: FolderOpen },
            { id: 'paste' as const, label: 'Paste HH', icon: FileText },
          ]).map(t => (
            <button key={t.id} onClick={() => setMode(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${mode === t.id ? 'text-[#080706]' : 'text-white/50 hover:text-white/70'}`}
              style={{ background: mode === t.id ? GOLD : 'transparent' }}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {mode === 'demo' && (
            <div className="space-y-1">
              {demoHands.map(h => (
                <button key={h.hand_id} onClick={() => toggle(h.hand_id)}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all"
                  style={{
                    background: selected.has(h.hand_id) ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${selected.has(h.hand_id) ? 'rgba(201,162,39,0.4)' : BORDER}`,
                  }}>
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected.has(h.hand_id) ? 'bg-[#d4a52c] border-[#d4a52c]' : 'border-white/20'}`}>
                    {selected.has(h.hand_id) && <CheckCircle2 size={13} className="text-[#080706]" />}
                  </div>
                  <span className="flex-1 truncate text-[11px] font-semibold text-white/80">{h.title || h.hand_id}</span>
                  <span className="font-mono text-[9px] text-white/30">{h.hand_id}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'vault' && (
            loadingVault ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
              </div>
            ) : vaultHands.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-white/30">No hands found in your vault.</div>
            ) : (
              <div className="space-y-1">
                {vaultHands.map(h => (
                  <button key={h.hand_id} onClick={() => toggle(h.hand_id)}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all"
                    style={{
                      background: selected.has(h.hand_id) ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${selected.has(h.hand_id) ? 'rgba(201,162,39,0.4)' : BORDER}`,
                    }}>
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected.has(h.hand_id) ? 'bg-[#d4a52c] border-[#d4a52c]' : 'border-white/20'}`}>
                      {selected.has(h.hand_id) && <CheckCircle2 size={13} className="text-[#080706]" />}
                    </div>
                    <span className="flex-1 truncate font-mono text-[11px] text-white/70">{h.hand_id}</span>
                    {h.position && <span className="text-[9px] uppercase text-white/40">{h.position}</span>}
                    {h.net_result != null && <span className="text-[11px] font-bold" style={{ color: Number(h.net_result) > 0 ? '#4ade80' : '#f87171' }}>{Number(h.net_result) > 0 ? '+' : ''}{Number(h.net_result).toLocaleString()}</span>}
                  </button>
                ))}
              </div>
            )
          )}
          {mode === 'paste' && (
            <div>
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste a raw hand history here..."
                className="w-full resize-none rounded-lg border p-3 font-mono text-[11px] text-white/70 placeholder:text-white/20 outline-none focus:border-[#d4a52c]/30"
                style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)', minHeight: '200px' }} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: BORDER }}>
          <span className="text-[10px] text-white/40">{selected.size} hand(s) selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white/50 transition-all hover:text-white/80"
              style={{ borderColor: BORDER, background: DARK_PANEL }}>Cancel</button>
            <button onClick={handleAdd} disabled={mode !== 'paste' && selected.size === 0}
              className="rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50"
              style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
              Add to Lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
