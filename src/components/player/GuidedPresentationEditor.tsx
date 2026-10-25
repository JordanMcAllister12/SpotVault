import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, Check, CircleStop, Clock3, ImagePlus, Mic, Pause, Play,
  Plus, RotateCcw, Save, Trash2, Upload, X,
} from 'lucide-react';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { buildReplayEvents, getPlaybackEvents, type ReplayEvent } from '@/features/hh-replayer/replayEngine';
import type { NormalizedHand } from '@/features/hh-replayer/types';
import {
  addPresentationComment, createGuidedPresentation, createPresentationCue, deletePresentationCue,
  deletePresentationMedia, fetchPresentationForHand, fetchPresentationComments, fetchPresentationCues,
  fetchPresentationMedia, isImageFileSupported, signedPresentationUrl,
  type GuidedPresentation, type PresentationComment, type PresentationCue, type PresentationCueType,
  type PresentationMedia, type PresentationStatus, updateGuidedPresentation, updatePresentationCue, uploadPresentationAudio,
  uploadPresentationImage,
} from '@/lib/guidedPresentationStore';

const GOLD = '#d4a52c';
const CUE_OPTIONS: { type: PresentationCueType; label: string }[] = [
  { type: 'action_reaches_hero', label: 'Action reaches hero' },
  { type: 'next_action', label: 'Next action' },
  { type: 'deal_flop', label: 'Deal flop' },
  { type: 'deal_turn', label: 'Deal turn' },
  { type: 'deal_river', label: 'Deal river' },
  { type: 'pause_hand', label: 'Pause hand' },
  { type: 'resume_hand', label: 'Resume hand' },
  { type: 'hand_event', label: 'Specific hand event' },
];

type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  hand: NormalizedHand;
  onClose: () => void;
}

