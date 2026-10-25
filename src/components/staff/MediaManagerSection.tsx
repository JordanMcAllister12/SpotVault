import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Youtube, Play, Trash2, Eye, CheckCircle2, X, AlertCircle,
  Video as VideoIcon, Film, Clock, FileVideo, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { YouTubePlayer, parseYouTubeId } from '@/components/player/widgets/YouTubePlayer';

// ── Types ──────────────────────────────────────────────────────

interface MediaAsset {
  id: string;
  title: string;
  description: string | null;
  source_type: 'uploaded' | 'youtube';
  storage_path: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  duration: number | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ActiveAssignment {
  assignment_id: string;
  asset: MediaAsset;
}

const BUCKET = 'media-manager';
const DESTINATION = 'player_my_spots';
const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];

// ── YouTube helpers ─────────────────────────────────────────────

function youtubeThumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}



function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function storagePublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadWithProgress(path: string, file: File, onProgress: (value: number) => void): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${baseUrl}/storage/v1/object/${BUCKET}/${path}`);
    request.setRequestHeader('apikey', anonKey);
    request.setRequestHeader('Authorization', `Bearer ${session?.access_token ?? anonKey}`);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error('Network error while uploading video'));
    request.send(file);
  });
}

// ── Main component ──────────────────────────────────────────────

export function MediaManagerSection({ staffAccountId }: { staffAccountId: string }) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<MediaAsset | null>(null);
  const [removeAssignment, setRemoveAssignment] = useState<ActiveAssignment | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: assetData, error: aErr }, { data: assignData, error: asErr }] = await Promise.all([
      supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
      supabase.from('media_assignments').select('id, media_asset_id').eq('destination', DESTINATION).eq('status', 'active').order('assigned_at', { ascending: false }),
    ]);
    if (aErr) console.error('media_assets load error:', aErr.message);
    if (asErr) console.error('media_assignments load error:', asErr.message);

    setAssets(assetData ?? []);

    const assignments: ActiveAssignment[] = (assignData ?? [])
      .map((a) => {
        const matched = (assetData ?? []).find((asset) => asset.id === a.media_asset_id);
        return matched ? { assignment_id: a.id, asset: matched } : null;
      })
      .filter((a): a is ActiveAssignment => a !== null);
    setActiveAssignments(assignments);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handlePublishToMySpots = async (asset: MediaAsset) => {
    await supabase.from('media_assignments').insert({
      media_asset_id: asset.id,
      destination: DESTINATION,
      status: 'active',
      assigned_by: staffAccountId,
    });
    await loadData();
  };

  const handleUnpublish = async () => {
    if (!removeAssignment) return;
    await supabase.from('media_assignments').update({ status: 'inactive' }).eq('id', removeAssignment.assignment_id);
    setRemoveAssignment(null);
    await loadData();
  };

  const handleDeleteAsset = async () => {
    if (!deleteAsset) return;
    const assignIds = activeAssignments.filter((a) => a.asset.id === deleteAsset.id).map((a) => a.assignment_id);
    if (assignIds.length > 0) {
      await supabase.from('media_assignments').update({ status: 'inactive' }).in('id', assignIds);
    }
    if (deleteAsset.source_type === 'uploaded' && deleteAsset.storage_path) {
      await supabase.storage.from(BUCKET).remove([deleteAsset.storage_path]);
    }
    await supabase.from('media_assets').delete().eq('id', deleteAsset.id);
    setDeleteAsset(null);
    await loadData();
  };

  const isAssigned = (assetId: string) => activeAssignments.some((a) => a.asset.id === assetId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-black/50 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Media Manager</div>
            <h1 className="mt-1 text-xl font-semibold text-white">My Spots Video Library</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/25">
              <Upload className="h-3.5 w-3.5" /> Upload Video
            </button>
            <button onClick={() => setYoutubeOpen(true)} className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[10px] font-bold tracking-widest text-red-300 uppercase hover:bg-red-500/20">
              <Youtube className="h-3.5 w-3.5" /> Add YouTube Video
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-5">
        {/* Published to My Spots */}
        <div className="mx-auto mb-6 max-w-4xl">
          <div className="mb-3 text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Published to My Spots · {activeAssignments.length} {activeAssignments.length === 1 ? 'video' : 'videos'}</div>
          {activeAssignments.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeAssignments.map((aa) => (
                <div key={aa.assignment_id} className="flex gap-3 rounded-xl border border-[#c0911e]/30 bg-black/60 p-4 backdrop-blur-md">
                  <div className="relative w-28 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
                    {aa.asset.source_type === 'youtube' && aa.asset.youtube_video_id ? (
                      <img src={aa.asset.thumbnail_url ?? youtubeThumb(aa.asset.youtube_video_id)} alt={aa.asset.title} className="aspect-video w-full object-cover" />
                    ) : aa.asset.storage_path ? (
                      <video src={storagePublicUrl(aa.asset.storage_path)} className="aspect-video w-full object-contain" poster={aa.asset.thumbnail_url ?? undefined} muted />
                    ) : (
                      <div className="aspect-video w-full bg-[radial-gradient(ellipse_at_50%_30%,#25211a_0%,#08090a_75%)]" />
                    )}
                    <div className="absolute left-1 top-1 rounded border border-[#c0911e]/40 bg-black/70 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">{aa.asset.source_type === 'youtube' ? 'YT' : 'UP'}</div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-[13px] font-bold text-white">{aa.asset.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-white/40">
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{formatDate(aa.asset.created_at)}</span>
                    </div>
                    <div className="mt-auto flex gap-1.5 pt-3">
                      <button onClick={() => setPreviewAsset(aa.asset)} className="flex items-center gap-1 rounded-md border border-white/15 bg-white/[0.03] px-2 py-1.5 text-[8px] font-bold tracking-widest text-white/70 uppercase hover:border-white/30">
                        <Eye className="h-3 w-3" /> Preview
                      </button>
                      <button onClick={() => setRemoveAssignment(aa)} className="flex items-center gap-1 rounded-md border border-red-300/20 bg-red-300/5 px-2 py-1.5 text-[8px] font-bold tracking-widest text-red-200 uppercase hover:border-red-300/40 hover:bg-red-300/10">
                        <X className="h-3 w-3" /> Unpublish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-8 text-center backdrop-blur-md">
              <Film className="mx-auto mb-3 h-8 w-8 text-white/25" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-white/50">Nothing published yet</p>
              <p className="mt-1 text-[10px] text-white/30">Select a video from the library below and click Publish to My Spots.</p>
            </div>
          )}
        </div>

        {/* Media Library */}
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 text-[10px] font-mono tracking-[0.25em] text-white/40 uppercase">Media Library · {assets.length} {assets.length === 1 ? 'item' : 'items'}</div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/40"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/40 p-8 text-center backdrop-blur-md">
              <FileVideo className="mx-auto mb-3 h-8 w-8 text-white/25" strokeWidth={1.5} />
              <p className="text-[12px] font-semibold text-white/50">No media added yet</p>
              <p className="mt-1 text-[10px] text-white/30">Upload a video or add a YouTube link to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <div key={asset.id} className={`rounded-xl border bg-black/50 p-4 backdrop-blur-md transition-all ${isAssigned(asset.id) ? 'border-[#c0911e]/40' : 'border-white/[0.06] hover:border-white/15'}`}>
                  <div className="relative mb-3 overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
                    {asset.source_type === 'youtube' && asset.youtube_video_id ? (
                      <img src={asset.thumbnail_url ?? youtubeThumb(asset.youtube_video_id)} alt={asset.title} className="aspect-video w-full object-cover" />
                    ) : asset.storage_path ? (
                      <video src={storagePublicUrl(asset.storage_path)} className="aspect-video w-full object-contain" poster={asset.thumbnail_url ?? undefined} muted />
                    ) : (
                      <div className="aspect-video w-full bg-[radial-gradient(ellipse_at_50%_30%,#25211a_0%,#08090a_75%)]" />
                    )}
                    <div className="absolute left-2 top-2 rounded border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase backdrop-blur-sm" style={{ borderColor: asset.source_type === 'youtube' ? 'rgba(248,113,113,0.4)' : 'rgba(212,165,44,0.4)', background: 'rgba(0,0,0,0.7)', color: asset.source_type === 'youtube' ? '#fca5a5' : '#d4a52c' }}>
                      {asset.source_type === 'youtube' ? 'YouTube' : 'Uploaded'}
                    </div>
                    {isAssigned(asset.id) && (
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded border border-emerald-300/40 bg-black/70 px-2 py-0.5 text-[8px] font-bold tracking-widest text-emerald-300 uppercase">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Published
                      </div>
                    )}
                  </div>
                  <h3 className="truncate text-[12px] font-semibold text-white">{asset.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-white/35">
                    <span>{formatDate(asset.created_at)}</span>
                    {asset.duration && <span>· {formatDuration(asset.duration)}</span>}
                    {asset.file_size && <span>· {formatBytes(asset.file_size)}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button onClick={() => setPreviewAsset(asset)} className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[8px] font-bold tracking-widest text-white/60 uppercase hover:border-white/25 hover:text-white/80">
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    {!isAssigned(asset.id) ? (
                      <button onClick={() => void handlePublishToMySpots(asset)} className="flex items-center gap-1 rounded-md border border-[#d4a52c]/40 bg-[#d4a52c]/10 px-2 py-1.5 text-[8px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/20">
                        <VideoIcon className="h-3 w-3" /> Publish to My Spots
                      </button>
                    ) : (
                      <button onClick={() => { const aa = activeAssignments.find((a) => a.asset.id === asset.id); if (aa) setRemoveAssignment(aa); }} className="flex items-center gap-1 rounded-md border border-red-300/20 bg-red-300/5 px-2 py-1.5 text-[8px] font-bold tracking-widest text-red-200 uppercase hover:border-red-300/40">
                        <X className="h-3 w-3" /> Unpublish
                      </button>
                    )}
                    <button onClick={() => setEditAsset(asset)} className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[8px] font-bold tracking-widest text-white/50 uppercase hover:border-white/25 hover:text-white/70">
                      Edit
                    </button>
                    <button onClick={() => setDeleteAsset(asset)} className="flex items-center gap-1 rounded-md border border-red-300/20 bg-red-300/5 px-2 py-1.5 text-[8px] font-bold tracking-widest text-red-200 uppercase hover:border-red-300/40">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); void loadData(); }} staffAccountId={staffAccountId} />}
      {youtubeOpen && <AddYouTubeModal onClose={() => setYoutubeOpen(false)} onSaved={() => { setYoutubeOpen(false); void loadData(); }} staffAccountId={staffAccountId} />}
      {previewAsset && <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}
      {editAsset && <EditModal asset={editAsset} onClose={() => setEditAsset(null)} onSaved={() => { setEditAsset(null); void loadData(); }} />}
      {deleteAsset && <DeleteConfirm asset={deleteAsset} onCancel={() => setDeleteAsset(null)} onConfirm={() => void handleDeleteAsset()} />}
      {removeAssignment && (
        <ConfirmDialog
          title="Unpublish from My Spots"
          message={`Unpublish "${removeAssignment.asset.title}" from My Spots? The video will remain in the library.`}
          confirmLabel="Unpublish"
          onCancel={() => setRemoveAssignment(null)}
          onConfirm={() => void handleUnpublish()}
        />
      )}
    </div>
  );
}

// ── Upload Modal ────────────────────────────────────────────────

function UploadModal({ onClose, onSaved, staffAccountId }: { onClose: () => void; onSaved: () => void; staffAccountId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File | null) => {
    if (f && !ACCEPTED_TYPES.includes(f.type)) {
      setError('Unsupported format. Use MP4, WebM, or MOV.');
      return;
    }
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    setError('');
  };

  const handleUpload = async () => {
    if (!file || !title) return;
    setPhase('uploading');
    setProgress(0);
    setError('');

    const ext = file.name.split('.').pop() ?? 'mp4';
    const storagePath = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      await uploadWithProgress(storagePath, file, setProgress);

      setPhase('processing');

      let duration: number | null = null;
      let thumbnailUrl: string | null = null;
      try {
        const videoUrl = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => {
            duration = v.duration;
            v.currentTime = Math.min(1, (v.duration || 2) / 2);
          };
          v.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(v, 0, 0, 320, 180);
              thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
            }
            resolve();
          };
          v.onerror = () => resolve();
          v.src = videoUrl;
        });
      } catch { /* duration/thumbnail are optional */ }

      const { error: dbErr } = await supabase.from('media_assets').insert({
        title,
        description: description || null,
        source_type: 'uploaded',
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        duration: duration ? Math.round(duration) : null,
        thumbnail_url: thumbnailUrl,
        uploaded_by: staffAccountId,
        status: 'ready',
      });

      if (dbErr) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw new Error(dbErr.message);
      }

      setPhase('done');
      setTimeout(onSaved, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('error');
    }
  };

  return (
    <ModalShell title="Upload Video" onClose={onClose}>
      {phase === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          <p className="text-sm font-semibold text-white">Upload complete</p>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/10 px-3 py-2 text-[11px] text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Video File</label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f); }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/30 p-6 transition hover:border-[#d4a52c]/40"
            >
              {file ? (
                <div className="flex items-center gap-2 text-[11px] text-white/70">
                  <FileVideo className="h-5 w-5 text-[#d4a52c]" /> {file.name} ({formatBytes(file.size)})
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-6 w-6 text-white/30" />
                  <p className="text-[11px] text-white/50">Click or drag a video file here</p>
                  <p className="mt-1 text-[9px] text-white/30">MP4, WebM, MOV</p>
                </>
              )}
              <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
          </div>
          {(phase === 'uploading' || phase === 'processing') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span className="flex items-center gap-1.5">
                  {phase === 'uploading' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : 'Processing...'}
                </span>
                {phase === 'uploading' && <span>{Math.round(progress)}%</span>}
              </div>
              {phase === 'uploading' && (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#d4a52c] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:bg-white/5">Cancel</button>
            <button disabled={!file || !title || phase === 'uploading' || phase === 'processing'} onClick={() => void handleUpload()} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/30 disabled:opacity-40">
              {phase === 'uploading' ? 'Uploading...' : phase === 'processing' ? 'Processing...' : 'Upload'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Add YouTube Modal ───────────────────────────────────────────

function AddYouTubeModal({ onClose, onSaved, staffAccountId }: { onClose: () => void; onSaved: () => void; staffAccountId: string }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    const id = parseYouTubeId(value);
    setVideoId(id);
    if (id && !title) setTitle('');
    if (!id && value) setError('Could not extract a YouTube video ID from that URL.');
    else setError('');
  };

  const handleSave = async () => {
    if (!videoId) { setError('Please enter a valid YouTube URL.'); return; }
    if (!title) { setError('Please enter a title.'); return; }
    setSaving(true);
    setError('');
    try {
      const { error: dbErr } = await supabase.from('media_assets').insert({
        title,
        description: description || null,
        source_type: 'youtube',
        youtube_video_id: videoId,
        youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail_url: youtubeThumb(videoId),
        uploaded_by: staffAccountId,
        status: 'ready',
      });
      if (dbErr) throw new Error(dbErr.message);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save YouTube video');
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Add YouTube Video" onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/10 px-3 py-2 text-[11px] text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">YouTube URL</label>
          <input value={url} onChange={(e) => handleUrlChange(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
          <p className="mt-1 text-[9px] text-white/30">Supports youtube.com/watch, youtu.be, and embed URLs.</p>
        </div>
        {videoId && (
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
            <img src={youtubeThumb(videoId)} alt="Preview" className="aspect-video w-full object-cover" />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:bg-white/5">Cancel</button>
          <button disabled={!videoId || !title || saving} onClick={() => void handleSave()} className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-[10px] font-bold tracking-widest text-red-300 uppercase hover:bg-red-500/25 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Youtube className="h-3.5 w-3.5" />} Add Video
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Preview Modal ───────────────────────────────────────────────

function PreviewModal({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  return (
    <ModalShell title={`Preview — ${asset.title}`} onClose={onClose} wide>
      <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black">
        {asset.source_type === 'youtube' && asset.youtube_video_id ? (
          <div className="aspect-video w-full">
            <YouTubePlayer videoId={asset.youtube_video_id} title={asset.title} />
          </div>
        ) : asset.storage_path ? (
          <video src={storagePublicUrl(asset.storage_path)} controls className="aspect-video w-full" poster={asset.thumbnail_url ?? undefined} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-white/40">
            <AlertCircle className="mr-2 h-5 w-5" /> Video source unavailable
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────

function EditModal({ asset, onClose, onSaved }: { asset: MediaAsset; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(asset.title);
  const [description, setDescription] = useState(asset.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('media_assets').update({ title, description: description || null, updated_at: new Date().toISOString() }).eq('id', asset.id);
    onSaved();
  };

  return (
    <ModalShell title="Edit Media" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white outline-none focus:border-[#d4a52c]/40" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:bg-white/5">Cancel</button>
          <button disabled={saving} onClick={() => void handleSave()} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/30 disabled:opacity-40">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Delete Confirm ──────────────────────────────────────────────

function DeleteConfirm({ asset, onCancel, onConfirm }: { asset: MediaAsset; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog
      title="Delete Media"
      message={`Delete "${asset.title}"? This will remove the video file and all assignments. This cannot be undone.`}
      confirmLabel="Delete"
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

// ── Shared UI ──────────────────────────────────────────────────

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[85vh] overflow-y-auto rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 shadow-2xl ${wide ? 'w-[90vw] max-w-3xl' : 'w-[90vw] max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, destructive, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[90vw] max-w-sm rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-white/60">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} className={`rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase ${destructive ? 'border-red-400/40 bg-red-500/20 text-red-200 hover:bg-red-500/30' : 'border-[#d4a52c]/50 bg-[#d4a52c]/20 text-[#f5e6b0] hover:bg-[#d4a52c]/30'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
