import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, X, ArrowUp, ArrowDown, Loader2, ImagePlus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  type PendingEvidence,
  type SpotEvidence,
  fetchEvidence,
  uploadEvidenceImage,
  addEvidence,
  updateEvidence,
  deleteEvidence,
  reorderEvidence,
  isAcceptedImageType,
} from '@/lib/evidenceStore';

const GOLD = '#d4a52c';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

interface Props {
  spotId?: string;
  pendingEvidence: PendingEvidence[];
  onPendingChange: (items: PendingEvidence[]) => void;
}

interface EvidenceItem {
  id: string;
  url: string;
  title: string;
  caption: string;
  classification: string;
  pending: boolean;
}

export function EvidenceSection({ spotId, pendingEvidence, onPendingChange }: Props) {
  const [evidence, setEvidence] = useState<SpotEvidence[]>([]);
  const [loading, setLoading] = useState(Boolean(spotId));
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<EvidenceItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingIdRef = useRef<string | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!spotId) {
      setEvidence([]);
      setLoading(false);
      return () => { mounted = false; };
    }
    setLoading(true);
    fetchEvidence(spotId).then((items) => {
      if (mounted) {
        setEvidence(items);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [spotId]);

  const addPendingFiles = useCallback((files: File[]) => {
    const accepted: PendingEvidence[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!isAcceptedImageType(file) || file.size > MAX_IMAGE_SIZE) {
        rejected.push(file.name);
        continue;
      }
      accepted.push({
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        title: '',
        caption: '',
        classification: '',
      });
    }
    if (rejected.length > 0) setError(`Could not add ${rejected.join(', ')}. Use PNG, JPG, or WEBP images up to 10 MB.`);
    if (accepted.length > 0) onPendingChange([...pendingEvidence, ...accepted]);
  }, [onPendingChange, pendingEvidence]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!spotId) {
      addPendingFiles(files);
      return;
    }
    setUploading(true);
    setError(null);
    for (const file of files) {
      if (!isAcceptedImageType(file) || file.size > MAX_IMAGE_SIZE) {
        setError(`Could not add "${file.name}". Use PNG, JPG, or WEBP images up to 10 MB.`);
        continue;
      }
      const url = await uploadEvidenceImage(file);
      if (!url) {
        setError(`Upload failed for "${file.name}". Please retry.`);
        continue;
      }
      const item = await addEvidence(spotId, url, null, null);
      if (item) setEvidence((prev) => [...prev, item]);
      else setError(`Could not save "${file.name}". Please retry.`);
    }
    setUploading(false);
  }, [addPendingFiles, spotId]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void uploadFiles(Array.from(event.dataTransfer.files));
  }, [uploadFiles]);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
    }
  }, [uploadFiles]);

  const items: EvidenceItem[] = [
    ...evidence.map((item) => ({ id: item.id, url: item.asset_url, title: item.title || '', caption: item.caption || '', classification: item.classification || '', pending: false })),
    ...pendingEvidence.map((item) => ({ id: item.id, url: item.previewUrl, title: item.title, caption: item.caption, classification: item.classification, pending: true })),
  ];

  const updateItem = (item: EvidenceItem, patch: { title?: string; caption?: string; classification?: string }) => {
    if (item.pending) {
      onPendingChange(pendingEvidence.map((pending) => pending.id === item.id ? { ...pending, ...patch } : pending));
      return;
    }
    setEvidence((prev) => prev.map((saved) => saved.id === item.id ? { ...saved, ...patch, title: patch.title ?? saved.title, caption: patch.caption ?? saved.caption, classification: patch.classification ?? saved.classification } : saved));
  };

  const saveItem = async (item: EvidenceItem, patch: { title?: string | null; caption?: string | null; classification?: string | null }) => {
    if (!item.pending) await updateEvidence(item.id, patch);
  };

  const removeItem = async (item: EvidenceItem) => {
    if (item.pending) {
      const pending = pendingEvidence.find((candidate) => candidate.id === item.id);
      if (pending) URL.revokeObjectURL(pending.previewUrl);
      onPendingChange(pendingEvidence.filter((candidate) => candidate.id !== item.id));
      return;
    }
    if (await deleteEvidence(item.id)) setEvidence((prev) => prev.filter((saved) => saved.id !== item.id));
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const nextPending = next.filter((item) => item.pending).map((item) => pendingEvidence.find((pending) => pending.id === item.id)).filter((item): item is PendingEvidence => item !== undefined);
    onPendingChange(nextPending);
    const savedIds = next.filter((item) => !item.pending).map((item) => item.id);
    setEvidence(savedIds.map((id) => evidence.find((item) => item.id === id)).filter((item): item is SpotEvidence => item !== undefined));
    if (spotId && savedIds.length > 0) await reorderEvidence(spotId, savedIds);
  };

  const handleDragOverItem = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (dragOverIdx.current === null || dragOverIdx.current === index) return;
    const next = [...items];
    const [moved] = next.splice(dragOverIdx.current, 1);
    next.splice(index, 0, moved);
    dragOverIdx.current = index;
    const nextPending = next.filter((item) => item.pending).map((item) => pendingEvidence.find((pending) => pending.id === item.id)).filter((item): item is PendingEvidence => item !== undefined);
    onPendingChange(nextPending);
    setEvidence(next.filter((item) => !item.pending).map((item) => evidence.find((saved) => saved.id === item.id)).filter((item): item is SpotEvidence => item !== undefined));
  };

  const handleDragEnd = async () => {
    dragOverIdx.current = null;
    if (spotId) await reorderEvidence(spotId, evidence.map((item) => item.id));
  };

  const handleReplace = async (item: EvidenceItem, file: File) => {
    if (!isAcceptedImageType(file) || file.size > MAX_IMAGE_SIZE) {
      setError('Use PNG, JPG, or WEBP images up to 10 MB.');
      return;
    }
    if (item.pending) {
      const current = pendingEvidence.find((pending) => pending.id === item.id);
      if (!current) return;
      URL.revokeObjectURL(current.previewUrl);
      onPendingChange(pendingEvidence.map((pending) => pending.id === item.id ? { ...pending, file, previewUrl: URL.createObjectURL(file) } : pending));
      return;
    }
    const url = await uploadEvidenceImage(file);
    if (!url || !(await updateEvidence(item.id, { asset_url: url }))) {
      setError('Replacement failed. Please retry.');
      return;
    }
    setEvidence((prev) => prev.map((saved) => saved.id === item.id ? { ...saved, asset_url: url } : saved));
  };

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} /></div>;

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { if (event.target.files) void uploadFiles(Array.from(event.target.files)); event.target.value = ''; }} className="hidden" />
      <input ref={replaceInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const item = items.find((candidate) => candidate.id === replacingIdRef.current); const file = event.target.files?.[0]; if (item && file) void handleReplace(item, file); event.target.value = ''; }} className="hidden" />
      <div onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors" style={{ borderColor: dragging ? 'rgba(212,165,44,0.5)' : 'rgba(255,255,255,0.1)', background: dragging ? 'rgba(212,165,44,0.06)' : 'rgba(255,255,255,0.015)' }}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white/40" /> : <ImagePlus className="h-5 w-5 text-[#d4a52c]" />}
        <p className="text-[11px] font-medium text-white/65">{uploading ? 'Uploading evidence...' : 'Drop screenshots/images here or click to browse'}</p>
        <p className="text-[9px] text-white/30">PNG, JPG, or WEBP up to 10 MB · paste screenshots with Ctrl+V</p>
        <span className="rounded-md border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-[#f5e6b0]">Browse</span>
      </div>
      {error && <div className="flex items-center gap-2 rounded-md border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2"><AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" /><p className="text-[10px] text-amber-300/70">{error}</p><button onClick={() => setError(null)} className="ml-auto text-white/30"><X className="h-3 w-3" /></button></div>}
      {items.length > 0 && <div className="space-y-2.5"><div className="text-[9px] font-semibold tracking-widest text-white/40 uppercase">{items.length} Image{items.length !== 1 ? 's' : ''}</div>{items.map((item, index) => <div key={item.id} draggable onDragStart={() => { dragOverIdx.current = index; }} onDragOver={(event) => handleDragOverItem(event, index)} onDragEnd={() => void handleDragEnd()} className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3"><div className="flex gap-3"><div className="relative shrink-0"><img src={item.url} alt={item.title || `Evidence ${index + 1}`} onClick={() => setLightbox(item)} className="h-24 w-32 cursor-zoom-in rounded-md border border-white/10 object-cover" /><div className="absolute -left-1 top-1/2 flex -translate-y-1/2 flex-col gap-0.5"><button onClick={() => void moveItem(index, -1)} disabled={index === 0} className="flex h-5 w-5 items-center justify-center rounded bg-black/80 text-white/50 disabled:opacity-20"><ArrowUp className="h-3 w-3" /></button><button onClick={() => void moveItem(index, 1)} disabled={index === items.length - 1} className="flex h-5 w-5 items-center justify-center rounded bg-black/80 text-white/50 disabled:opacity-20"><ArrowDown className="h-3 w-3" /></button></div></div><div className="min-w-0 flex-1 space-y-2"><div className="flex items-center"><span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Image {index + 1}</span><div className="ml-auto flex gap-1"><button onClick={() => { replacingIdRef.current = item.id; replaceInputRef.current?.click(); }} title="Replace image" className="p-1 text-white/30 hover:text-white"><RefreshCw className="h-3 w-3" /></button><button onClick={() => void removeItem(item)} title="Remove image" className="p-1 text-white/30 hover:text-red-400"><X className="h-3.5 w-3.5" /></button></div></div><input value={item.title} onChange={(event) => updateItem(item, { title: event.target.value })} onBlur={(event) => void saveItem(item, { title: event.target.value.trim() || undefined })} placeholder="Optional title" className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-2.5 py-1.5 text-[11px] font-medium text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20" /><textarea value={item.caption} onChange={(event) => updateItem(item, { caption: event.target.value })} onBlur={(event) => void saveItem(item, { caption: event.target.value.trim() || undefined })} placeholder="Optional caption / explanation" rows={2} className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#c0911e]/40 placeholder:text-white/20" /><div className="flex items-center gap-2"><span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Type</span><select value={item.classification} onChange={(event) => { updateItem(item, { classification: event.target.value }); void saveItem(item, { classification: event.target.value || null }); }} className="flex-1 rounded-md border border-[#232a32] bg-[#0a0c0e] px-2 py-1 text-[10px] text-white/60 outline-none focus:border-[#c0911e]/40"><option value="">Uncategorized</option><option value="Strategy/Solver">Strategy / Solver</option><option value="Range Chart">Range Chart</option><option value="Hand History">Hand History</option><option value="Results/Statistics">Results / Statistics</option><option value="Illustration/AI Image">Illustration / AI Image</option><option value="Other">Other</option></select></div></div></div></div>)}</div>}
      {lightbox && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}><div className="max-h-[90vh] max-w-[92vw] overflow-auto" onClick={(event) => event.stopPropagation()}><img src={lightbox.url} alt={lightbox.title || 'Evidence'} className="max-h-[78vh] max-w-[92vw] rounded-lg object-contain" />{(lightbox.title || lightbox.caption) && <div className="mt-3 rounded-lg bg-black/70 px-4 py-3 text-center"><p className="text-[12px] font-bold text-white/80">{lightbox.title}</p><p className="mt-1 text-[11px] text-white/55">{lightbox.caption}</p></div>}</div><button onClick={() => setLightbox(null)} className="absolute right-4 top-4 text-white/60"><X className="h-5 w-5" /></button></div>}
    </div>
  );
}
