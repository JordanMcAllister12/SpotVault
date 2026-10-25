import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Type,
  List, ListOrdered, Quote, Code, Undo2, Redo2,
  Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Wrench, Grid3x3, PenLine, Swords, ChevronDown, Upload, Check, Loader2,
  MoreHorizontal, IndentIncrease, IndentDecrease,
} from 'lucide-react';
import { RangeLabExtension } from './tiptapNodes';
import { WrittenResponseExtension } from './tiptapNodes';
import { AiAnswerChallengeExtension } from './tiptapNodes';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

const MEDIA_BUCKET = 'user-uploads';

interface Props {
  documentJson: Record<string, unknown> | null;
  onChange: (json: Record<string, unknown>) => void;
  accountId?: string;
  readOnly?: boolean;
}

// ============================================================
// Dropdown menu — portal-based, auto-positions to stay in viewport
// ============================================================

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  minWidth?: number;
  children: React.ReactNode;
}

function DropdownMenu({ open, onClose, triggerRef, align = 'left', minWidth = 180, children }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const menuW = Math.max(minWidth, 180);
    const menuH = 320; // estimate
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const openUp = spaceBelow < menuH && rect.top > spaceBelow;
    const top = openUp ? rect.top - 4 : rect.bottom + 4;
    // Horizontal: try to align, but keep within viewport
    let left = align === 'right' ? rect.right - menuW : rect.left;
    if (left < 8) left = 8;
    if (left + menuW > vw - 8) left = vw - menuW - 8;
    setPos({ top, left, openUp });
  }, [open, align, minWidth, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e] p-1.5 shadow-2xl"
      style={{
        top: pos.top,
        left: pos.left,
        minWidth,
        maxHeight: pos.openUp ? 'calc(100vh - 8px - ' + pos.top + 'px)' : 'calc(100vh - 8px - ' + pos.top + 'px)',
        overflowY: 'auto',
        maxWidth: 'calc(100vw - 16px)',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

// Menu item helper
function MenuItem({ icon, label, onClick, isActive }: { icon: React.ReactNode; label: string; onClick: () => void; isActive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11px] text-white/70 transition hover:bg-white/5"
      style={isActive ? { background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT } : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-white/[0.06]" />;
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-2 px-2.5 text-[8px] font-bold tracking-widest text-white/30 uppercase first:mt-0">{children}</div>;
}

// ============================================================
// Toolbar dropdown button trigger
// ============================================================

const DropdownButton = ({ label, currentLabel, onClick, open, icon, buttonRef }: { label: string; currentLabel?: string; onClick: () => void; open: boolean; icon?: React.ReactNode; buttonRef?: React.RefObject<HTMLButtonElement | null> }) => {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className="flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors"
      style={{
        borderColor: open ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.08)',
        background: open ? 'rgba(212,165,44,0.1)' : 'transparent',
        color: open ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
      }}
    >
      {icon}
      <span className="max-w-[80px] truncate">{currentLabel || label}</span>
      <ChevronDown className="h-3 w-3 shrink-0" />
    </button>
  );
};

// ============================================================
// Main editor component
// ============================================================

export function DocumentEditor({ documentJson, onChange, accountId, readOnly }: Props) {
  const [openDropdown, setOpenDropdown] = useState<'heading' | 'align' | 'list' | 'tools' | 'more' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const skipNextUpdateRef = useRef(false);

  const headingRef = useRef<HTMLButtonElement>(null);
  const alignRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLButtonElement>(null);
  const toolsRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Start writing your article… Use the Tools button to insert interactive exercises.',
      }),
      RangeLabExtension,
      WrittenResponseExtension,
      AiAnswerChallengeExtension,
    ],
    content: documentJson || undefined,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (skipNextUpdateRef.current) {
        skipNextUpdateRef.current = false;
        return;
      }
      onChange(editor.getJSON());
      setSaveStatus('saving');
    },
    editorProps: {
      attributes: {
        class: 'prose-editor',
        style: 'min-height: 400px; padding: 1.5rem; outline: none; color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.7;',
      },
    },
  });

  // Debounce save status
  useEffect(() => {
    if (saveStatus === 'saving') {
      const t = setTimeout(() => setSaveStatus('saved'), 800);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  // Load content when documentJson changes externally (e.g., switching spots)
  useEffect(() => {
    if (!editor || !documentJson) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(documentJson)) {
      skipNextUpdateRef.current = true;
      editor.commands.setContent(documentJson, false);
    }
  }, [documentJson, editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!accountId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${accountId}/content-lab/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      if (urlData?.publicUrl && editor) {
        editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [accountId, editor]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImageUpload(file);
    e.target.value = '';
  }, [handleImageUpload]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (readOnly) {
    return <EditorContent editor={editor} />;
  }

  const toggleDropdown = (name: typeof openDropdown) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const closeDropdown = () => setOpenDropdown(null);

  const focusAnd = (fn: () => void) => () => { editor.chain().focus(); fn(); closeDropdown(); };

  const toolbarBtn = (icon: React.ReactNode, action: () => void, isActive?: boolean, title?: string) => (
    <button
      onClick={action}
      title={title}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
      style={{
        background: isActive ? 'rgba(212,165,44,0.15)' : 'transparent',
        color: isActive ? GOLD : 'rgba(255,255,255,0.4)',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
    </button>
  );

  // Heading state label
  const headingLabel = editor.isActive('heading', { level: 1 }) ? 'Heading 1'
    : editor.isActive('heading', { level: 2 }) ? 'Heading 2'
    : editor.isActive('heading', { level: 3 }) ? 'Heading 3'
    : 'Normal Text';

  // Alignment state label
  const alignLabel = editor.isActive({ textAlign: 'center' }) ? 'Center'
    : editor.isActive({ textAlign: 'right' }) ? 'Right'
    : editor.isActive({ textAlign: 'justify' }) ? 'Justify'
    : 'Left';

  // List state label
  const listLabel = editor.isActive('orderedList') ? 'Numbered'
    : editor.isActive('bulletList') ? 'Bulleted'
    : 'List';

  return (
    <div className="overflow-hidden rounded-xl border border-[#232a32] bg-[#0a0c0e]">
      {/* Formatting toolbar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-[#232a32] bg-[#0a0c0e] px-2 py-1.5">
        {/* Undo / Redo */}
        {toolbarBtn(<Undo2 className="h-3.5 w-3.5" />, () => editor.chain().focus().undo().run(), false, 'Undo')}
        {toolbarBtn(<Redo2 className="h-3.5 w-3.5" />, () => editor.chain().focus().redo().run(), false, 'Redo')}
        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Heading dropdown */}
        <DropdownButton
          label="Style"
          currentLabel={headingLabel}
          onClick={() => toggleDropdown('heading')}
          open={openDropdown === 'heading'}
          icon={<Type className="h-3.5 w-3.5" />}
          buttonRef={headingRef}
        />
        <div className="hidden sm:block">
          {/* Alignment dropdown — desktop only inline, mobile goes to more menu */}
          <DropdownButton
            label="Align"
            currentLabel={alignLabel}
            onClick={() => toggleDropdown('align')}
            open={openDropdown === 'align'}
            icon={<AlignLeft className="h-3.5 w-3.5" />}
            buttonRef={alignRef}
          />
        </div>
        <div className="hidden sm:block">
          {/* List dropdown — desktop only */}
          <DropdownButton
            label="List"
            currentLabel={listLabel}
            onClick={() => toggleDropdown('list')}
            open={openDropdown === 'list'}
            icon={<List className="h-3.5 w-3.5" />}
            buttonRef={listRef}
          />
        </div>
        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Inline formatting */}
        {toolbarBtn(<Bold className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
        {toolbarBtn(<Italic className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
        {toolbarBtn(<UnderlineIcon className="h-3.5 w-3.5" />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Underline')}
        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Link & Image */}
        {toolbarBtn(<Link2 className="h-3.5 w-3.5" />, () => {
          const url = prompt('Enter URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }, editor.isActive('link'), 'Insert Link')}
        {toolbarBtn(<ImageIcon className="h-3.5 w-3.5" />, () => fileInputRef.current?.click(), false, 'Insert Image')}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {/* Tools menu */}
        <button
          ref={toolsRef}
          onClick={() => toggleDropdown('tools')}
          className="ml-1 flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-all"
          style={{
            borderColor: openDropdown === 'tools' ? 'rgba(212,165,44,0.4)' : 'rgba(212,165,44,0.2)',
            background: openDropdown === 'tools' ? 'rgba(212,165,44,0.12)' : 'rgba(212,165,44,0.06)',
            color: GOLD_SOFT,
          }}
        >
          <Wrench className="h-3.5 w-3.5" />
          Tools
          <ChevronDown className="h-3 w-3" />
        </button>

        {/* More menu — secondary formatting (strike, quote, code, alignment on mobile) */}
        <button
          ref={moreRef}
          onClick={() => toggleDropdown('more')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          title="More formatting"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {/* Save status */}
        <div className="ml-auto flex items-center gap-1.5 pl-2 text-[9px] text-white/30">
          {uploading && <Loader2 className="h-3 w-3 animate-spin" />}
          {saveStatus === 'saved' && <Check className="h-3 w-3 text-emerald-400" />}
          <span>{uploading ? 'Uploading…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : ''}</span>
        </div>
      </div>

      {/* Heading dropdown menu */}
      <DropdownMenu open={openDropdown === 'heading'} onClose={closeDropdown} triggerRef={headingRef} minWidth={160}>
        <MenuItem icon={<Type className="h-3.5 w-3.5" />} label="Normal Text" onClick={focusAnd(() => editor.chain().focus().setParagraph().run())} isActive={!editor.isActive('heading')} />
        <MenuItem icon={<Heading1 className="h-3.5 w-3.5" />} label="Heading 1" onClick={focusAnd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} isActive={editor.isActive('heading', { level: 1 })} />
        <MenuItem icon={<Heading2 className="h-3.5 w-3.5" />} label="Heading 2" onClick={focusAnd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} isActive={editor.isActive('heading', { level: 2 })} />
        <MenuItem icon={<Heading3 className="h-3.5 w-3.5" />} label="Heading 3" onClick={focusAnd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} isActive={editor.isActive('heading', { level: 3 })} />
      </DropdownMenu>

      {/* Alignment dropdown menu */}
      <DropdownMenu open={openDropdown === 'align'} onClose={closeDropdown} triggerRef={alignRef} minWidth={150}>
        <MenuItem icon={<AlignLeft className="h-3.5 w-3.5" />} label="Align Left" onClick={focusAnd(() => editor.chain().focus().setTextAlign('left').run())} isActive={editor.isActive({ textAlign: 'left' })} />
        <MenuItem icon={<AlignCenter className="h-3.5 w-3.5" />} label="Align Center" onClick={focusAnd(() => editor.chain().focus().setTextAlign('center').run())} isActive={editor.isActive({ textAlign: 'center' })} />
        <MenuItem icon={<AlignRight className="h-3.5 w-3.5" />} label="Align Right" onClick={focusAnd(() => editor.chain().focus().setTextAlign('right').run())} isActive={editor.isActive({ textAlign: 'right' })} />
        <MenuItem icon={<AlignJustify className="h-3.5 w-3.5" />} label="Justify" onClick={focusAnd(() => editor.chain().focus().setTextAlign('justify').run())} isActive={editor.isActive({ textAlign: 'justify' })} />
      </DropdownMenu>

      {/* List dropdown menu */}
      <DropdownMenu open={openDropdown === 'list'} onClose={closeDropdown} triggerRef={listRef} minWidth={160}>
        <MenuItem icon={<List className="h-3.5 w-3.5" />} label="Bulleted List" onClick={focusAnd(() => editor.chain().focus().toggleBulletList().run())} isActive={editor.isActive('bulletList')} />
        <MenuItem icon={<ListOrdered className="h-3.5 w-3.5" />} label="Numbered List" onClick={focusAnd(() => editor.chain().focus().toggleOrderedList().run())} isActive={editor.isActive('orderedList')} />
        <MenuDivider />
        <MenuItem icon={<IndentIncrease className="h-3.5 w-3.5" />} label="Indent" onClick={focusAnd(() => editor.chain().focus().sinkListItem('listItem').run())} />
        <MenuItem icon={<IndentDecrease className="h-3.5 w-3.5" />} label="Outdent" onClick={focusAnd(() => editor.chain().focus().liftListItem('listItem').run())} />
      </DropdownMenu>

      {/* Tools dropdown menu — organized into sections */}
      <DropdownMenu open={openDropdown === 'tools'} onClose={closeDropdown} triggerRef={toolsRef} minWidth={240}>
        <MenuLabel>Range &amp; Strategy</MenuLabel>
        <button
          onClick={focusAnd(() => editor.chain().focus().insertRangeLab().run())}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11px] text-white/70 transition hover:bg-white/5"
        >
          <Grid3x3 className="h-3.5 w-3.5" style={{ color: GOLD }} />
          <span>Range Lab</span>
        </button>

        <MenuDivider />

        <MenuLabel>Questions &amp; Exercises</MenuLabel>
        <button
          onClick={focusAnd(() => editor.chain().focus().insertWrittenResponse().run())}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11px] text-white/70 transition hover:bg-white/5"
        >
          <PenLine className="h-3.5 w-3.5" style={{ color: GOLD }} />
          <span>Written Response + Reveal</span>
        </button>
        <button
          onClick={focusAnd(() => editor.chain().focus().insertAiAnswerChallenge().run())}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11px] text-white/70 transition hover:bg-white/5"
        >
          <Swords className="h-3.5 w-3.5" style={{ color: GOLD }} />
          <span>AI Answer Challenge</span>
        </button>
      </DropdownMenu>

      {/* More formatting dropdown — strike, quote, code, alignment (mobile) */}
      <DropdownMenu open={openDropdown === 'more'} onClose={closeDropdown} triggerRef={moreRef} minWidth={180} align="right">
        {/* Mobile-only alignment options */}
        <div className="sm:hidden">
          <MenuLabel>Alignment</MenuLabel>
          <MenuItem icon={<AlignLeft className="h-3.5 w-3.5" />} label="Align Left" onClick={focusAnd(() => editor.chain().focus().setTextAlign('left').run())} isActive={editor.isActive({ textAlign: 'left' })} />
          <MenuItem icon={<AlignCenter className="h-3.5 w-3.5" />} label="Align Center" onClick={focusAnd(() => editor.chain().focus().setTextAlign('center').run())} isActive={editor.isActive({ textAlign: 'center' })} />
          <MenuItem icon={<AlignRight className="h-3.5 w-3.5" />} label="Align Right" onClick={focusAnd(() => editor.chain().focus().setTextAlign('right').run())} isActive={editor.isActive({ textAlign: 'right' })} />
          <MenuItem icon={<AlignJustify className="h-3.5 w-3.5" />} label="Justify" onClick={focusAnd(() => editor.chain().focus().setTextAlign('justify').run())} isActive={editor.isActive({ textAlign: 'justify' })} />
          <MenuDivider />
          <MenuLabel>Lists</MenuLabel>
          <MenuItem icon={<List className="h-3.5 w-3.5" />} label="Bulleted List" onClick={focusAnd(() => editor.chain().focus().toggleBulletList().run())} isActive={editor.isActive('bulletList')} />
          <MenuItem icon={<ListOrdered className="h-3.5 w-3.5" />} label="Numbered List" onClick={focusAnd(() => editor.chain().focus().toggleOrderedList().run())} isActive={editor.isActive('orderedList')} />
          <MenuDivider />
        </div>
        <MenuLabel>Formatting</MenuLabel>
        <MenuItem icon={<Strikethrough className="h-3.5 w-3.5" />} label="Strikethrough" onClick={focusAnd(() => editor.chain().focus().toggleStrike().run())} isActive={editor.isActive('strike')} />
        <MenuItem icon={<Quote className="h-3.5 w-3.5" />} label="Quote Block" onClick={focusAnd(() => editor.chain().focus().toggleBlockquote().run())} isActive={editor.isActive('blockquote')} />
        <MenuItem icon={<Code className="h-3.5 w-3.5" />} label="Code Block" onClick={focusAnd(() => editor.chain().focus().toggleCodeBlock().run())} isActive={editor.isActive('codeBlock')} />
      </DropdownMenu>

      {/* Editor canvas */}
      <div className="max-h-[600px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Read-only renderer for published documents
export function DocumentRenderer({ documentJson }: { documentJson: Record<string, unknown> | null }) {
  if (!documentJson) return null;
  return <DocumentEditor documentJson={documentJson} onChange={() => {}} readOnly />;
}
