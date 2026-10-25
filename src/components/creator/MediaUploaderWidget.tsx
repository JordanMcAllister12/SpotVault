import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, X, ImageIcon, Video, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FloatingWindow } from '@/components/player/FloatingWindow';
import { useUserPreferences, type WidgetLayout } from '@/hooks/useUserPreferences';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const GOLD_BORDER = 'rgba(192,145,30,0.25)';

export interface MediaUploaderState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  size: { width: number; height: number };
  z: number;
}

export interface MediaUploaderActions {
  setOpen: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setPos: (p: { x: number; y: number }) => void;
  setSize: (s: { width: number; height: number }) => void;
  bringToFront: () => void;
  config: { widgetId: string; defaultPos: { x: number; y: number }; defaultSize: { width: number; height: number } };
}

export function useMediaUploaderWidget(
  accountId: string | null | undefined,
  config: { widgetId: string; defaultPos: { x: number; y: number }; defaultSize: { width: number; height: number } },
  baseZ: number = 13,
): [MediaUploaderState, MediaUploaderActions] {
  const prefs = useUserPreferences(accountId);
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(config.defaultPos);
  const [size, setSize] = useState(config.defaultSize);
  const [z, setZ] = useState(baseZ);

  useEffect(() => {
    if (prefs.loading) return;
    const saved = prefs.prefs.coachWidgetLayouts[config.widgetId];
    if (saved) {
      setOpen(saved.open);
      setMinimized(saved.minimized);
      setPos({ x: saved.x, y: saved.y });
      setSize({ width: saved.width, height: saved.height });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loading, config.widgetId]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const layout: WidgetLayout = {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
        open, minimized, maximized: false,
      };
      prefs.setCoachWidgetLayout(config.widgetId, layout);
    }, 800);
    saveTimer.current = timer;
    return () => clearTimeout(timer);
  }, [pos, size, open, minimized, config.widgetId, prefs]);

  const bringToFront = useCallback(() => setZ(zv => zv + 1), []);

  const state: MediaUploaderState = { open, minimized, pos, size, z };
  const actions: MediaUploaderActions = { setOpen, setMinimized, setPos, setSize, bringToFront, config };
  return [state, actions];
}

