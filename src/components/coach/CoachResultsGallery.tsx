import { useState, useEffect, useCallback } from 'react';
import { Trophy, Upload, X, Star, Plus, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  account: { id: string; name: string };
}

interface ResultImage {
  id: string;
  image_url: string;
  caption: string;
  image_type: string;
  sort_order: number;
  is_featured: boolean;
  showcase_order: number;
}

const IMAGE_TYPES = [
  { value: 'sharkscope', label: 'SharkScope' },
  { value: 'pokertracker', label: 'PokerTracker' },
  { value: 'hem', label: "Hold'em Manager" },
  { value: 'ggpoker', label: 'GGPoker Results' },
  { value: 'pokerstars', label: 'PokerStars Results' },
  { value: 'hendon_mob', label: 'Hendon Mob' },
  { value: 'tournament_win', label: 'Tournament Win' },
  { value: 'final_table', label: 'Final Table' },
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

export function CoachResultsGallery({ account }: Props) {
  const [images, setImages] = useState<ResultImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageType, setImageType] = useState('other');
  const [dragOver, setDragOver] = useState(false);

  const loadImages = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const accountId = userData.user?.id ?? account.id;
    const { data } = await supabase
      .from('coach_result_images')
      .select('*')
      .eq('coach_account_id', accountId)
      .order('sort_order', { ascending: true });
    setImages((data ?? []) as ResultImage[]);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void loadImages(); }, [loadImages]);

  const handleFile = async (file: File) => {
    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();
    const accountId = userData.user?.id ?? account.id;
    const ext = file.name.split('.').pop();
    const path = `coach-results/${accountId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('user-uploads').upload(path, file);
    if (uploadError) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
    await supabase.from('coach_result_images').insert({
      coach_account_id: accountId,
      image_url: urlData.publicUrl,
      caption,
      image_type: imageType,
      sort_order: images.length,
    });
    setCaption('');
    setUploading(false);
    void loadImages();
  };

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      await handleFile(file);
    }
  };

  const deleteImage = async (id: string) => {
    await supabase.from('coach_result_images').delete().eq('id', id);
    void loadImages();
  };

  const toggleFeatured = async (img: ResultImage) => {
    const MAX_FEATURED = 4;
    if (img.is_featured) {
      await supabase.from('coach_result_images').update({ is_featured: false, showcase_order: 0 }).eq('id', img.id);
    } else {
      const featuredCount = images.filter((i) => i.is_featured).length;
      if (featuredCount >= MAX_FEATURED) return;
      await supabase.from('coach_result_images').update({ is_featured: true, showcase_order: featuredCount }).eq('id', img.id);
    }
    void loadImages();
  };

  const updateCaption = async (id: string, newCaption: string) => {
    await supabase.from('coach_result_images').update({ caption: newCaption }).eq('id', id);
    void loadImages();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[11px] text-white/40">Loading results gallery...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">My Results</h2>
            <p className="text-[10px] text-[#5f6e7c]">Upload screenshots of your poker results and credentials</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="rounded-xl border border-white/[0.08] bg-[rgba(8,11,14,0.93)] p-5 shadow-lg space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files); }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center transition-all ${dragOver ? 'border-[#c0911e]/50 bg-[#c0911e]/8' : 'border-white/[0.12] bg-[rgba(15,18,22,0.85)]'}`}
          >
            <Upload className="h-8 w-8 text-[#5f6e7c]" strokeWidth={1.5} />
            <p className="mt-2 text-sm text-[#aab6c2]">Drag and drop screenshots here</p>
            <p className="text-[10px] text-[#5f6e7c]">SharkScope, PokerTracker, Hendon Mob, tournament wins, etc.</p>
            <label className="mt-3 cursor-pointer rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow">
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) void handleFiles(e.target.files); }} />
              Browse Files
            </label>
            {uploading && <p className="mt-2 text-[10px] text-[#d4a52c]">Uploading...</p>}
          </div>

          {/* Caption + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Caption (optional)</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} className="input-base" placeholder="e.g. SharkScope — $480K Profit / 8,200 Games" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Image Type</label>
              <select value={imageType} onChange={(e) => setImageType(e.target.value)} className="input-base">
                {IMAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#232a32] p-8 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-[#38424e]" strokeWidth={1.5} />
            <p className="text-sm text-[#5f6e7c]">No results uploaded yet.</p>
            <p className="mt-1 text-[11px] text-[#475565]">Upload screenshots to showcase your poker results and credentials.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="metal-panel group relative overflow-hidden rounded-xl">
                <div className="aspect-video overflow-hidden rounded-t-xl bg-[#0a0c0e]">
                  <img src={img.image_url} alt={img.caption} className="h-full w-full object-cover" />
                </div>
                {img.is_featured && (
                  <div className="absolute right-2 top-2 rounded-full bg-[#d4a52c] px-2 py-0.5 text-[8px] font-bold uppercase text-black">Showcased</div>
                )}
                <div className="p-3">
                  <input
                    value={img.caption}
                    onChange={(e) => void updateCaption(img.id, e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-[#475565] focus:outline-none"
                    placeholder="Add caption..."
                  />
                  <div className="mt-1 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{IMAGE_TYPES.find((t) => t.value === img.image_type)?.label ?? 'Other'}</div>
                </div>
                <div className="flex items-center justify-between border-t border-[#1a1f25] px-3 py-2">
                  <button
                    onClick={() => void toggleFeatured(img)}
                    className={`flex items-center gap-1 text-[9px] font-bold uppercase transition-colors ${img.is_featured ? 'text-[#d4a52c]' : 'text-[#5f6e7c] hover:text-[#d4a52c]'}`}
                  >
                    <Star className={`h-3 w-3 ${img.is_featured ? 'fill-[#d4a52c]' : ''}`} /> {img.is_featured ? 'Showcased' : 'Showcase'}
                  </button>
                  <button onClick={() => void deleteImage(img.id)} className="text-[#5f6e7c] hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Request Verified Badge */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[rgba(8,11,14,0.93)] p-4 shadow-lg">
          <div>
            <div className="text-sm font-semibold text-white">Request Verified Badge</div>
            <div className="text-[10px] text-white/50">Submit your results for manual verification by SpotVault staff</div>
          </div>
          <button className="rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow">
            Request Verification
          </button>
        </div>
      </div>
    </div>
  );
}
