import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronUp, Eye, ImagePlus, Newspaper, Pin, PinOff, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import {
  deleteMainFeedPost, fetchStaffMainFeed, saveMainFeedPost, sanitizeArticleHtml, updateMainFeedOrder, updateMainFeedStatus, uploadMainFeedImage,
  type MainFeedPost, type MainFeedPostType, type MainFeedPublisher, type MainFeedStatus,
} from '@/lib/mainFeed';

const postTypes: { value: MainFeedPostType; label: string }[] = [
  { value: 'news', label: 'News Release' }, { value: 'announcement', label: 'Announcement' }, { value: 'platform_update', label: 'Platform Update' },
  { value: 'community', label: 'Community' }, { value: 'promotion', label: 'Promotion' }, { value: 'feature', label: 'Featured Content' }, { value: 'education', label: 'Education' },
];
const publishers: { value: MainFeedPublisher; label: string }[] = [
  { value: 'spotvault', label: 'SpotVault' }, { value: 'spotvault_news', label: 'SpotVault News' }, { value: 'staff', label: 'Staff member' },
];
const statuses: { value: MainFeedStatus | 'all' | 'pinned'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Drafts' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'pinned', label: 'Pinned' },
];

type FormState = Pick<MainFeedPost, 'title' | 'subtitle' | 'post_type' | 'label' | 'publish_as' | 'feature_image_url' | 'body_html' | 'cta_label' | 'cta_url' | 'status' | 'scheduled_for' | 'pin_until' | 'is_pinned'>;
const emptyForm: FormState = { title: '', subtitle: '', post_type: 'news', label: '', publish_as: 'spotvault', feature_image_url: null, body_html: '<p>Write your article here.</p>', cta_label: '', cta_url: '', status: 'draft', scheduled_for: null, pin_until: null, is_pinned: false };

