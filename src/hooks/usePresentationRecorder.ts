import { useState, useRef, useCallback, useEffect } from 'react';
import {
  type PresentationRecording, type SyncMarker,
  fetchRecordings, createRecording, renameRecording, deleteRecording,
  updateSyncData, getRecordingUrlAsync,
} from '@/lib/presentationRecordingStore';

export type RecordingMode = 'voice' | 'video' | 'sync';
export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface PresentationRecorderState {
  mode: RecordingMode;
  recorderState: RecorderState;
  elapsed: number;
  error: string | null;
  hasUnsavedRecording: boolean;
  videoPreviewUrl: string | null;
  audioPreviewUrl: string | null;
  audioLevel: number;
  syncMarkers: SyncMarker[];
  recordings: PresentationRecording[];
  loadingRecordings: boolean;
  saving: boolean;
  showSaveDialog: boolean;
  saveTitle: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export interface PresentationRecorderActions {
  setMode: (mode: RecordingMode) => void;
  setSaveTitle: (title: string) => void;
  setShowSaveDialog: (show: boolean) => void;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  discardRecording: () => void;
  saveRecording: () => Promise<void>;
  addSyncMarker: (label: string) => void;
  reloadRecordings: () => Promise<void>;
  deleteRecordingRow: (rec: PresentationRecording) => Promise<void>;
  renameRecordingRow: (rec: PresentationRecording) => Promise<void>;
}

export type PresentationRecorder = PresentationRecorderState & PresentationRecorderActions;

export function usePresentationRecorder(handId: string | null, userId: string | null): PresentationRecorder {
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  const reloadRecordings = useCallback(async () => {
    setLoadingRecordings(true);
    const data = await fetchRecordings();
    setRecordings(data);
    setLoadingRecordings(false);
  }, []);

  useEffect(() => { void reloadRecordings(); }, [reloadRecordings]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') void audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
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
  }, []);

  const startRecording = useCallback(async () => {
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
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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
  }, [mode, setupAudioAnalyser, startTimer]);

  const pauseRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'recording') { r.pause(); setRecorderState('paused'); stopTimer(); }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state === 'paused') { r.resume(); setRecorderState('recording'); startTimer(); }
  }, [startTimer]);

  const stopRecording = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && (r.state === 'recording' || r.state === 'paused')) r.stop();
    stopTimer();
    stopAnalyser();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopTimer, stopAnalyser]);

  const discardRecording = useCallback(() => {
    if (videoPreviewUrl) { URL.revokeObjectURL(videoPreviewUrl); setVideoPreviewUrl(null); }
    if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); setAudioPreviewUrl(null); }
    previewBlobRef.current = null;
    setHasUnsavedRecording(false);
    setRecorderState('idle');
    setElapsed(0);
    setError(null);
  }, [videoPreviewUrl, audioPreviewUrl]);

  const saveRecording = useCallback(async () => {
    if (!previewBlobRef.current || !saveTitle.trim() || !userId) return;
    setSaving(true);
    const recording = await createRecording(
      userId, saveTitle.trim(), mode === 'video' ? 'video' : 'audio',
      previewBlobRef.current, elapsed, handId,
      mode === 'sync' && syncMarkers.length > 0 ? syncMarkers : null,
    );
    setSaving(false);
    if (recording) {
      discardRecording();
      setSaveTitle('');
      setShowSaveDialog(false);
      void reloadRecordings();
    } else {
      setError('Failed to save recording. Please try again.');
    }
  }, [saveTitle, userId, mode, elapsed, handId, syncMarkers, discardRecording, reloadRecordings]);

  const addSyncMarker = useCallback((label: string) => {
    setSyncMarkers((prev) => [...prev, { label, timestamp: elapsed }]);
  }, [elapsed]);

  const deleteRecordingRow = useCallback(async (rec: PresentationRecording) => {
    if (!confirm(`Delete "${rec.title}"? This cannot be undone.`)) return;
    const ok = await deleteRecording(rec.id, rec.storage_path);
    if (ok) void reloadRecordings();
  }, [reloadRecordings]);

  const renameRecordingRow = useCallback(async (rec: PresentationRecording) => {
    const newTitle = prompt('Rename recording:', rec.title);
    if (newTitle && newTitle.trim()) {
      const ok = await renameRecording(rec.id, newTitle.trim());
      if (ok) void reloadRecordings();
    }
  }, [reloadRecordings]);

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

  return {
    mode, recorderState, elapsed, error, hasUnsavedRecording,
    videoPreviewUrl, audioPreviewUrl, audioLevel, syncMarkers,
    recordings, loadingRecordings, saving, showSaveDialog, saveTitle, videoRef,
    setMode, setSaveTitle, setShowSaveDialog,
    startRecording, pauseRecording, resumeRecording, stopRecording,
    discardRecording, saveRecording, addSyncMarker, reloadRecordings,
    deleteRecordingRow, renameRecordingRow,
  };
}
