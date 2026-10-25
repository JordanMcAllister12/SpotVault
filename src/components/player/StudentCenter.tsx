import { useCallback, useEffect, useState, useRef } from 'react';
import {
  GraduationCap, AudioLines,
  Loader2, CheckCircle2, X, ClipboardPaste, Upload, ChevronLeft,
  Plus, FileText, Pencil, ChevronDown, Bookmark, Trophy, Package,
  Presentation, FolderOpen, Mic, Video, Link as LinkIcon, Copy, Check, Play,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { HandReviewWorkspace } from '@/components/player/HandReviewWorkspace';
import { DEMO_REVIEW_SET } from '@/data/demoReviewHands';
import { HandUploadBar } from '@/components/player/HandUploadBar';
import { TournamentLibrary } from '@/components/player/TournamentLibrary';

import { getMyRelationships, type Relationship } from '@/lib/authEngine';
import { supabase } from '@/lib/supabase';
import { fetchBatches, type HandBatch } from '@/lib/batchStore';
import {
  fetchTournaments, importTournament, renameTournament, deleteTournament,
  saveLastViewedHand, type TournamentBatch, type TournamentImportResult,
} from '@/lib/tournamentStore';
import { ENTITLEMENTS, resolveTier } from '@/lib/entitlements';
import { fetchRecordings, buildPresentationLink, type PresentationRecording } from '@/lib/presentationRecordingStore';

const GOLD = '#d4a52c';

type HeaderDropdown = 'upload' | 'tools' | 'saved' | null;

export function StudentCenter({ onMessageCoach, fill, initialBatchId, onBatchConsumed, initialHandId, onHandConsumed, showReturnButton, onReturn }: { onMessageCoach: () => void; fill?: boolean; initialBatchId?: string | null; onBatchConsumed?: () => void; initialHandId?: string | null; onHandConsumed?: () => void; showReturnButton?: boolean; onReturn?: () => void }) {
  void onMessageCoach;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [showAddHandSheet, setShowAddHandSheet] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [handCount, setHandCount] = useState(0);
  const [batches, setBatches] = useState<HandBatch[]>([]);
  const [currentBatch, setCurrentBatch] = useState<HandBatch | null>(null);

  // Tournament state
  const [tournaments, setTournaments] = useState<TournamentBatch[]>([]);
  const [showTournamentLibrary, setShowTournamentLibrary] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<TournamentImportResult | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [constructSignal, setConstructSignal] = useState(0);
  const [presentationMode, setPresentationMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified header dropdown state
  const [openDropdown, setOpenDropdown] = useState<HeaderDropdown>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Saved dropdown subtab
  const [savedSubtab, setSavedSubtab] = useState<'individual' | 'tournaments' | 'batches' | 'presentations'>('tournaments');
  const [savedRecordings, setSavedRecordings] = useState<PresentationRecording[]>([]);
  const [savedRecLoading, setSavedRecLoading] = useState(false);
  const [copiedPresId, setCopiedPresId] = useState<string | null>(null);

  // Entitlement
  const [tournamentLimit, setTournamentLimit] = useState<number | null>(null);
  const [savedTournamentCount, setSavedTournamentCount] = useState(0);

  useEffect(() => {
    (async () => {
      const rels = await getMyRelationships('coach_student');
      setRelationships(rels);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        const tier = resolveTier(profile as { role?: string } | null);
        setTournamentLimit(ENTITLEMENTS[tier].savedTournaments);
      }
    })();
  }, []);

  const loadBatches = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const list = await fetchBatches(userData.user.id);
    setBatches(list);
    const tList = list.filter((b): b is TournamentBatch => (b as TournamentBatch).is_tournament === true);
    setTournaments(tList);
    setSavedTournamentCount(tList.length);
    if (list.length > 0) {
      setCurrentBatch((prev) => prev ? list.find((b) => b.id === prev.id) ?? list[0] : list[0]);
    } else {
      setCurrentBatch(null);
    }
  }, []);

  useEffect(() => { void loadBatches(); }, [loadBatches, reloadKey]);

  useEffect(() => {
    if (openDropdown === 'saved' && savedSubtab === 'presentations' && savedRecordings.length === 0 && !savedRecLoading) {
      setSavedRecLoading(true);
      fetchRecordings().then((recs) => {
        setSavedRecordings(recs);
        setSavedRecLoading(false);
      });
    }
  }, [openDropdown, savedSubtab, savedRecordings.length, savedRecLoading]);

  useEffect(() => {
    if (!initialBatchId || batches.length === 0) return;
    const target = batches.find((b) => b.id === initialBatchId);
    if (target) {
      setCurrentBatch(target);
      setReloadKey((k) => k + 1);
      onBatchConsumed?.();
    }
  }, [initialBatchId, batches, onBatchConsumed]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]);

  const activeCoach = relationships.find((r) => r.status === 'active');
  const coachName = (activeCoach?.metadata?.coach_name as string) ?? 'Kevin Martin';
  const coachId = activeCoach
    ? (activeCoach.user_a !== activeCoach.user_b ? (activeCoach.user_a === relationships[0]?.user_a ? activeCoach.user_b : activeCoach.user_a) : undefined)
    : undefined;

  const handleTournamentFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      await doTournamentImport(text, 'file_upload', file.name.replace(/\.(txt|hh|history)$/i, ''));
    };
    reader.readAsText(file);
  };

  const handleTournamentPaste = async () => {
    if (!pasteText.trim()) return;
    await doTournamentImport(pasteText, 'paste');
    setShowPasteModal(false);
    setPasteText('');
  };

  const doTournamentImport = async (rawText: string, sourceType: 'paste' | 'file_upload', fileName?: string) => {
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setImportError('Authentication required. Please sign in.');
        setIsImporting(false);
        return;
      }

      const result = await importTournament(user.id, rawText, sourceType, fileName);
      setImportResult(result);

      if (result.rejected) {
        setImportError(
          `This tournament contains ${result.rejectedHandCount} hands. SpotVault currently supports a maximum of 1,000 hands per tournament.`
        );
        setImportResult(null);
      } else if (result.tournament) {
        await loadBatches();
        const fresh = await fetchTournaments(user.id);
        const imported = fresh.find((t) => t.id === result.tournament!.id);
        if (imported) {
          setCurrentBatch(imported);
        }
        setReloadKey((k) => k + 1);
      } else if (result.errors > 0 && result.added === 0) {
        setImportError(`Could not parse any hands from the provided text. ${result.errors} parse error(s).`);
      }
    } catch (err) {
      console.error('Tournament import:', err);
      setImportError('Import failed. Please check your hand history format.');
    }
    setIsImporting(false);
  };

  const handleRenameTournament = async (id: string, title: string) => {
    await renameTournament(id, title);
    await loadBatches();
  };

  const handleDeleteTournament = async (id: string) => {
    await deleteTournament(id);
    if (currentBatch?.id === id) {
      setCurrentBatch(null);
    }
    await loadBatches();
    setReloadKey((k) => k + 1);
  };

  const handleSelectTournament = (t: TournamentBatch) => {
    setCurrentBatch(t);
    setReloadKey((k) => k + 1);
  };

  const toggleDropdown = (which: HeaderDropdown) => {
    setOpenDropdown((prev) => (prev === which ? null : which));
  };

  const personalBatches = batches.filter((b) => !(b as TournamentBatch).is_tournament);

  const dropdownBtnBase = 'hdr-glass-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap';
  const dropdownBtnActive = 'ring-1 ring-white/25';
  const dropdownBtnIdle = '';
  const menuItemBtn = 'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white';

  return (
    <div
      className="flex min-h-0 items-stretch justify-center overflow-hidden p-3 pb-1 max-md:p-1 max-md:pb-0.5 md:p-5 lg:pb-1 lg:p-6 h-full"
      style={{ maxWidth: '100vw', boxSizing: 'border-box' }}
    >
      <div className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col gap-2 max-md:gap-1" style={{ maxWidth: '1600px', boxSizing: 'border-box' }}>

        {/* ══ UNIFIED WORKSPACE HEADER ════════════════════════════════ */}
        <div
          ref={dropdownRef}
          className="relative z-50 mx-auto flex w-full shrink-0 flex-wrap items-center gap-2 rounded-xl border p-2.5 max-md:py-1.5 max-md:px-2 max-md:gap-1.5"
          style={{ borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.18)', background: 'rgba(6, 8, 10, 0.55)', backdropFilter: 'blur(12px)' }}
        >
          {/* Workspace brand */}
          <div className="flex items-center gap-2 max-md:gap-1.5">
            <GraduationCap className="h-4 w-4 max-md:h-3.5 max-md:w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
            <div className="flex items-baseline gap-2 max-md:gap-1.5">
              <h1 className="text-sm max-md:text-[12px] font-semibold tracking-tight text-white">Workspace</h1>
              <p className="text-[10px] max-md:text-[9px] max-md:hidden text-white/40">Review, annotate &amp; share your hands</p>
            </div>
          </div>

          <div className="hidden md:block h-5 w-px bg-white/10" />

          {showReturnButton && onReturn && (
            <button
              onClick={onReturn}
              className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#c0911e]/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#f5e6b0] transition hover:bg-[#c0911e]/20"
            >
              <ChevronLeft className="h-3 w-3" strokeWidth={1.5} /> Return
            </button>
          )}

          {/* Upload dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('upload')}
              className={`${dropdownBtnBase} ${openDropdown === 'upload' ? dropdownBtnActive : dropdownBtnIdle}`}
            >
              <Upload className="hdr-glass-icon h-3 w-3 shrink-0" strokeWidth={1.5} /> Upload
              <ChevronDown className={`hdr-glass-icon h-2.5 w-2.5 transition-transform ${openDropdown === 'upload' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'upload' && (
              <div className="absolute left-0 top-full z-[300] mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                <div className="p-1.5">
                  <button
                    onClick={() => { setOpenDropdown(null); setShowPasteModal(true); }}
                    className={menuItemBtn}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 text-[#d4a52c]" /> Paste Hand History
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); fileInputRef.current?.click(); }}
                    className={menuItemBtn}
                  >
                    <FileText className="h-3.5 w-3.5 text-[#d4a52c]" /> Upload File
                    <span className="ml-auto text-[8px] text-white/30">.txt .hh</span>
                  </button>
                </div>
                <div className="border-t border-white/[0.06] px-2.5 py-1.5">
                  <p className="text-[8px] text-white/30">Drag &amp; drop files anywhere on the workspace</p>
                </div>
              </div>
            )}
          </div>

          {/* Tools dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('tools')}
              className={`${dropdownBtnBase} ${openDropdown === 'tools' ? dropdownBtnActive : dropdownBtnIdle}`}
            >
              <Presentation className="hdr-glass-icon h-3 w-3 shrink-0" strokeWidth={1.5} /> Tools
              <ChevronDown className={`hdr-glass-icon h-2.5 w-2.5 transition-transform ${openDropdown === 'tools' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'tools' && (
              <div className="absolute left-0 top-full z-[300] mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                <div className="p-1.5">
                  <button
                    onClick={() => { setOpenDropdown(null); setPresentationMode((v) => !v); setShowTournamentLibrary(false); }}
                    className={menuItemBtn}
                  >
                    <AudioLines className="h-3.5 w-3.5 text-[#d4a52c]" /> Presentation Mode
                    {presentationMode && <span className="ml-auto text-[8px] font-bold text-emerald-300">ON</span>}
                  </button>
                          <button
                    onClick={() => { setOpenDropdown(null); setConstructSignal((s) => s + 1); }}
                    className={menuItemBtn}
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#d4a52c]" /> Build a Hand
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); setCurrentBatch({ id: DEMO_REVIEW_SET.id, title: DEMO_REVIEW_SET.title, hand_count: DEMO_REVIEW_SET.hand_count, is_tournament: false } as HandBatch); setReloadKey((k) => k + 1); setShowTournamentLibrary(false); }}
                    className={menuItemBtn}
                  >
                    <Play className="h-3.5 w-3.5 text-[#d4a52c]" /> Load Demo Hand
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('saved')}
              className={`${dropdownBtnBase} ${openDropdown === 'saved' ? dropdownBtnActive : dropdownBtnIdle}`}
            >
              <Bookmark className="hdr-glass-icon h-3 w-3 shrink-0" strokeWidth={1.5} /> Saved
              <ChevronDown className={`hdr-glass-icon h-2.5 w-2.5 transition-transform ${openDropdown === 'saved' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'saved' && (
              <div className="absolute right-0 top-full z-[300] mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
                {/* Subtabs */}
                <div className="flex border-b border-white/[0.06] p-1">
                  {([
                    { id: 'individual', label: 'Hands', icon: Bookmark },
                    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
                    { id: 'batches', label: 'Batches', icon: Package },
                    { id: 'presentations', label: 'Media', icon: Presentation },
                  ] as const).map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSavedSubtab(tab.id)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-bold uppercase transition ${
                          savedSubtab === tab.id ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        <Icon className="h-3 w-3" /> {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Content per subtab */}
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {savedSubtab === 'presentations' && (
                    <>
                      {savedRecLoading ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[#c9b07a]" /></div>
                      ) : savedRecordings.length === 0 ? (
                        <div className="px-2 py-4 text-center">
                          <Presentation className="mx-auto mb-1.5 h-5 w-5 text-white/15" />
                          <p className="text-[10px] text-white/30">No saved presentations yet</p>
                          <p className="mt-0.5 text-[9px] text-white/20">Record audio or video in Presentation Mode</p>
                        </div>
                      ) : (
                        savedRecordings.map((rec) => {
                          const Icon = rec.media_type === 'video' ? Video : Mic;
                          return (
                            <div key={rec.id} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/60 hover:bg-white/5">
                              <Icon className="h-3 w-3 shrink-0 text-[#c9b07a]/70" strokeWidth={1.5} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-white/70">{rec.title}</p>
                                <div className="flex gap-2 text-[8px] text-white/30">
                                  <span>{rec.media_type.toUpperCase()}</span>
                                  <span>{Math.floor(rec.duration_seconds / 60)}:{Math.floor(rec.duration_seconds % 60).toString().padStart(2, '0')}</span>
                                  {rec.presentation_id && <span className="font-mono text-[#c9b07a]/60">{rec.presentation_id}</span>}
                                </div>
                              </div>
                              {rec.presentation_id && (
                                <button
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(buildPresentationLink(rec.presentation_id!));
                                    setCopiedPresId(rec.presentation_id!);
                                    setTimeout(() => setCopiedPresId(null), 1500);
                                  }}
                                  className="shrink-0 rounded border border-white/10 p-1 text-white/30 hover:text-[#c9b07a]"
                                  title="Copy presentation link"
                                >
                                  {copiedPresId === rec.presentation_id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <LinkIcon className="h-2.5 w-2.5" />}
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                  {savedSubtab === 'individual' && (
                    <div className="px-2 py-4 text-center">
                      <Bookmark className="mx-auto mb-1.5 h-5 w-5 text-white/15" />
                      <p className="text-[10px] text-white/30">Saved hands appear in the</p>
                      <p className="text-[10px] text-white/30">hand rail&apos;s &quot;Saved&quot; tab</p>
                    </div>
                  )}
                  {savedSubtab === 'tournaments' && (
                    <>
                      {tournaments.length === 0 ? (
                        <div className="px-2 py-4 text-center">
                          <Trophy className="mx-auto mb-1.5 h-5 w-5 text-white/15" />
                          <p className="text-[10px] text-white/30">No saved tournaments yet</p>
                        </div>
                      ) : (
                        tournaments.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { handleSelectTournament(t); setOpenDropdown(null); }}
                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] transition ${
                              currentBatch?.id === t.id ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <Trophy className="h-3 w-3 shrink-0 text-[#d4a52c]/70" />
                            <span className="truncate flex-1">{t.title}</span>
                            <span className="shrink-0 text-white/30">{t.hand_count}</span>
                          </button>
                        ))
                      )}
                      <div className="border-t border-white/[0.06] p-1.5">
                        <button
                          onClick={() => { setOpenDropdown(null); setShowTournamentLibrary((v) => !v); }}
                          className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-semibold text-[#d4a52c] hover:bg-[#c0911e]/10"
                        >
                          <FolderOpen className="h-3 w-3" /> Open Library Sidebar
                        </button>
                      </div>
                    </>
                  )}
                  {savedSubtab === 'batches' && (
                    <>
                      {personalBatches.length === 0 ? (
                        <div className="px-2 py-4 text-center">
                          <Package className="mx-auto mb-1.5 h-5 w-5 text-white/15" />
                          <p className="text-[10px] text-white/30">No hand batches yet</p>
                        </div>
                      ) : (
                        personalBatches.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => { setCurrentBatch(b); setReloadKey((k) => k + 1); setOpenDropdown(null); }}
                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] transition ${
                              currentBatch?.id === b.id ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <Package className="h-3 w-3 shrink-0 text-[#d4a52c]/70" />
                            <span className="truncate flex-1">{b.title}</span>
                            <span className="shrink-0 text-white/30">{b.hand_count}</span>
                          </button>
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile-only: Presentation toggle inline */}
          {isMobile && (
            <button
              onClick={() => { setPresentationMode((v) => !v); setShowTournamentLibrary(false); }}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase transition ${
                presentationMode
                  ? 'border-[#d4a52c]/60 bg-[#c0911e]/25 text-[#f5e6b0] shadow-[0_0_8px_rgba(212,165,44,0.3)]'
                  : 'border-[#d4a52c]/30 bg-[#c0911e]/10 text-[#f5e6b0] hover:bg-[#c0911e]/20'
              }`}
            >
              <AudioLines className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Import error toast */}
        {importError && !isImporting && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/8 px-4 py-2">
            <span className="text-[10px] text-red-300">{importError}</span>
            <button onClick={() => setImportError(null)} className="ml-auto text-white/40 hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Import result toast */}
        {importResult && !isImporting && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/8 px-4 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="text-[10px] text-white/80">
              {importResult.isDuplicate
                ? `Added to existing "${importResult.duplicateName}" — `
                : `Tournament created — `}
              {importResult.added} hands added
              {importResult.duplicates > 0 && `, ${importResult.duplicates} duplicates skipped`}
              {importResult.errors > 0 && `, ${importResult.errors} errors`}
            </span>
            <button
              onClick={() => setImportResult(null)}
              className="ml-auto text-white/40 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex min-h-0 flex-1 gap-2">
            {/* Tournament Library sidebar */}
            {showTournamentLibrary && tournaments.length > 0 && (
              <div className="hidden md:flex w-64 shrink-0">
                <TournamentLibrary
                  tournaments={tournaments}
                  currentTournamentId={currentBatch?.id ?? null}
                  onSelectTournament={handleSelectTournament}
                  onRenameTournament={handleRenameTournament}
                  onDeleteTournament={handleDeleteTournament}
                  maxTournaments={tournamentLimit}
                />
              </div>
            )}

            {/* Main content area */}
            <div
              className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border bg-[#050607]/50 p-1.5 pb-0.5 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-3 sm:pb-1"
              style={{ borderColor: 'rgba(212,165,44,0.18)' }}
            >
              <HandReviewWorkspace
                  coachId={coachId}
                  coachName={coachName}
                  onMessageCoach={onMessageCoach}
                  onHandCountChange={setHandCount}
                  currentBatch={currentBatch}
                  batches={batches}
                  onSelectBatch={setCurrentBatch}
                  onBatchRenamed={() => void loadBatches()}
                  onReloadBatches={() => void loadBatches()}
                  onSaveLastViewedHand={(handId, index) => {
                    if (currentBatch) {
                      void saveLastViewedHand(currentBatch.id, handId, index);
                    }
                  }}
                  constructSignal={constructSignal}
                  presentationMode={presentationMode}
                  onTogglePresentationMode={() => setPresentationMode((v) => !v)}
                  initialHandId={initialHandId}
                  onHandConsumed={onHandConsumed}
                />
            </div>
        </div>

      </div>

      {/* Paste Hand History Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-white">Paste Hand History</h2>
              <button onClick={() => { setShowPasteModal(false); setPasteText(''); }} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste one or more hand histories here..."
                className="h-64 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setShowPasteModal(false); setPasteText(''); }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase text-white/50 hover:text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleTournamentPaste()}
                  disabled={!pasteText.trim() || isImporting}
                  className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-40"
                >
                  {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {isImporting ? 'Importing...' : 'Parse & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.hh,.history"
        className="hidden"
        onChange={(e) => { if (e.target.files && e.target.files.length > 0) void handleTournamentFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Mobile Add Hand bottom sheet */}
      {showAddHandSheet && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setShowAddHandSheet(false)}>
          <div className="w-full max-w-md rounded-t-xl border border-[#d4a52c]/25 bg-[#0d0f12] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Add a Hand</h2>
              <button onClick={() => setShowAddHandSheet(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1 p-3">
              <button
                onClick={() => { setShowAddHandSheet(false); fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(192,145,30,0.12)', border: '1px solid rgba(192,145,30,0.15)' }}>
                  <Upload className="h-4 w-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/80">Upload Hand History</div>
                  <div className="text-[10px] text-white/40">Import a .txt / .hh / .history file</div>
                </div>
              </button>
              <button
                onClick={() => { setShowAddHandSheet(false); setShowPasteModal(true); }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(192,145,30,0.12)', border: '1px solid rgba(192,145,30,0.15)' }}>
                  <FileText className="h-4 w-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/80">Paste Hand History</div>
                  <div className="text-[10px] text-white/40">Paste raw hand-history text</div>
                </div>
              </button>
              <button
                onClick={() => { setShowAddHandSheet(false); setConstructSignal((s) => s + 1); }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(192,145,30,0.12)', border: '1px solid rgba(192,145,30,0.15)' }}>
                  <Pencil className="h-4 w-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/80">Build a Hand</div>
                  <div className="text-[10px] text-white/40">Construct a custom hand</div>
                </div>
              </button>
              <button
                onClick={() => setShowAddHandSheet(false)}
                className="mt-1 w-full rounded-lg border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase text-white/40 hover:text-white/60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