function secondsLabel(value: number): string {
  const safe = Math.max(0, Math.round(value));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function cueTypeLabel(type: PresentationCueType): string {
  return CUE_OPTIONS.find((option) => option.type === type)?.label ?? (type === 'visual' ? 'Visual' : type);
}

function isStreetCue(type: PresentationCueType): boolean {
  return type === 'deal_flop' || type === 'deal_turn' || type === 'deal_river';
}

export function GuidedPresentationEditor({ hand, onClose }: Props) {
  const [presentation, setPresentation] = useState<GuidedPresentation | null>(null);
  const [cues, setCues] = useState<PresentationCue[]>([]);
  const [media, setMedia] = useState<PresentationMedia[]>([]);
  const [comments, setComments] = useState<PresentationComment[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('Guided Presentation');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [cueType, setCueType] = useState<PresentationCueType>('action_reaches_hero');
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(0);
  const events = useMemo(() => getPlaybackEvents(buildReplayEvents(hand)), [hand]);

  const loadPresentation = useCallback(async (currentHand: NormalizedHand) => {
    try {
      setError(null);
      let loaded = await fetchPresentationForHand(currentHand.handId);
      if (!loaded) loaded = await createGuidedPresentation(currentHand.handId);
      setPresentation(loaded);
      setTitle(loaded.title);
      const [loadedCues, loadedMedia, loadedComments] = await Promise.all([
        fetchPresentationCues(loaded.id), fetchPresentationMedia(loaded.id), fetchPresentationComments(loaded.id),
      ]);
      setCues(loadedCues);
      setMedia(loadedMedia);
      setComments(loadedComments);
      if (loaded.audio_storage_path) setAudioUrl(await signedPresentationUrl(loaded.audio_storage_path));
      if (loaded.audio_duration) setDuration(loaded.audio_duration);
      if (loaded.audio_storage_path) setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open Presentation Mode.');
    }
  }, []);

  useEffect(() => { void loadPresentation(hand); }, [hand, loadPresentation]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const refreshMedia = useCallback(async () => {
    if (!presentation) return;
    setMedia(await fetchPresentationMedia(presentation.id));
  }, [presentation]);

  const stopRecorder = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setRecordingPaused(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!presentation) return;
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event: BlobEvent) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stopRecorder();
        const recordingDuration = Math.max(1, (Date.now() - recordingStartedRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], `presentation-${Date.now()}.webm`, { type: blob.type });
        void (async () => {
          try {
            setUploading(true);
            const path = await uploadPresentationAudio(presentation.id, file, recordingDuration);
            setAudioUrl(await signedPresentationUrl(path));
            setDuration(recordingDuration);
            setCurrentTime(0);
            setStep(2);
            setNotice('Recording saved to this presentation.');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save the recording.');
          } finally {
            setUploading(false);
          }
        })();
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingStartedRef.current = Date.now();
      recorder.start(250);
      setRecording(true);
      setRecordingPaused(false);
    } catch {
      setError('Microphone access was not available. Check your browser permission and try again.');
    }
  }, [presentation, stopRecorder]);

  const pauseRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.pause();
    setRecordingPaused(true);
  };

  const resumeRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.resume();
    setRecordingPaused(false);
  };

  const stopRecording = () => recorderRef.current?.stop();

  const updateCueLocal = async (cue: PresentationCue, patch: Partial<Pick<PresentationCue, 'timestamp_seconds' | 'end_timestamp_seconds' | 'label' | 'hand_event_index'>>) => {
    const next = { ...cue, ...patch };
    if (next.timestamp_seconds < 0 || (next.end_timestamp_seconds != null && next.end_timestamp_seconds < next.timestamp_seconds)) return;
    setCues((items) => items.map((item) => item.id === cue.id ? next : item));
    try { await updatePresentationCue(cue.id, patch); } catch { setError('Could not save that timeline adjustment.'); }
  };

  const targetIndexForCue = useCallback((type: PresentationCueType, chosenIndex: number | null): number | null => {
    if (type === 'hand_event') return chosenIndex;
    if (type === 'next_action') return events.find((event) => event.index > (selectedEventIndex ?? -1))?.index ?? events[0]?.index ?? null;
    if (type === 'action_reaches_hero') {
      const hero = hand.players.find((player) => player.isHero)?.name;
      return events.find((event) => event.player === hero)?.index ?? events[0]?.index ?? null;
    }
    if (isStreetCue(type)) return events.find((event) => event.type === type)?.index ?? null;
    return null;
  }, [events, hand.players, selectedEventIndex]);

  const addCue = async () => {
    if (!presentation) return;
    const targetIndex = targetIndexForCue(cueType, selectedEventIndex);
    const label = cueType === 'hand_event' && targetIndex != null
      ? events.find((event) => event.index === targetIndex)?.label ?? cueTypeLabel(cueType)
      : cueTypeLabel(cueType);
    try {
      const cue = await createPresentationCue({
        presentation_id: presentation.id,
        timestamp_seconds: Math.min(currentTime, duration || currentTime),
        end_timestamp_seconds: null,
        cue_type: cueType,
        hand_event_index: targetIndex,
        media_id: null,
        label,
        metadata: {},
      });
      setCues((items) => [...items, cue].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNotice('Cue added to the presentation timeline.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add that cue.'); }
  };

  const addVisualCue = async (item: PresentationMedia) => {
    if (!presentation) return;
    try {
      const cue = await createPresentationCue({
        presentation_id: presentation.id,
        timestamp_seconds: currentTime,
        end_timestamp_seconds: Math.min(duration || currentTime + 5, currentTime + 5),
        cue_type: 'visual',
        hand_event_index: null,
        media_id: item.id,
        label: item.title,
        metadata: {},
      });
      setCues((items) => [...items, cue].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds));
      setNotice('Visual added to the timeline.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add that visual.'); }
  };

  const removeCue = async (cue: PresentationCue) => {
    try { await deletePresentationCue(cue.id); setCues((items) => items.filter((item) => item.id !== cue.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete that cue.'); }
  };

  const handleImageFiles = async (files: File[]) => {
    if (!presentation) return;
    const valid = files.filter(isImageFileSupported);
    if (valid.length !== files.length) { setError('Only supported image files under 10 MB can be added.'); }
    for (const file of valid) {
      try {
        setUploading(true);
        await uploadPresentationImage(presentation.id, file, mediaTitle || file.name);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload that image.'); }
      finally { setUploading(false); }
    }
    setMediaTitle('');
    await refreshMedia();
  };

  const save = async (status: PresentationStatus) => {
    if (!presentation) return;
    try {
      await updateGuidedPresentation(presentation.id, { title: title.trim() || 'Guided Presentation', status });
      setPresentation((current) => current ? { ...current, title: title.trim() || 'Guided Presentation', status } : current);
      setNotice(status === 'published' ? 'Presentation published.' : 'Draft saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the presentation.'); }
  };

  const handStepAtTime = useCallback((time: number): number => {
    const timedHandCues = cues
      .filter((cue) => cue.cue_type !== 'visual' && cue.cue_type !== 'pause_hand' && cue.cue_type !== 'resume_hand' && cue.hand_event_index != null)
      .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
    let previousTime = 0;
    let previousIndex = -1;
    for (const cue of timedHandCues) {
      if (time < cue.timestamp_seconds) {
        if (cue.timestamp_seconds === previousTime) return cue.hand_event_index ?? previousIndex;
        const progress = Math.max(0, Math.min(1, (time - previousTime) / (cue.timestamp_seconds - previousTime)));
        return Math.floor(previousIndex + ((cue.hand_event_index ?? previousIndex) - previousIndex) * progress);
      }
      previousTime = cue.timestamp_seconds;
      previousIndex = cue.hand_event_index ?? previousIndex;
    }
    return previousIndex;
  }, [cues]);

  const activeVisual = useMemo(() => cues
    .filter((cue) => cue.cue_type === 'visual' && cue.media_id && cue.timestamp_seconds <= currentTime && (cue.end_timestamp_seconds == null || cue.end_timestamp_seconds >= currentTime))
    .sort((a, b) => b.timestamp_seconds - a.timestamp_seconds)[0], [cues, currentTime]);
  const activeMedia = media.find((item) => item.id === activeVisual?.media_id);

  const syncTime = (value: number) => {
    setCurrentTime(value);
    if (audioRef.current) audioRef.current.currentTime = value;
  };

  const togglePreview = async () => {
    if (!audioRef.current || !audioUrl) return;
    if (audioRef.current.paused) await audioRef.current.play();
    else audioRef.current.pause();
  };

  const clearRecording = async () => {
    if (presentation) await updateGuidedPresentation(presentation.id, { audio_storage_path: null, audio_duration: null });
    setAudioUrl(null);
    setDuration(0);
    setCurrentTime(0);
    setPreviewPlaying(false);
  };

  const addComment = async () => {
    if (!presentation || !commentDraft.trim() || presentation.status !== 'published') return;
    try {
      const comment = await addPresentationComment(presentation.id, commentDraft);
      setComments((items) => [...items, comment]);
      setCommentDraft('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add your comment.'); }
  };

  return (
    <div className="rounded-xl border border-[#d4a52c]/20 bg-[#07090b] text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2"><AudioLines className="h-4 w-4 text-[#d4a52c]" /><div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5e6b0]">Create Guided Presentation</div><div className="text-[9px] text-white/40">Audio is the master timeline for this existing hand.</div></div></div>
        <button onClick={onClose} className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white" aria-label="Close Presentation Mode"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] px-4 py-2">
        {(['Record audio', 'Sync hand', 'Add visuals', 'Fine-tune', 'Preview'] as const).map((label, index) => {
          const value = (index + 1) as Step;
          return <button key={label} onClick={() => setStep(value)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition ${step === value ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/35 hover:text-white/65'}`}><span className="mr-1 text-[#d4a52c]/70">0{value}</span>{label}</button>;
        })}
      </div>
      <div className="space-y-4 p-4">
        {error && <div className="rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[10px] text-red-200">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[10px] text-emerald-200">{notice}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white outline-none focus:border-[#d4a52c]/50" aria-label="Presentation title" />
          <button onClick={() => void save('draft')} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase text-white/60 hover:text-white"><Save className="h-3.5 w-3.5" /> Save Draft</button>
          <button onClick={() => void save('published')} disabled={!audioUrl} className="flex items-center gap-1.5 rounded-lg bg-[#d4a52c] px-3 py-2 text-[9px] font-bold uppercase text-black disabled:opacity-30"><Check className="h-3.5 w-3.5" /> Save Presentation</button>
        </div>

        {step === 1 && <RecordStep recording={recording} recordingPaused={recordingPaused} uploading={uploading} audioUrl={audioUrl} onStart={startRecording} onPause={pauseRecording} onResume={resumeRecording} onStop={stopRecording} onReRecord={() => void clearRecording()} onDelete={() => void clearRecording()} />}
        {step > 1 && <AudioTimeline audioRef={audioRef} audioUrl={audioUrl} currentTime={currentTime} duration={duration} playing={previewPlaying} onTime={(value) => setCurrentTime(value)} onLoaded={(value) => setDuration((existing) => existing || value)} onPlaying={setPreviewPlaying} onToggle={togglePreview} onSeek={syncTime} />}

        {step === 2 && <SyncStep cues={cues} events={events} cueType={cueType} selectedEventIndex={selectedEventIndex} currentTime={currentTime} onCueType={setCueType} onEvent={setSelectedEventIndex} onAdd={addCue} onUpdate={updateCueLocal} onDelete={removeCue} />}
        {step === 3 && <VisualStep media={media} mediaTitle={mediaTitle} uploading={uploading} fileInputRef={fileInputRef} onTitle={setMediaTitle} onFiles={(files) => void handleImageFiles(files)} onAddCue={(item) => void addVisualCue(item)} onDelete={(item) => void deletePresentationMedia(item).then(refreshMedia)} />}
        {step === 4 && <FineTuneStep cues={cues} media={media} duration={duration} onSeek={syncTime} onUpdate={updateCueLocal} onDelete={removeCue} />}
        {step === 5 && <PreviewStep hand={hand} currentStep={handStepAtTime(currentTime)} activeMedia={activeMedia} presentation={presentation} comments={comments} commentDraft={commentDraft} onComment={setCommentDraft} onAddComment={() => void addComment()} onReplay={() => { syncTime(0); void audioRef.current?.play(); }} />}
      </div>
    </div>
  );
}

function RecordStep({ recording, recordingPaused, uploading, audioUrl, onStart, onPause, onResume, onStop, onReRecord, onDelete }: { recording: boolean; recordingPaused: boolean; uploading: boolean; audioUrl: string | null; onStart: () => void; onPause: () => void; onResume: () => void; onStop: () => void; onReRecord: () => void; onDelete: () => void }) {
  return <div className="rounded-xl border border-[#d4a52c]/15 bg-[#0c0e10] p-5 text-center"><Mic className="mx-auto h-8 w-8 text-[#d4a52c]" /><h2 className="mt-3 text-lg font-semibold text-white">Record your explanation first.</h2><p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-white/45">Speak naturally. You will synchronize the existing hand and supporting visuals afterward.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{!recording && !audioUrl && <button onClick={onStart} disabled={uploading} className="flex items-center gap-2 rounded-lg bg-[#d4a52c] px-4 py-2.5 text-[10px] font-bold uppercase text-black disabled:opacity-40"><Mic className="h-4 w-4" /> Record</button>}{recording && !recordingPaused && <button onClick={onPause} className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-[10px] font-bold uppercase text-white/70"><Pause className="h-4 w-4" /> Pause</button>}{recording && recordingPaused && <button onClick={onResume} className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/40 px-4 py-2.5 text-[10px] font-bold uppercase text-[#f5e6b0]"><Play className="h-4 w-4" /> Resume</button>}{recording && <button onClick={onStop} className="flex items-center gap-2 rounded-lg border border-red-300/30 px-4 py-2.5 text-[10px] font-bold uppercase text-red-200"><CircleStop className="h-4 w-4" /> Stop</button>}{audioUrl && !recording && <><button onClick={onReRecord} className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-[10px] font-bold uppercase text-white/70"><RotateCcw className="h-4 w-4" /> Re-record</button><button onClick={onDelete} className="flex items-center gap-2 rounded-lg border border-red-300/20 px-4 py-2.5 text-[10px] font-bold uppercase text-red-200"><Trash2 className="h-4 w-4" /> Delete recording</button></>}</div>{uploading && <div className="mt-4 text-[10px] text-white/40">Saving recording…</div>}{audioUrl && !recording && <div className="mt-4 text-[10px] text-emerald-200">Recording saved. Continue to Sync hand.</div>}</div>;
}

function AudioTimeline({ audioRef, audioUrl, currentTime, duration, playing, onTime, onLoaded, onPlaying, onToggle, onSeek }: { audioRef: React.RefObject<HTMLAudioElement>; audioUrl: string | null; currentTime: number; duration: number; playing: boolean; onTime: (value: number) => void; onLoaded: (value: number) => void; onPlaying: (value: boolean) => void; onToggle: () => void; onSeek: (value: number) => void }) {
  return <div className="rounded-xl border border-white/10 bg-[#0c0e10] p-3"><div className="flex items-center gap-2"><button onClick={onToggle} disabled={!audioUrl} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a52c] text-black disabled:opacity-30" aria-label={playing ? 'Pause presentation audio' : 'Play presentation audio'}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}</button><div className="flex-1"><div className="flex justify-between text-[9px] font-mono text-white/45"><span>{secondsLabel(currentTime)}</span><span>{secondsLabel(duration)}</span></div><input type="range" min="0" max={Math.max(duration, 0.1)} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={(event) => onSeek(Number(event.target.value))} className="w-full accent-[#d4a52c]" /></div></div>{audioUrl ? <audio ref={audioRef} src={audioUrl} onLoadedMetadata={(event) => onLoaded(event.currentTarget.duration)} onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)} onPlay={() => onPlaying(true)} onPause={() => onPlaying(false)} onEnded={() => onPlaying(false)} controls={false} /> : <div className="mt-2 text-[10px] text-white/30">Record audio to create the master timeline.</div>}</div>;
}

function SyncStep({ cues, events, cueType, selectedEventIndex, currentTime, onCueType, onEvent, onAdd, onUpdate, onDelete }: { cues: PresentationCue[]; events: ReplayEvent[]; cueType: PresentationCueType; selectedEventIndex: number | null; currentTime: number; onCueType: (type: PresentationCueType) => void; onEvent: (index: number | null) => void; onAdd: () => void; onUpdate: (cue: PresentationCue, patch: Partial<Pick<PresentationCue, 'timestamp_seconds' | 'end_timestamp_seconds' | 'label' | 'hand_event_index'>>) => void; onDelete: (cue: PresentationCue) => void }) {
  return <div className="space-y-3"><div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-[#0c0e10] p-3"><label className="flex min-w-[190px] flex-1 flex-col gap-1 text-[9px] font-bold uppercase tracking-wider text-white/45">Cue type<select value={cueType} onChange={(event) => onCueType(event.target.value as PresentationCueType)} className="rounded-md border border-white/10 bg-[#080a0c] px-2 py-2 text-[10px] normal-case tracking-normal text-white outline-none">{CUE_OPTIONS.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}</select></label>{cueType === 'hand_event' && <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[9px] font-bold uppercase tracking-wider text-white/45">Existing event<select value={selectedEventIndex ?? ''} onChange={(event) => onEvent(event.target.value ? Number(event.target.value) : null)} className="rounded-md border border-white/10 bg-[#080a0c] px-2 py-2 text-[10px] normal-case tracking-normal text-white outline-none"><option value="">Choose an event</option>{events.map((event) => <option key={event.index} value={event.index}>{event.label}</option>)}</select></label>}<button onClick={onAdd} className="flex items-center gap-1.5 rounded-md bg-[#d4a52c] px-3 py-2 text-[10px] font-bold uppercase text-black"><Plus className="h-3.5 w-3.5" /> Add Cue at {secondsLabel(currentTime)}</button></div><CueList cues={cues.filter((cue) => cue.cue_type !== 'visual')} events={events} onUpdate={onUpdate} onDelete={onDelete} /></div>;
}

function CueList({ cues, events, onUpdate, onDelete }: { cues: PresentationCue[]; events: ReplayEvent[]; onUpdate: (cue: PresentationCue, patch: Partial<Pick<PresentationCue, 'timestamp_seconds' | 'end_timestamp_seconds' | 'label' | 'hand_event_index'>>) => void; onDelete: (cue: PresentationCue) => void }) {
  return <div className="space-y-1.5">{cues.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[10px] text-white/30">No hand cues yet. Move the audio playhead and add the moments you want the table to reach.</div> : cues.map((cue) => <div key={cue.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0c0e10] px-3 py-2"><span className="min-w-[125px] flex-1 text-[10px] font-semibold text-[#f5e6b0]">{cue.label}</span><input aria-label="Cue timestamp" type="number" min="0" step="0.1" value={cue.timestamp_seconds} onChange={(event) => onUpdate(cue, { timestamp_seconds: Number(event.target.value) })} className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-mono text-white/70" /><span className="text-[9px] text-white/30">sec</span>{cue.cue_type === 'hand_event' && <select value={cue.hand_event_index ?? ''} onChange={(event) => onUpdate(cue, { hand_event_index: event.target.value ? Number(event.target.value) : null })} className="max-w-[210px] rounded border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60"><option value="">Choose event</option>{events.map((event) => <option key={event.index} value={event.index}>{event.label}</option>)}</select>}<button onClick={() => onDelete(cue)} className="rounded p-1 text-white/30 hover:text-red-300" aria-label="Delete cue"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>;
}

function VisualStep({ media, mediaTitle, uploading, fileInputRef, onTitle, onFiles, onAddCue, onDelete }: { media: PresentationMedia[]; mediaTitle: string; uploading: boolean; fileInputRef: React.RefObject<HTMLInputElement>; onTitle: (value: string) => void; onFiles: (files: File[]) => void; onAddCue: (item: PresentationMedia) => void; onDelete: (item: PresentationMedia) => void }) {
  return <div className="space-y-3"><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFiles(Array.from(event.dataTransfer.files)); }} className="rounded-xl border border-dashed border-[#d4a52c]/30 bg-[#0c0e10] p-6 text-center"><ImagePlus className="mx-auto h-7 w-7 text-[#d4a52c]/70" /><div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-white/70">Presentation Media</div><div className="mt-1 text-[10px] text-white/35">Drag and drop screenshots here, or upload them for timed placement.</div><div className="mt-3 flex flex-wrap justify-center gap-2"><input value={mediaTitle} onChange={(event) => onTitle(event.target.value)} placeholder="Optional image title" className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none" /><button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/65 disabled:opacity-40"><Upload className="h-3 w-3" /> Upload</button><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></div></div><div className="grid gap-3 sm:grid-cols-2">{media.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0e10]"><div className="aspect-video bg-black/30">{item.signed_url && <img src={item.signed_url} alt={item.title} className="h-full w-full object-contain" />}</div><div className="flex items-center justify-between gap-2 p-2"><span className="truncate text-[10px] font-semibold text-white/70">{item.title}</span><div className="flex gap-1"><button onClick={() => onAddCue(item)} className="rounded border border-[#d4a52c]/30 px-2 py-1 text-[8px] font-bold uppercase text-[#f5e6b0]">Add to timeline</button><button onClick={() => onDelete(item)} className="rounded p-1 text-white/30 hover:text-red-300" aria-label="Remove image"><Trash2 className="h-3 w-3" /></button></div></div></div>)}</div></div>;
}

function FineTuneStep({ cues, media, duration, onSeek, onUpdate, onDelete }: { cues: PresentationCue[]; media: PresentationMedia[]; duration: number; onSeek: (value: number) => void; onUpdate: (cue: PresentationCue, patch: Partial<Pick<PresentationCue, 'timestamp_seconds' | 'end_timestamp_seconds' | 'label' | 'hand_event_index'>>) => void; onDelete: (cue: PresentationCue) => void }) {
  const scale = Math.max(duration, 1);
  return <div className="rounded-xl border border-white/10 bg-[#0c0e10] p-3"><div className="mb-3 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0]">Presentation Timeline</div><div className="text-[9px] text-white/35">Drag the playhead or adjust cue times precisely.</div></div><Clock3 className="h-4 w-4 text-[#d4a52c]" /></div><div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-black/30 p-3"><div className="mb-3 flex justify-between text-[9px] font-mono text-white/30"><span>0:00</span><span>{secondsLabel(duration)}</span></div>{(['AUDIO', 'HAND', 'VISUALS'] as const).map((track) => <div key={track} className="mb-3 flex items-center gap-2"><span className="w-14 text-[8px] font-bold tracking-wider text-white/35">{track}</span><div className="relative h-8 flex-1 rounded bg-white/[0.03]">{track === 'AUDIO' && <div className="absolute inset-y-2 left-0 right-0 bg-[#d4a52c]/25" />}{track !== 'AUDIO' && cues.filter((cue) => track === 'VISUALS' ? cue.cue_type === 'visual' : cue.cue_type !== 'visual').map((cue) => <button key={cue.id} onClick={() => onSeek(cue.timestamp_seconds)} className="absolute top-1 h-6 rounded border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-1.5 text-left text-[8px] text-[#f5e6b0]" style={{ left: `${(cue.timestamp_seconds / scale) * 100}%`, width: `${Math.max(4, (((cue.end_timestamp_seconds ?? cue.timestamp_seconds + 1) - cue.timestamp_seconds) / scale) * 100)}%` }}>{cue.label}</button>)}</div></div>)}</div><div className="mt-3 space-y-1.5"><CueList cues={cues} events={[]} onUpdate={onUpdate} onDelete={onDelete} /></div><div className="mt-3 text-[9px] text-white/30">{media.length} supporting image{media.length === 1 ? '' : 's'} · {cues.length} timeline cue{cues.length === 1 ? '' : 's'}</div></div>;
}

function PreviewStep({ hand, currentStep, activeMedia, presentation, comments, commentDraft, onComment, onAddComment, onReplay }: { hand: NormalizedHand; currentStep: number; activeMedia?: PresentationMedia; presentation: GuidedPresentation | null; comments: PresentationComment[]; commentDraft: string; onComment: (value: string) => void; onAddComment: () => void; onReplay: () => void }) {
  return <div className="space-y-3"><div className="flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0]">Preview Presentation</div><div className="text-[9px] text-white/35">Audio, hand state, street reveals, and visuals follow the saved timeline.</div></div><button onClick={onReplay} className="flex items-center gap-1.5 rounded-lg bg-[#d4a52c] px-3 py-2 text-[9px] font-bold uppercase text-black"><Play className="h-3.5 w-3.5" /> Play Presentation</button></div><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]"><div className="min-w-0 rounded-xl border border-white/10 bg-black/25 p-1"><HHReplayer hand={hand} variant="embedded" visualSize="main" controlledStep={currentStep} hidePlaybackControls /></div>{activeMedia ? <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[#d4a52c]/20 bg-[#0c0e10] p-3"><img src={activeMedia.signed_url} alt={activeMedia.title} className="max-h-[420px] max-w-full object-contain" /></div> : <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-[10px] text-white/25">Supporting visuals appear here when their cue is active.</div>}</div>{presentation?.status === 'published' && <div className="rounded-xl border border-white/10 bg-[#0c0e10] p-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/55">Comments</div><div className="space-y-2">{comments.map((comment) => <div key={comment.id} className="rounded-lg bg-black/25 px-3 py-2 text-[10px] text-white/60">{comment.body}</div>)}</div><div className="mt-3 flex gap-2"><input value={commentDraft} onChange={(event) => onComment(event.target.value)} placeholder="Add a comment" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-[10px] text-white outline-none" /><button onClick={onAddComment} className="rounded-md border border-[#d4a52c]/30 px-3 py-2 text-[9px] font-bold uppercase text-[#f5e6b0]">Comment</button></div></div>}</div>;
}