export function MainFeedSection() {
  const [posts, setPosts] = useState<MainFeedPost[]>([]);
  const [filter, setFilter] = useState<typeof statuses[number]['value']>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MainFeedPost | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const featureInputRef = useRef<HTMLInputElement>(null);
  const articleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPosts(await fetchStaffMainFeed()); } catch { setNotice('Could not load Info posts.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setPreview(false); setComposerOpen(true); };
  const openEdit = (post: MainFeedPost) => {
    setEditing(post);
    setForm({ title: post.title, subtitle: post.subtitle ?? '', post_type: post.post_type, label: post.label ?? '', publish_as: post.publish_as, feature_image_url: post.feature_image_url, body_html: post.body_html, cta_label: post.cta_label ?? '', cta_url: post.cta_url ?? '', status: post.status, scheduled_for: post.scheduled_for, pin_until: post.pin_until, is_pinned: post.is_pinned });
    setPreview(false); setComposerOpen(true);
  };
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const exec = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); setField('body_html', editorRef.current?.innerHTML ?? form.body_html); };

  const uploadFeature = async (file: File) => {
    try { setField('feature_image_url', await uploadMainFeedImage(file, 'feature')); setNotice('Feature image uploaded.'); } catch { setNotice('That image could not be uploaded.'); }
  };
  const uploadInline = async (file: File) => {
    try { const url = await uploadMainFeedImage(file, 'inline'); editorRef.current?.focus(); document.execCommand('insertImage', false, url); setField('body_html', editorRef.current?.innerHTML ?? form.body_html); } catch { setNotice('That article image could not be uploaded.'); }
  };
  const handleSave = async (status: MainFeedStatus) => {
    if (!form.title.trim()) { setNotice('Add a title before saving.'); return; }
    setSaving(true);
    try {
      const body = editorRef.current?.innerHTML ?? form.body_html;
      const scheduledFor = status === 'scheduled' ? (form.scheduled_for || new Date(Date.now() + 86400000).toISOString()) : null;
      await saveMainFeedPost({ ...form, title: form.title.trim(), body_html: body, status, published_at: status === 'published' ? new Date().toISOString() : null, scheduled_for: scheduledFor }, editing?.id);
      setNotice(status === 'published' ? 'Post published.' : status === 'scheduled' ? 'Post scheduled.' : 'Draft saved.');
      setComposerOpen(false); await load();
    } catch { setNotice('Could not save this post.'); } finally { setSaving(false); }
  };
  const changeStatus = async (post: MainFeedPost, status: MainFeedStatus) => {
    try { await updateMainFeedStatus(post.id, status); await load(); } catch { setNotice('Could not update that post.'); }
  };
  const togglePin = async (post: MainFeedPost) => {
    try { await saveMainFeedPost({ ...post, is_pinned: !post.is_pinned }, post.id); await load(); } catch { setNotice('Could not update pinning.'); }
  };
  const remove = async (post: MainFeedPost) => {
    if (!window.confirm('Delete this Info post?')) return;
    try { await deleteMainFeedPost(post.id); await load(); } catch { setNotice('Could not delete that post.'); }
  };
  const movePost = async (post: MainFeedPost, direction: 'up' | 'down') => {
    const index = visible.findIndex((item) => item.id === post.id);
    const target = visible[index + (direction === 'up' ? -1 : 1)];
    if (!target) return;
    try {
      await Promise.all([
        updateMainFeedOrder(post.id, target.sort_order),
        updateMainFeedOrder(target.id, post.sort_order),
      ]);
      await load();
    } catch { setNotice('Could not reorder that post.'); }
  };

  const visible = posts.filter((post) => {
    const matchesFilter = filter === 'all' || (filter === 'pinned' ? post.is_pinned : post.status === filter);
    const query = search.toLowerCase();
    return matchesFilter && (!query || `${post.title} ${post.label ?? ''} ${post.post_type}`.toLowerCase().includes(query));
  });

  if (composerOpen) return <Composer form={form} setField={setField} editing={editing} preview={preview} setPreview={setPreview} editorRef={editorRef} featureInputRef={featureInputRef} articleInputRef={articleInputRef} onUploadFeature={uploadFeature} onUploadInline={uploadInline} onSave={handleSave} saving={saving} onClose={() => setComposerOpen(false)} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/[0.06] bg-black/30 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-[#d4a52c]"><Newspaper className="h-3.5 w-3.5" /> Community editorial</div><h1 className="mt-1 text-xl font-semibold text-white">Info</h1><p className="mt-1 text-[11px] text-white/40">Manage what appears in the SpotVault Community Info feed.</p></div>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#d4a52c]/25"><Plus className="h-3.5 w-3.5" /> Create Post</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${filter === item.value ? 'border-[#d4a52c]/45 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>{item.label}</button>)}
          <label className="ml-auto flex min-w-48 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"><Search className="h-3.5 w-3.5 text-white/30" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Info" className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/25" /></label>
        </div>
        {notice && <div className="mt-3 text-[10px] text-[#f5e6b0]">{notice}</div>}
      </div>
      <div className="flex-1 p-4 sm:p-5">
        {loading ? <div className="py-12 text-center text-[11px] text-white/35">Loading Info…</div> : visible.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-[11px] text-white/35">No posts match this view.</div> : <div className="space-y-2">{visible.map((post, index) => <PostRow key={post.id} post={post} canMoveUp={index > 0} canMoveDown={index < visible.length - 1} onEdit={openEdit} onPreview={() => { openEdit(post); setPreview(true); }} onPin={() => togglePin(post)} onPublish={() => void changeStatus(post, post.status === 'published' ? 'draft' : 'published')} onDelete={() => void remove(post)} onMoveUp={() => void movePost(post, 'up')} onMoveDown={() => void movePost(post, 'down')} />)}</div>}
      </div>
    </div>
  );
}

