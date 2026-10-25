import { useState, useEffect, useCallback } from 'react';
import { Mic, Video, X, Plus, Loader2, Link2, Check, Trash2, Film } from 'lucide-react';
import {
  fetchRecordings,
  attachRecordingToSpot,
  removeAttachment,
  fetchRecordingsBySpotId,
  buildPresentationLink,
  type PresentationRecording,
} from '@/lib/presentationRecordingStore';

interface AttachedRecording extends PresentationRecording {
  attachment_id: string;
  is_intro: boolean;
}

interface Props {
  spotId: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingAttachments({ spotId }: Props) {
  const [attached, setAttached] = useState<AttachedRecording[]>([]);
  const [available, setAvailable] = useState<PresentationRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadAttached = useCallback(async () => {
    const items = await fetchRecordingsBySpotId(spotId);
    setAttached(items);
  }, [spotId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([loadAttached(), fetchRecordings()]).then(([_, all]) => {
      if (mounted) {
        setAvailable(all);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [loadAttached]);

  const refreshAvailable = useCallback(async () => {
    setPickerLoading(true);
    const all = await fetchRecordings();
    setAvailable(all);
    setPickerLoading(false);
  }, []);

  const handleAttach = async (recordingId: string) => {
    setAttachingId(recordingId);
    const ok = await attachRecordingToSpot(recordingId, spotId);
    if (ok) {
      await loadAttached();
    }
    setAttachingId(null);
  };

  const handleRemove = async (attachmentId: string) => {
    const ok = await removeAttachment(attachmentId);
    if (ok) {
      setAttached((prev) => prev.filter((r) => r.attachment_id !== attachmentId));
    }
  };

  const handleCopyLink = (presentationId: string) => {
    void navigator.clipboard?.writeText(buildPresentationLink(presentationId));
    setCopiedId(presentationId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const attachedIds = new Set(attached.map((r) => r.id));
  const unattached = available.filter((r) => !attachedIds.has(r.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-[#c9b07a]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-semibold tracking-widest text-[#c9b07a] uppercase">
          Presentation Recordings
        </label>
        <button
          onClick={() => { setShowPicker((v) => !v); if (!showPicker) void refreshAvailable(); }}
          className="hdr-gold-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest"
        >
          <Plus className="hdr-gold-icon h-3 w-3" strokeWidth={1.5} /> Attach
        </button>
      </div>

      {attached.length === 0 && !showPicker && (
        <p className="text-[10px] text-white/35">
          No presentations attached yet. Click "Attach" to link an audio or video recording from Presentation Mode.
        </p>
      )}

      {attached.length > 0 && (
        <div className="space-y-2">
          {attached.map((rec) => {
            const Icon = rec.media_type === 'video' ? Video : Mic;
            return (
              <div
                key={rec.attachment_id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#c0911e]/10">
                  <Icon className="h-4 w-4 text-[#c9b07a]" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white/80">{rec.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-[8px] text-white/35">
                    <span>{rec.media_type.toUpperCase()}</span>
                    <span>{formatDuration(rec.duration_seconds)}</span>
                    {rec.presentation_id && (
                      <span className="font-mono text-[#c9b07a]/70">{rec.presentation_id}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {rec.presentation_id && (
                    <button
                      onClick={() => handleCopyLink(rec.presentation_id!)}
                      className="rounded border border-white/10 p-1 text-white/40 hover:text-[#c9b07a]"
                      title="Copy presentation link"
                    >
                      {copiedId === rec.presentation_id
                        ? <Check className="h-3 w-3 text-emerald-400" />
                        : <Link2 className="h-3 w-3" />}
                    </button>
                  )}
                  <button
                    onClick={() => void handleRemove(rec.attachment_id)}
                    className="rounded border border-white/10 p-1 text-white/40 hover:text-red-400"
                    title="Detach recording"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div className="rounded-lg border border-[#c0911e]/20 bg-[#08090b] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">
              Your Recordings
            </span>
            <button onClick={() => setShowPicker(false)} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {pickerLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#c9b07a]" />
            </div>
          ) : unattached.length === 0 ? (
            <div className="py-4 text-center">
              <Film className="mx-auto mb-2 h-6 w-6 text-white/15" />
              <p className="text-[10px] text-white/35">
                No unattached recordings found. Record a presentation first in Presentation Mode.
              </p>
            </div>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {unattached.map((rec) => {
                const Icon = rec.media_type === 'video' ? Video : Mic;
                return (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-[#0a0c0e] p-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#c0911e]/10">
                      <Icon className="h-3.5 w-3.5 text-[#c9b07a]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-medium text-white/70">{rec.title}</p>
                      <div className="mt-0.5 flex gap-2 text-[8px] text-white/30">
                        <span>{rec.media_type.toUpperCase()}</span>
                        <span>{formatDuration(rec.duration_seconds)}</span>
                        {rec.presentation_id && (
                          <span className="font-mono text-[#c9b07a]/60">{rec.presentation_id}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleAttach(rec.id)}
                      disabled={attachingId === rec.id}
                      className="hdr-gold-btn flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-bold uppercase tracking-widest disabled:opacity-40"
                    >
                      {attachingId === rec.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Plus className="h-3 w-3" strokeWidth={1.5} />}
                      Link
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