interface PendingMedia {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function MediaUploaderWidget({ state, actions, account }: {
  state: MediaUploaderState;
  actions: MediaUploaderActions;
  account: SpotVaultAccount | null;
}) {
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setMedia = useCallback((file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return;
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPendingMedia({ file, previewUrl: url, type: isVideo ? 'video' : 'image' });
    setStatus('idle');
    setErrorMsg('');
  }, []);

  const clearMedia = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPendingMedia(null);
    setStatus('idle');
    setErrorMsg('');
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMedia(files[0]);
  }, [setMedia]);

  const handleSubmit = useCallback(async () => {
    if (!pendingMedia || !account) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      const ext = pendingMedia.file.name.split('.').pop() || 'bin';
      const filePath = `${account.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, pendingMedia.file, { upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      const attachmentType = pendingMedia.type === 'video' ? 'video' : 'image';
      const attachmentUrl = urlData.publicUrl;
      const attachmentLabel = pendingMedia.file.name;

      const role = account.homePortal === 'CREATOR' ? 'CREATOR' : 'PLAYER';

      const { error: insertErr } = await supabase
        .from('network_chat_messages')
        .insert({
          author_id: account.id,
          author_name: account.name,
          author_role: role,
          body: caption.trim() || null,
          is_sponsored: false,
          attachment_type: attachmentType,
          attachment_url: attachmentUrl,
          attachment_label: attachmentLabel,
        });

      if (insertErr) throw new Error(insertErr.message);

      setStatus('success');
      setCaption('');
      clearMedia();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to post. Please try again.');
    }
  }, [pendingMedia, account, caption, clearMedia]);

  const initials = account?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  const roleLabel = 'CREATOR';
  const roleColor = '#ec4899';

  return (
    <>
      {state.open && !state.minimized && (
        <FloatingWindow
          id={actions.config.widgetId}
          title="Create Post"
          subtitle="Social Feed"
          icon={<Upload className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
          position={state.pos}
          size={state.size}
          collapsed={false}
          maximized={false}
          minimized={false}
          pinned={false}
          zIndex={state.z}
          onChangePosition={actions.setPos}
          onChangeSize={actions.setSize}
          onToggleCollapse={() => {}}
          onToggleMaximize={() => actions.setSize({ width: 460, height: 640 })}
          onToggleMinimize={() => actions.setMinimized(true)}
          onTogglePin={() => {}}
          onClose={() => actions.setOpen(false)}
          onBringToFront={actions.bringToFront}
          minWidth={380}
          resizable
        >
          <div className="flex h-full flex-col overflow-hidden">
            {/* Status banner */}
            {status === 'success' && (
              <div className="flex shrink-0 items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Posted to Social Feed</span>
                <button onClick={() => setStatus('idle')} className="ml-auto text-emerald-400/50 hover:text-emerald-400">
                  <X size={12} />
                </button>
              </div>
            )}
            {status === 'error' && (
              <div className="flex shrink-0 items-center gap-2 border-b border-red-500/20 bg-red-500/8 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-red-300">{errorMsg}</span>
                <button onClick={() => setStatus('idle')} className="ml-auto text-red-400/50 hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* Upload zone / Preview */}
              {!pendingMedia ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-all"
                  style={{
                    borderColor: dragOver ? GOLD : 'rgba(255,255,255,0.12)',
                    background: dragOver ? 'rgba(192,145,30,0.06)' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <Upload size={24} className="mb-2 text-white/25" strokeWidth={1.5} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Upload Media</span>
                  <span className="mt-1 text-[9px] text-white/25">Drag & drop or click to browse</span>
                  <span className="mt-2 text-[8px] text-white/20">Photos, videos, images</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {/* Preview */}
                  <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    {pendingMedia.type === 'image' ? (
                      <img src={pendingMedia.previewUrl} alt="Preview" className="max-h-64 w-full object-contain" style={{ background: 'rgba(0,0,0,0.3)' }} />
                    ) : (
                      <video src={pendingMedia.previewUrl} controls className="max-h-64 w-full" style={{ background: 'rgba(0,0,0,0.3)' }} />
                    )}
                    <button
                      onClick={clearMedia}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                      style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                      title="Remove media"
                    >
                      <X size={14} className="text-white/70" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    {pendingMedia.type === 'image' ? <ImageIcon size={11} className="text-white/30" /> : <Video size={11} className="text-white/30" />}
                    <span className="truncate text-[10px] text-white/40">{pendingMedia.file.name}</span>
                    <span className="ml-auto text-[9px] text-white/20">{(pendingMedia.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-md border py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02]"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    Replace Media
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {/* Caption */}
              {pendingMedia && (
                <div className="mt-3">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a caption..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
                  />
                </div>
              )}

              {/* Post Preview */}
              {pendingMedia && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30">Preview</div>
                  <div className="rounded-lg border p-2.5" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.92)' }}>
                    <div className="flex gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/80"
                        style={{ borderColor: `${roleColor}40`, background: `${roleColor}15` }}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-semibold text-white/90">{account?.name ?? 'Creator'}</span>
                          <span className="shrink-0 rounded px-1 py-0.5 text-[7px] font-bold tracking-wide"
                            style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}30` }}>
                            {roleLabel}
                          </span>
                          <span className="shrink-0 text-[9px] text-white/25">just now</span>
                        </div>
                        {caption.trim() && (
                          <p className="mt-0.5 text-[11px] leading-relaxed text-white/80">{caption}</p>
                        )}
                        <div className="mt-1.5 overflow-hidden rounded-lg border border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.3)' }}>
                          {pendingMedia.type === 'image' ? (
                            <img src={pendingMedia.previewUrl} alt="Preview" className="max-h-40 w-full object-contain" />
                          ) : (
                            <video src={pendingMedia.previewUrl} className="max-h-40 w-full" muted />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            {pendingMedia && (
              <div className="shrink-0 border-t border-white/[0.06] p-2.5">
                <button
                  onClick={handleSubmit}
                  disabled={status === 'uploading'}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}
                >
                  {status === 'uploading' ? (
                    <><Loader2 size={14} className="animate-spin" /> Posting...</>
                  ) : (
                    <><Send size={14} strokeWidth={1.5} /> Submit to Social Feed</>
                  )}
                </button>
              </div>
            )}
          </div>
        </FloatingWindow>
      )}

      {/* Dock button */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[200] flex flex-col items-end gap-2">
        {state.open && state.minimized && (
          <button
            onClick={() => { actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Restore uploader"
          >
            <Upload className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Create Post</span>
          </button>
        )}
        {!state.open && (
          <button
            onClick={() => { actions.setOpen(true); actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Open uploader"
          >
            <Upload className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Create Post</span>
          </button>
        )}
      </div>
    </>
  );
}
