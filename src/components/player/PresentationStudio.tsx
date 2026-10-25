import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Video, Pause, Play, Square, Save, Trash2, Download,
  ChevronDown, ChevronUp, Plus, X, Clock, Scissors, Film, Volume2,
  Copy, Link as LinkIcon, Check,
} from 'lucide-react';
import {
  type PresentationRecording, type SyncMarker,
  fetchRecordings, createRecording, renameRecording, deleteRecording,
  updateSyncData, getRecordingUrlAsync,
  buildPresentationLink,
} from '@/lib/presentationRecordingStore';

interface Props {
  handId: string | null;
  userId: string;
  onClose: () => void;
}

type RecordingMode = 'voice' | 'video' | 'sync';
type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

const BORDER = 'rgba(255,255,255,0.08)';
const SECTION_BG = 'rgba(8,10,12,0.55)';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DEFAULT_MARKERS: { label: string }[] = [
  { label: 'Start Hand' },
  { label: 'Hero Decision' },
  { label: 'Next Action' },
  { label: 'Reveal Flop' },
  { label: 'Reveal Turn' },
  { label: 'Reveal River' },
  { label: 'End Hand' },
];

export function PresentationStudio({ handId, userId, onClose }: Props) {
  const [mode, setMode] = useState<RecordingMode>('voice');
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<PresentationRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasUnsavedRecording, setHasUnsavedRecording] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [syncMarkers, setSyncMarkers] = useState<SyncMarker[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [editingRecordingId, setEditingRecordingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  const loadRecordings = useCallback(async () => {
    setLoadingRecordings(true);
    const data = await fetchRecordings();
    setRecordings(data);
    setLoadingRecordings(false);
  }, []);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        animationFrameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch { /* non-critical */ }
  };

  const stopAnalyser = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const handleStartRecording = async () => {
    setError(null);
    try {
      const constraints: MediaStreamConstraints = mode === 'video'
        ? { audio: true, video: { width: 1280, height: 720 } }
        : { audio: true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (mode === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }

      setupAudioAnalyser(stream);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mode === 'video' ? 'video/webm' : 'audio/webm' });
        previewBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        if (mode === 'video') setVideoPreviewUrl(url);
        else setAudioPreviewUrl(url);
        setHasUnsavedRecording(true);
        setRecorderState('stopped');
      };

      recorder.start();
      setRecorderState('recording');
      startTimer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone/camera';
      setError(msg.includes('Permission') || msg.includes('denied')
        ? 'Microphone/camera access denied. Please grant permission in your browser settings.'
        : `Recording error: ${msg}`);
    }
  };

  const handlePause = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'recording') {
      r.pause();
      setRecorderState('paused');
      stopTimer();
    }
  };

  const handleResume = () => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'paused') {
      r.resume();
      setRecorderState('recording');
      startTimer();
    }
  };

  const handleStop = () => {
    const r = mediaRecorderRef.current;
    if (r && (r.state === 'recording' || r.state === 'paused')) {
      r.stop();
    }
    stopTimer();
    stopAnalyser();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const handleDiscard = () => {
    if (videoPreviewUrl) { URL.revokeObjectURL(videoPreviewUrl); setVideoPreviewUrl(null); }
    if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); setAudioPreviewUrl(null); }
    previewBlobRef.current = null;
    setHasUnsavedRecording(false);
    setRecorderState('idle');
    setElapsed(0);
    setError(null);
  };

  const handleSave = async () => {
    if (!previewBlobRef.current || !saveTitle.trim()) return;
    setSaving(true);
    const recording = await createRecording(
      userId,
      saveTitle.trim(),
      mode === 'video' ? 'video' : 'audio',
      previewBlobRef.current,
      elapsed,
      handId,
      mode === 'sync' && syncMarkers.length > 0 ? syncMarkers : null,
    );
    setSaving(false);
    if (recording) {
      handleDiscard();
      setSaveTitle('');
      setShowSaveDialog(false);
      void loadRecordings();
    } else {
      setError('Failed to save recording. Please try again.');
    }
  };

  const handleDeleteRecording = async (rec: PresentationRecording) => {
    if (!confirm(`Delete "${rec.title}"? This cannot be undone.`)) return;
    const ok = await deleteRecording(rec.id, rec.storage_path);
    if (ok) void loadRecordings();
  };

  const handleRenameRecording = async (rec: PresentationRecording) => {
    const newTitle = prompt('Rename recording:', rec.title);
    if (newTitle && newTitle.trim()) {
      const ok = await renameRecording(rec.id, newTitle.trim());
      if (ok) void loadRecordings();
    }
  };

  const addSyncMarker = (label: string) => {
    setSyncMarkers((prev) => [...prev, { label, timestamp: elapsed }]);
  };

  const updateMarkerTimestamp = (index: number, timestamp: number) => {
    setSyncMarkers((prev) => prev.map((m, i) => i === index ? { ...m, timestamp } : m));
  };

  const removeSyncMarker = (index: number) => {
    setSyncMarkers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSync = (rec: PresentationRecording) => {
    setEditingRecordingId(rec.id);
    setSyncMarkers(rec.sync_data ?? []);
    setMode('sync');
  };

  const handleSaveSync = async () => {
    if (!editingRecordingId) return;
    const ok = await updateSyncData(editingRecordingId, syncMarkers);
    if (ok) {
      setEditingRecordingId(null);
      setSyncMarkers([]);
      void loadRecordings();
    }
  };

  const modeButtons: { key: RecordingMode; label: string; icon: typeof Mic }[] = [
    { key: 'voice', label: 'Voice Note', icon: Mic },
    { key: 'video', label: 'Video + Audio', icon: Video },
    { key: 'sync', label: 'Replay Sync', icon: Film },
  ];

  return (
    <div className="shrink-0 rounded-xl border" style={{ borderColor: 'rgba(192,145,30,0.25)', background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-[#c9b07a]" /> : <ChevronUp className="h-3.5 w-3.5 text-[#c9b07a]" />}
          <span className="text-[10px] font-bold tracking-widest text-[#c9b07a] uppercase">Presentation Studio</span>
          {recordings.length > 0 && <span className="rounded-full bg-[#c0911e]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#c9b07a]/80">{recordings.length}</span>}
        </button>
        <button onClick={onClose} className="text-white/30 hover:text-[#c9b07a]"><X className="h-3.5 w-3.5" /></button>
      </div>

      {!collapsed && (
        <div className="border-t px-3 pb-3 pt-2.5" style={{ borderColor: BORDER }}>
          {/* Mode tabs */}
          <div className="mb-3 flex gap-1.5">
            {modeButtons.map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.key}
                  onClick={() => { setMode(btn.key); handleDiscard(); }}
                  className={`hdr-gold-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold tracking-wider uppercase transition ${
                    mode === btn.key ? 'ring-1 ring-[#c9b07a]/30' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Icon className="hdr-gold-icon h-3 w-3" /> {btn.label}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-2.5 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[10px] text-red-300">
              {error}
            </div>
          )}

          {/* Video preview (video mode only) */}
          {mode === 'video' && (
            <div className="mb-3 overflow-hidden rounded-lg border border-white/10 bg-black/60" style={{ maxHeight: 240 }}>
              {videoPreviewUrl ? (
                <video src={videoPreviewUrl} controls className="w-full" style={{ maxHeight: 240 }} />
              ) : (
                <video ref={videoRef} muted playsInline className="w-full" style={{ maxHeight: 240 }} />
              )}
            </div>
          )}

          {/* Audio preview (voice mode only) */}
          {mode === 'voice' && audioPreviewUrl && (
            <div className="mb-3 rounded-lg border border-white/10 bg-black/40 p-2.5">
              <audio src={audioPreviewUrl} controls className="w-full" />
            </div>
          )}

          {/* Recording controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Timer */}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5">
              {recorderState === 'recording' && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
              <Clock className="h-3 w-3 text-white/40" />
              <span className="font-mono text-[11px] font-bold text-white/80">{formatTime(elapsed)}</span>
            </div>

            {/* Audio level bar */}
            {recorderState === 'recording' && (
              <div className="flex items-center gap-1">
                <Volume2 className="h-3 w-3 text-[#d4a52c]/60" />
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#d4a52c] transition-all"
                    style={{ width: `${Math.round(audioLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            {(recorderState === 'idle' || recorderState === 'stopped') && !hasUnsavedRecording && (
              <button
                onClick={handleStartRecording}
                disabled={!!editingRecordingId}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-1.5 text-[9px] font-bold uppercase text-red-300 transition hover:bg-red-500/25 disabled:opacity-30"
              >
                <Mic className="h-3 w-3" /> Start Recording
              </button>
            )}

            {recorderState === 'recording' && (
              <>
                <button onClick={handlePause} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase text-white/70 hover:bg-white/10">
                  <Pause className="h-3 w-3" /> Pause
                </button>
                <button onClick={handleStop} className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-1.5 text-[9px] font-bold uppercase text-red-300 hover:bg-red-500/25">
                  <Square className="h-3 w-3" /> Stop
                </button>
              </>
            )}

            {recorderState === 'paused' && (
              <>
                <button onClick={handleResume} className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[9px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/25">
                  <Play className="h-3 w-3" /> Resume
                </button>
                <button onClick={handleStop} className="flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-1.5 text-[9px] font-bold uppercase text-red-300 hover:bg-red-500/25">
                  <Square className="h-3 w-3" /> Stop
                </button>
              </>
            )}

            {hasUnsavedRecording && (
              <>
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/25"
                >
                  <Save className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={handleDiscard}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase text-white/50 hover:bg-white/10"
                >
                  <Trash2 className="h-3 w-3" /> Discard
                </button>
              </>
            )}
          </div>

          {/* Save dialog */}
          {showSaveDialog && (
            <div className="mt-3 rounded-lg border border-[#d4a52c]/20 bg-[#c0911e]/5 p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">Save Recording</div>
              <input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Recording title…"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setShowSaveDialog(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-[9px] font-bold uppercase text-white/50 hover:text-white/70">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={!saveTitle.trim() || saving}
                  className="rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40 hover:bg-[#c0911e]/25"
                >
                  {saving ? 'Saving…' : 'Confirm Save'}
                </button>
              </div>
            </div>
          )}

          {/* Replay Sync markers */}
          {mode === 'sync' && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Scissors className="h-3 w-3 text-[#d4a52c]/60" />
                <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">
                  {editingRecordingId ? 'Edit Sync Markers' : 'Live Sync Markers'}
                </span>
              </div>

              {/* Add marker buttons */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {DEFAULT_MARKERS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => addSyncMarker(m.label)}
                    disabled={recorderState !== 'recording' && !editingRecordingId}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-bold uppercase text-white/40 transition hover:border-white/25 hover:text-white/70 disabled:opacity-25"
                  >
                    <Plus className="h-2.5 w-2.5" /> {m.label}
                  </button>
                ))}
              </div>

              {/* Marker list */}
              {syncMarkers.length > 0 ? (
                <div className="space-y-1.5">
                  {syncMarkers.map((marker, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                      <span className="text-[10px] font-semibold text-white/70">{marker.label}</span>
                      <input
                        type="number"
                        value={marker.timestamp}
                        onChange={(e) => updateMarkerTimestamp(i, Number(e.target.value))}
                        className="ml-auto w-20 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-right text-[10px] font-mono text-white/80 focus:border-[#d4a52c]/40 focus:outline-none"
                        step="1"
                        min="0"
                      />
                      <span className="text-[9px] text-white/30">sec</span>
                      <button onClick={() => removeSyncMarker(i)} className="text-white/30 hover:text-red-300">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {editingRecordingId && (
                    <button
                      onClick={handleSaveSync}
                      className="mt-2 w-full rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-3 py-2 text-[9px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/25"
                    >
                      Save Sync Data
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-white/30">
                  {editingRecordingId
                    ? 'No sync markers yet. Add markers to synchronize replay actions with your recording.'
                    : 'Start recording, then click marker buttons to tag replay actions at specific timestamps.'}
                </p>
              )}
            </div>
          )}

          {/* My Recordings */}
          <div className="mt-4 border-t pt-3" style={{ borderColor: 'rgba(192,145,30,0.15)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-widest text-[#c9b07a] uppercase">My Recordings</span>
              {recordings.length > 0 && <span className="text-[8px] text-white/30">({recordings.length})</span>}
            </div>
            {loadingRecordings ? (
              <p className="text-[10px] text-white/30">Loading…</p>
            ) : recordings.length === 0 ? (
              <p className="text-[10px] text-white/30">No recordings yet. Record voice commentary or webcam video to get started.</p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {recordings.map((rec) => (
                  <RecordingRow
                    key={rec.id}
                    rec={rec}
                    onRename={() => handleRenameRecording(rec)}
                    onDelete={() => handleDeleteRecording(rec)}
                    onEditSync={() => handleEditSync(rec)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Unsaved warning */}
          {hasUnsavedRecording && (
            <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[9px] leading-relaxed text-amber-200/70">
              You have an unsaved recording. Save or discard it before navigating away.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecordingRow({
  rec,
  onRename,
  onDelete,
  onEditSync,
}: {
  rec: PresentationRecording;
  onRename: () => void;
  onDelete: () => void;
  onEditSync: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadUrl = async () => {
    if (url || !rec.storage_path) return;
    setLoadingUrl(true);
    const signed = await getRecordingUrlAsync(rec.storage_path);
    setUrl(signed);
    setLoadingUrl(false);
  };

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {rec.media_type === 'video' ? <Video className="h-3 w-3 text-[#d4a52c]/60" /> : <Mic className="h-3 w-3 text-[#d4a52c]/60" />}
            <span className="truncate text-[11px] font-semibold text-white/80">{rec.title}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-[8px] text-white/35">
            <span>{rec.media_type.toUpperCase()}</span>
            <span>{formatTime(rec.duration_seconds)}</span>
            <span>{new Date(rec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {rec.presentation_id && <span className="font-mono text-[#c9b07a]/70">{rec.presentation_id}</span>}
            {rec.sync_data && rec.sync_data.length > 0 && <span className="text-[#d4a52c]/60">SYNC</span>}
            {rec.hand_id && <span>Hand: {rec.hand_id.slice(-6)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {rec.presentation_id && (
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(rec.presentation_id!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded border border-white/10 p-1 text-white/40 hover:text-[#c9b07a] disabled:opacity-30"
              title={`Presentation ID: ${rec.presentation_id}`}
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
          {rec.presentation_id && (
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(buildPresentationLink(rec.presentation_id!));
              }}
              className="rounded border border-white/10 p-1 text-white/40 hover:text-[#c9b07a]"
              title="Copy presentation link"
            >
              <LinkIcon className="h-3 w-3" />
            </button>
          )}
          <button onClick={loadUrl} disabled={loadingUrl || !rec.storage_path} className="rounded border border-white/10 p-1 text-white/40 hover:text-white/70 disabled:opacity-30" title="Play">
            <Play className="h-3 w-3" />
          </button>
          <button onClick={onRename} className="rounded border border-white/10 p-1 text-white/40 hover:text-white/70" title="Rename">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={onEditSync} className="rounded border border-white/10 p-1 text-white/40 hover:text-white/70" title="Edit Sync">
            <Scissors className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="rounded border border-red-300/15 p-1 text-red-300/50 hover:text-red-300" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {url && (
        <div className="mt-2">
          {rec.media_type === 'video' ? (
            <video src={url} controls className="w-full rounded-lg" style={{ maxHeight: 200 }} />
          ) : (
            <audio src={url} controls className="w-full" />
          )}
        </div>
      )}
    </div>
  );
}
