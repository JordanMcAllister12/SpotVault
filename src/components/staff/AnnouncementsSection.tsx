import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Megaphone, Edit2, Trash2, Pin, PinOff, Save, X, Loader2,
  AlertCircle, Clock, CheckCircle, RefreshCw, Power,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight,
  Calendar,
} from 'lucide-react';
import {
  fetchAllAnnouncements, saveAnnouncement, deleteAnnouncement, togglePin,
  fetchRotationSettings, saveRotationSettings,
  type StaffAnnouncement, type InfoFeedRotationSettings,
} from '@/lib/announcementsStore';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_DARK = '#c0911e';
const GOLD_SOFT = '#f5e6b0';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';
const MEDIA_BUCKET = 'user-uploads';

const INTERVAL_OPTIONS = [
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 45, label: '45s' },
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
];

export function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<StaffAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pinLoadingId, setPinLoadingId] = useState<string | null>(null);

  // Rotation
  const [rotation, setRotation] = useState<InfoFeedRotationSettings>({ enabled: false, interval_seconds: 30 });
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationSaved, setRotationSaved] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write your announcement…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose-editor',
        style: 'min-height: 320px; padding: 1rem 1.25rem; outline: none; color: rgba(255,255,255,0.85); font-size: 14px; line-height: 1.65;',
      },
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [anns, rot] = await Promise.all([fetchAllAnnouncements(), fetchRotationSettings()]);
      setAnnouncements(anns);
      setRotation(rot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetEditor = useCallback(() => {
    setEditingId(null);
    setTitle('');
    setExpiresAt('');
    setIsPinned(false);
    setFormError('');
    setFormSuccess('');
    if (editor) editor.commands.setContent('');
  }, [editor]);

  const openEdit = useCallback((a: StaffAnnouncement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setExpiresAt(a.expires_at ? a.expires_at.slice(0, 16) : '');
    setIsPinned(a.is_pinned);
    setFormError('');
    setFormSuccess('');
    if (editor) {
      const html = a.body_html ?? '';
      editor.commands.setContent(html || '<p></p>');
    }
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? 'staff';
      const ext = file.name.split('.').pop() || 'png';
      const path = `${uid}/announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      if (urlData?.publicUrl && editor) {
        editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      }
    } catch {
      setFormError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImageUpload(file);
    e.target.value = '';
  };

  const handlePublish = async () => {
    if (!title.trim()) { setFormError('Title is required.'); return; }
    if (!editor || editor.getText().trim().length === 0) { setFormError('Announcement content cannot be empty.'); return; }
    setSaving(true);
    setFormError('');
    setFormSuccess('');
    try {
      const html = editor.getHTML();
      await saveAnnouncement({
        id: editingId ?? undefined,
        title: title.trim(),
        body_html: html,
        image_url: null,
        status: 'published',
        is_pinned: isPinned,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        published_at: editingId ? undefined : undefined,
      });
      setFormSuccess(editingId ? 'Announcement updated.' : 'Announcement published.');
      resetEditor();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(deleteId);
      setDeleteId(null);
      if (editingId === deleteId) resetEditor();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement.');
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (a: StaffAnnouncement) => {
    setPinLoadingId(a.id);
    try {
      await togglePin(a.id, !a.is_pinned);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle pin.');
    } finally {
      setPinLoadingId(null);
    }
  };

  const handleRotationToggle = async () => {
    const next = { ...rotation, enabled: !rotation.enabled };
    setRotation(next);
    setRotationLoading(true);
    setRotationSaved(false);
    try {
      await saveRotationSettings(next);
      setRotationSaved(true);
      setTimeout(() => setRotationSaved(false), 2000);
    } catch {
      setRotation({ ...rotation });
    } finally {
      setRotationLoading(false);
    }
  };

  const handleIntervalChange = async (seconds: number) => {
    const next = { ...rotation, interval_seconds: seconds };
    setRotation(next);
    setRotationLoading(true);
    setRotationSaved(false);
    try {
      await saveRotationSettings(next);
      setRotationSaved(true);
      setTimeout(() => setRotationSaved(false), 2000);
    } catch {
      setRotation({ ...rotation });
    } finally {
      setRotationLoading(false);
    }
  };

  const deleteTarget = announcements.find((a) => a.id === deleteId) ?? null;
  const isEditing = editingId !== null;

  const tb = (icon: React.ReactNode, action: () => void, isActive?: boolean, title?: string) => (
    <button
      onClick={action}
      title={title}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
      style={{ background: isActive ? 'rgba(212,165,44,0.15)' : 'transparent', color: isActive ? GOLD : 'rgba(255,255,255,0.4)' }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
      <div className="mx-auto w-full max-w-[900px] space-y-4 p-4 sm:p-5">
        {/* Page header */}
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">Announcements</h2>
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase" style={{ background: GOLD + '20', color: GOLD_SOFT }}>
            {announcements.length} Total
          </span>
        </div>

        {/* Editor section */}
        <div ref={editorRef} className="overflow-hidden rounded-lg border" style={{ borderColor: PANEL_BORDER, background: 'rgba(10,12,14,0.50)' }}>
          {/* Editor header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">
              {isEditing ? 'Edit Announcement' : 'New Announcement'}
            </span>
            {isEditing && (
              <button onClick={resetEditor} className="text-[9px] font-bold tracking-widest text-white/40 uppercase transition hover:text-white">Cancel Edit</button>
            )}
          </div>

          {/* Title input */}
          <div className="px-4 pt-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title…"
              className="w-full rounded-md border border-white/10 bg-[#0a0c0e]/30 px-3 py-2 text-[13px] font-semibold text-white placeholder:text-white/25 focus:border-[#d4a52c]/30 focus:outline-none"
            />
          </div>

          {/* Formatting toolbar */}
          {editor && (
            <div className="flex flex-wrap items-center gap-0.5 border-b border-white/[0.04] px-3 py-1.5">
              {tb(<Bold className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
              {tb(<Italic className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
              {tb(<UnderlineIcon className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline')}
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />
              {tb(<List className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet list')}
              {tb(<ListOrdered className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />
              {tb(<Link2 className="h-3.5 w-3.5" />, () => {
                const url = window.prompt('Enter URL:');
                if (url) editor.chain().focus().setLink({ href: url }).run();
              }, editor.isActive('link'), 'Insert link')}
              {tb(<ImageIcon className="h-3.5 w-3.5" />, () => fileInputRef.current?.click(), false, 'Insert image')}
              <div className="mx-1 h-4 w-px bg-white/[0.08]" />
              {tb(<AlignLeft className="h-3.5 w-3.5" />, () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), 'Align left')}
              {tb(<AlignCenter className="h-3.5 w-3.5" />, () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), 'Align center')}
              {tb(<AlignRight className="h-3.5 w-3.5" />, () => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }), 'Align right')}
              {uploading && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" style={{ color: GOLD }} />}
            </div>
          )}

          {/* Editor canvas */}
          <div className="border-b border-white/[0.04]" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <EditorContent editor={editor} />
          </div>

          {/* Compact control row */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/40 uppercase">
              <Calendar className="h-3 w-3" /> Expires
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded border border-white/10 bg-[#0a0c0e]/30 px-2 py-1 text-[10px] font-normal normal-case tracking-normal text-white/70 focus:border-[#d4a52c]/30 focus:outline-none"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/40 uppercase">
              <Pin className="h-3 w-3" /> Pin
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#d4a52c]"
              />
            </label>
            <div className="flex-1" />
            <button
              onClick={handlePublish}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: GOLD_DARK + '60', background: GOLD + '20', color: GOLD_SOFT }}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              {isEditing ? 'Save Changes' : 'Publish'}
            </button>
          </div>

          {/* Error / success */}
          {formError && (
            <div className="flex items-center gap-2 border-t border-red-500/15 bg-red-500/5 px-4 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-[11px] text-red-300">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="flex items-center gap-2 border-t border-green-500/15 bg-green-500/5 px-4 py-2">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
              <p className="text-[11px] text-green-300">{formSuccess}</p>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        {/* Rotation controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-[#0a0c0e]/30 px-4 py-2.5">
          <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Info Feed Rotation</span>
          <button
            onClick={handleRotationToggle}
            disabled={rotationLoading}
            className="flex items-center gap-1.5 rounded border px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase transition-all disabled:opacity-50"
            style={{
              borderColor: rotation.enabled ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)',
              background: rotation.enabled ? 'rgba(74,222,128,0.08)' : 'transparent',
              color: rotation.enabled ? '#4ade80' : 'rgba(255,255,255,0.4)',
            }}
          >
            {rotationLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Power className="h-2.5 w-2.5" />}
            {rotation.enabled ? 'On' : 'Off'}
          </button>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Interval</span>
            {INTERVAL_OPTIONS.map((opt) => {
              const active = rotation.interval_seconds === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleIntervalChange(opt.value)}
                  disabled={rotationLoading}
                  className={`rounded border px-1.5 py-1 text-[9px] font-bold transition-all disabled:opacity-50 ${active ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/[0.06] text-white/35 hover:text-white/60'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {rotationSaved && <span className="flex items-center gap-1 text-[9px] font-bold text-green-400"><CheckCircle className="h-2.5 w-2.5" /> Saved</span>}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            <div>
              <p className="text-[10px] text-red-300">{error}</p>
              <button onClick={load} className="mt-1 text-[9px] text-red-400 underline">Try again</button>
            </div>
          </div>
        )}

        {/* Management table */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: PANEL_BORDER, background: 'rgba(10,12,14,0.50)' }}>
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">Existing Announcements</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Megaphone className="h-6 w-6 text-white/15" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-white/40">No announcements yet. Write one above and click Publish.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              <div className="flex items-center gap-3 px-4 py-2 text-[8px] font-bold tracking-widest text-white/25 uppercase">
                <span className="min-w-0 flex-1">Title</span>
                <span className="hidden w-28 shrink-0 sm:block">Published</span>
                <span className="hidden w-28 shrink-0 sm:block">Expires</span>
                <span className="w-20 shrink-0 text-right">Actions</span>
              </div>
              {announcements.map((a) => {
                const pubDate = a.published_at ? new Date(a.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
                const expDate = a.expires_at ? new Date(a.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
                const isExpired = a.expires_at && new Date(a.expires_at) < new Date();
                return (
                  <div key={a.id} className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/[0.015] ${editingId === a.id ? 'bg-[#d4a52c]/[0.04]' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[11px] font-semibold text-white/85">{a.title || 'Untitled'}</p>
                        {a.is_pinned && <Pin className="h-2.5 w-2.5 shrink-0" style={{ color: GOLD }} />}
                        {isExpired && <span className="shrink-0 text-[7px] font-bold tracking-widest uppercase text-red-400/60">Expired</span>}
                      </div>
                    </div>
                    <span className="hidden w-28 shrink-0 text-[10px] text-white/35 sm:block">{pubDate}</span>
                    <span className={`hidden w-28 shrink-0 text-[10px] sm:block ${isExpired ? 'text-red-400/50' : 'text-white/35'}`}>{expDate}</span>
                    <div className="flex w-20 shrink-0 items-center justify-end gap-1">
                      <button onClick={() => handleTogglePin(a)} disabled={pinLoadingId === a.id} title={a.is_pinned ? 'Unpin' : 'Pin'} className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 transition hover:text-white disabled:opacity-50">
                        {pinLoadingId === a.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : a.is_pinned ? <PinOff className="h-2.5 w-2.5" style={{ color: GOLD }} /> : <Pin className="h-2.5 w-2.5" />}
                      </button>
                      <button onClick={() => openEdit(a)} title="Edit" className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 transition hover:text-white">
                        <Edit2 className="h-2.5 w-2.5" />
                      </button>
                      <button onClick={() => setDeleteId(a.id)} title="Delete" className="flex h-6 w-6 items-center justify-center rounded border border-red-500/20 bg-red-500/5 text-red-400/60 transition hover:text-red-300">
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !deleting && setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-xl border p-5" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.96)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <Trash2 className="h-4 w-4 text-red-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-bold text-white">Delete announcement?</h3>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-white/60">
              This will permanently remove <span className="mx-1 font-semibold text-white/90">"{deleteTarget.title}"</span> from the Info Feed. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/70 uppercase transition hover:text-white disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-500/25 disabled:opacity-50">
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