function PostRow({ post, canMoveUp, canMoveDown, onEdit, onPreview, onPin, onPublish, onDelete, onMoveUp, onMoveDown }: { post: MainFeedPost; canMoveUp: boolean; canMoveDown: boolean; onEdit: (post: MainFeedPost) => void; onPreview: () => void; onPin: () => void; onPublish: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  return <div className="rounded-xl border border-white/[0.08] bg-black/25 p-3 transition hover:border-[#d4a52c]/25"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#d4a52c]"><span>{post.label ?? post.post_type.replace('_', ' ')}</span><span className="text-white/20">·</span><span className={post.status === 'published' ? 'text-emerald-300' : 'text-white/40'}>{post.status}</span>{post.is_pinned && <Pin className="h-3 w-3" />}</div><h2 className="mt-1 truncate text-[13px] font-semibold text-white">{post.title}</h2><div className="mt-1 text-[10px] text-white/35">{post.publish_as.replace('_', ' ')} · {post.published_at ? new Date(post.published_at).toLocaleString() : 'Not published'}</div></div><div className="flex flex-wrap gap-1.5"><button onClick={onMoveUp} disabled={!canMoveUp} className="rounded-md border border-white/10 p-1.5 text-white/45 hover:text-[#f5e6b0] disabled:opacity-20" aria-label="Move post up"><ChevronUp className="h-3.5 w-3.5" /></button><button onClick={onMoveDown} disabled={!canMoveDown} className="rounded-md border border-white/10 p-1.5 text-white/45 hover:text-[#f5e6b0] disabled:opacity-20" aria-label="Move post down"><ChevronDown className="h-3.5 w-3.5" /></button><button onClick={() => onEdit(post)} className="rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-bold uppercase text-white/55 hover:text-white">Edit</button><button onClick={onPreview} className="rounded-md border border-white/10 p-1.5 text-white/45 hover:text-white" aria-label="Preview"><Eye className="h-3.5 w-3.5" /></button><button onClick={onPin} className="rounded-md border border-white/10 p-1.5 text-white/45 hover:text-[#f5e6b0]" aria-label="Pin or unpin">{post.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button><button onClick={onPublish} className="rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-bold uppercase text-white/55 hover:text-white">{post.status === 'published' ? 'Unpublish' : 'Publish'}</button><button onClick={onDelete} className="rounded-md border border-red-300/20 p-1.5 text-red-300/60 hover:text-red-200" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>;
}

function Composer({ form, setField, editing, preview, setPreview, editorRef, featureInputRef, articleInputRef, onUploadFeature, onUploadInline, onSave, saving, onClose }: { form: FormState; setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void; editing: MainFeedPost | null; preview: boolean; setPreview: (value: boolean) => void; editorRef: React.RefObject<HTMLDivElement>; featureInputRef: React.RefObject<HTMLInputElement>; articleInputRef: React.RefObject<HTMLInputElement>; onUploadFeature: (file: File) => void; onUploadInline: (file: File) => void; onSave: (status: MainFeedStatus) => void; saving: boolean; onClose: () => void }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><div><div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#d4a52c]">Info CMS</div><h1 className="mt-1 text-xl font-semibold text-white">{editing ? 'Edit article' : 'Create post'}</h1></div><button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
    <div className="space-y-4">
      <input value={form.title} onChange={(event) => setField('title', event.target.value)} placeholder="Title" className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-3 text-base font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40" />
      <input value={form.subtitle ?? ''} onChange={(event) => setField('subtitle', event.target.value)} placeholder="Subtitle / deck (optional)" className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[12px] text-white/80 outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40" />
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-black/25 p-2">{[['bold', 'B'], ['italic', 'I'], ['formatBlock', 'H2'], ['insertUnorderedList', '• List'], ['insertOrderedList', '1. List'], ['formatBlock', 'Quote']].map(([command, label], index) => <button key={`${command}-${index}`} onClick={() => document.execCommand(command, false, label === 'H2' ? 'h2' : label === 'Quote' ? 'blockquote' : undefined)} className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10">{label}</button>)}<button onClick={() => { const url = window.prompt('Link URL'); if (url) document.execCommand('createLink', false, url); }} className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10">Link</button><button onClick={() => articleInputRef.current?.click()} className="ml-auto rounded border border-[#d4a52c]/30 px-2 py-1 text-[10px] font-bold text-[#f5e6b0] hover:bg-[#d4a52c]/10"><ImagePlus className="mr-1 inline h-3 w-3" />Inline image</button></div>
      {preview ? <div className="article-body min-h-80 rounded-lg border border-white/10 bg-black/25 p-5 text-[13px] leading-[1.8] text-white/75" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(form.body_html) }} /> : <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => setField('body_html', event.currentTarget.innerHTML)} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) onUploadInline(file); }} onDragOver={(event) => event.preventDefault()} dangerouslySetInnerHTML={{ __html: form.body_html }} className="min-h-80 rounded-lg border border-white/10 bg-black/35 p-4 text-[13px] leading-[1.8] text-white/80 outline-none focus:border-[#d4a52c]/40" />}
      <input ref={articleInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadInline(file); event.currentTarget.value = ''; }} />
    </div>
    <div className="space-y-3">
      <select value={form.post_type} onChange={(event) => setField('post_type', event.target.value as MainFeedPostType)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40"><option disabled>Post type</option>{postTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      <select value={form.publish_as} onChange={(event) => setField('publish_as', event.target.value as MainFeedPublisher)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40">{publishers.map((item) => <option key={item.value} value={item.value}>Publish as: {item.label}</option>)}</select>
      <input value={form.label ?? ''} onChange={(event) => setField('label', event.target.value)} placeholder="Label, e.g. PARTNERSHIP" className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40" />
      <div className="rounded-lg border border-dashed border-white/15 bg-black/25 p-3 text-center" onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) onUploadFeature(file); }} onDragOver={(event) => event.preventDefault()}>{form.feature_image_url ? <img src={form.feature_image_url} alt="Feature preview" className="mb-2 max-h-36 w-full rounded object-cover" /> : <ImagePlus className="mx-auto mb-2 h-6 w-6 text-white/25" />}<button onClick={() => featureInputRef.current?.click()} className="text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0]">Upload feature image</button><p className="mt-1 text-[9px] text-white/30">Drag and drop or select an image</p><input ref={featureInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadFeature(file); event.currentTarget.value = ''; }} /></div>
      <input value={form.cta_label ?? ''} onChange={(event) => setField('cta_label', event.target.value)} placeholder="CTA label (optional)" className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40" /><input value={form.cta_url ?? ''} onChange={(event) => setField('cta_url', event.target.value)} placeholder="CTA destination (optional)" className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40" />
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 p-3 text-[10px] text-white/60"><input type="checkbox" checked={form.is_pinned} onChange={(event) => setField('is_pinned', event.target.checked)} /> Pin to top of Info</label>{form.is_pinned && <p className="-mt-2 text-[9px] text-white/30">Leave the optional date empty for no expiration.</p>}
      {form.is_pinned && <input type="datetime-local" value={form.pin_until ? form.pin_until.slice(0, 16) : ''} onChange={(event) => setField('pin_until', event.target.value ? new Date(event.target.value).toISOString() : null)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40" aria-label="Unpin date and time (optional)" />}
      {form.status === 'scheduled' && <input type="datetime-local" value={form.scheduled_for ? form.scheduled_for.slice(0, 16) : ''} onChange={(event) => setField('scheduled_for', event.target.value ? new Date(event.target.value).toISOString() : null)} className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-[10px] text-white/80 outline-none focus:border-[#d4a52c]/40" />}
      <div className="flex flex-wrap gap-2 pt-2"><button onClick={() => setPreview(!preview)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:border-white/25 hover:text-white"><Eye className="h-3.5 w-3.5" />{preview ? 'Edit' : 'Preview'}</button><button disabled={saving} onClick={() => onSave('draft')} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:border-white/25 hover:text-white"><Save className="h-3.5 w-3.5" />Save Draft</button><button disabled={saving} onClick={() => onSave('scheduled')} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:border-white/25 hover:text-white"><CalendarClock className="h-3.5 w-3.5" />Schedule</button><button disabled={saving} onClick={() => onSave('published')} className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#d4a52c]/25"><Check className="h-3.5 w-3.5" />Publish Now</button></div>
    </div>
  </div></div></div>;
}
