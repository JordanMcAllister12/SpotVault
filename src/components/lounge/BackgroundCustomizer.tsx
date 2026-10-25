import { useState, useRef, useCallback } from 'react';
import { Image as ImageIcon, X, Check, Upload, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { saveBackgroundPreference } from '@/lib/loungeStore';
import {
  SPOTVAULT_BG_PRESETS,
  OVERLAY_OPACITY,
  type BackgroundPreference,
  type BackgroundFit,
  type BackgroundPosition,
  type OverlayIntensity,
} from '@/lib/loungeFramework';

interface Props {
  userId: string;
  loungeSlug: string;
  communityDefaultBg: string | undefined;
  preference: BackgroundPreference;
  onApply: (pref: BackgroundPreference) => void;
  onClose: () => void;
}

export function BackgroundCustomizer({
  userId,
  loungeSlug,
  communityDefaultBg,
  preference,
  onApply,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<BackgroundPreference>(preference);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image must be under 8 MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Only JPG, PNG, and WEBP are supported');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/${loungeSlug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('user-uploads')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
      setDraft((d) => ({ ...d, backgroundType: 'custom', backgroundValue: urlData.publicUrl }));
    } catch {
      setUploadError('Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  }, [userId, loungeSlug]);

  const handleApply = useCallback(async () => {
    setSaving(true);
    try {
      await saveBackgroundPreference(userId, loungeSlug, draft);
      onApply(draft);
      onClose();
    } catch {
      setUploadError('Could not save preference');
    } finally {
      setSaving(false);
    }
  }, [userId, loungeSlug, draft, onApply, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] shadow-2xl"
        style={{ boxShadow: '0 24px 80px -20px rgba(0,0,0,0.9)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
            <span className="text-sm font-bold text-white">Customize Lounge Background</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {/* Background source */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
              Background
            </div>
            <div className="space-y-2">
              {/* Default */}
              <button
                onClick={() => setDraft((d) => ({ ...d, backgroundType: 'default', backgroundValue: null }))}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  draft.backgroundType === 'default'
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a1f25]">
                  <ImageIcon className="h-3.5 w-3.5 text-white/40" />
                </div>
                <span className="text-xs font-medium text-white/80">Community Default</span>
                {draft.backgroundType === 'default' && (
                  <Check className="ml-auto h-3.5 w-3.5 text-[#d4a52c]" />
                )}
              </button>

              {/* SpotVault presets */}
              {SPOTVAULT_BG_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setDraft((d) => ({ ...d, backgroundType: 'spotvault-preset', backgroundValue: preset.url }))}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    draft.backgroundType === 'spotvault-preset' && draft.backgroundValue === preset.url
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                  }`}
                >
                  <div className="h-8 w-8 overflow-hidden rounded-md bg-[#1a1f25]">
                    {preset.url ? (
                      <img src={preset.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#0a0c0e] to-[#050608]" />
                    )}
                  </div>
                  <span className="text-xs font-medium text-white/80">{preset.label}</span>
                  {draft.backgroundType === 'spotvault-preset' && draft.backgroundValue === preset.url && (
                    <Check className="ml-auto h-3.5 w-3.5 text-[#d4a52c]" />
                  )}
                </button>
              ))}

              {/* Custom upload */}
              <button
                onClick={() => fileRef.current?.click()}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  draft.backgroundType === 'custom'
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a1f25]">
                  <Upload className="h-3.5 w-3.5 text-white/40" />
                </div>
                <span className="text-xs font-medium text-white/80">
                  {uploading ? 'Uploading...' : draft.backgroundType === 'custom' ? 'Custom image selected' : 'Upload custom image'}
                </span>
                {draft.backgroundType === 'custom' && !uploading && (
                  <Check className="ml-auto h-3.5 w-3.5 text-[#d4a52c]" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </div>
            {uploadError && (
              <p className="mt-2 text-[10px] text-red-400/80">{uploadError}</p>
            )}
          </div>

          {/* Preview */}
          {draft.backgroundValue && (
            <div className="mb-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Preview</div>
              <div
                className="relative h-24 overflow-hidden rounded-lg border border-white/[0.06]"
                style={{
                  backgroundImage: `url(${draft.backgroundValue})`,
                  backgroundSize: draft.fit,
                  backgroundPosition: draft.position,
                }}
              >
                <div
                  className="absolute inset-0 bg-black"
                  style={{ opacity: OVERLAY_OPACITY[draft.overlay] }}
                />
              </div>
            </div>
          )}

          {/* Fit */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Fit</div>
            <div className="flex gap-2">
              {(['cover', 'contain'] as BackgroundFit[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setDraft((d) => ({ ...d, fit: f }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition-all ${
                    draft.fit === f
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10 text-[#f5e6b0]'
                      : 'border-white/[0.06] text-white/50 hover:border-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Position</div>
            <div className="flex gap-2">
              {(['top', 'center', 'bottom'] as BackgroundPosition[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft((d) => ({ ...d, position: p }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition-all ${
                    draft.position === p
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10 text-[#f5e6b0]'
                      : 'border-white/[0.06] text-white/50 hover:border-white/10'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Overlay */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Overlay Darkness</div>
            <div className="flex gap-2">
              {(['none', 'light', 'medium', 'dark'] as OverlayIntensity[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setDraft((d) => ({ ...d, overlay: o }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-medium capitalize transition-all ${
                    draft.overlay === o
                      ? 'border-[#c0911e]/40 bg-[#c0911e]/10 text-[#f5e6b0]'
                      : 'border-white/[0.06] text-white/50 hover:border-white/10'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:text-white/90"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving || uploading}
            className="rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-5 py-2 text-[11px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
