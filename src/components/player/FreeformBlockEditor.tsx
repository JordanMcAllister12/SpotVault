import { useRef, useCallback, useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Type, List, ListOrdered, Image as ImageIcon, Lightbulb, Upload, X, Heading, Layers, Search, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { ContentBlock } from '@/lib/contentLab';
import { listManualHands, findManualHand, type ManualHandRecord } from '@/lib/manualHandStore';
import { EmbeddedHandReplayer } from './EmbeddedHandReplayer';
import { renderInlineCardText } from './InlinePlayingCard';
import { EditableTextField } from './EditableTextField';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

let blockIdCounter = 0;
function newBlockId(): string {
  blockIdCounter += 1;
  return `block-${Date.now()}-${blockIdCounter}`;
}

const BLOCK_TYPES: { type: ContentBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'paragraph', label: 'Paragraph', icon: Type },
  { type: 'bullet_list', label: 'Bullet List', icon: List },
  { type: 'numbered_list', label: 'Numbered List', icon: ListOrdered },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'callout', label: 'Key Takeaway', icon: Lightbulb },
  { type: 'hand_replay', label: 'Hand Replay', icon: Layers },
];

interface Props {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onFieldFocus?: (el: HTMLDivElement) => void;
  onFieldSelect?: () => void;
}

export function FreeformBlockEditor({ blocks, onChange, onFieldFocus, onFieldSelect }: Props) {
  const addBlock = useCallback((type: ContentBlock['type']) => {
    const base: ContentBlock = { id: newBlockId(), type };
    if (type === 'heading' || type === 'paragraph') base.text = '';
    if (type === 'bullet_list' || type === 'numbered_list') base.items = [''];
    if (type === 'image') { base.url = ''; base.caption = ''; }
    if (type === 'callout') { base.text = ''; base.variant = 'key_takeaway'; }
    if (type === 'hand_replay') { base.hand_id = ''; }
    onChange([...blocks, base]);
  }, [blocks, onChange]);

  const updateBlock = useCallback((id: string, patch: Partial<ContentBlock>) => {
    onChange(blocks.map((b) => b.id === id ? { ...b, ...patch } : b));
  }, [blocks, onChange]);

  const removeBlock = useCallback((id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  }, [blocks, onChange]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }, [blocks, onChange]);

  return (
    <div className="space-y-3">
      {/* Existing blocks */}
      {blocks.map((block) => (
        <BlockEditor
          key={block.id}
          block={block}
          onChange={(patch) => updateBlock(block.id, patch)}
          onRemove={() => removeBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
          onFieldFocus={onFieldFocus}
          onFieldSelect={onFieldSelect}
        />
      ))}

      {/* Add block bar */}
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-white/10 p-2.5">
        {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => addBlock(type)}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-white/50 transition-all hover:border-[#c0911e]/30 hover:text-[#f5e6b0]"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown, onFieldFocus, onFieldSelect }: {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFieldFocus?: (el: HTMLDivElement) => void;
  onFieldSelect?: () => void;
}) {
  const inputBase = "w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c0911e]/40";

  return (
    <div className="group relative rounded-lg border border-white/[0.06] bg-[rgba(8,10,12,0.6)] p-3">
      {/* Block controls */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onMoveUp} className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:text-white/70">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:text-white/70">
          <ArrowDown className="h-3 w-3" />
        </button>
        <button onClick={onRemove} className="flex h-5 w-5 items-center justify-center rounded text-white/30 hover:text-red-400">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase text-white/30">
          {block.type.replace('_', ' ')}
        </span>
      </div>

      {/* Heading */}
      {block.type === 'heading' && (
        <EditableTextField
          value={block.text || ''}
          onChange={(text) => onChange({ text })}
          placeholder="Section heading..."
          multiline={false}
          onFieldFocus={onFieldFocus}
          onFieldSelect={onFieldSelect}
          className={`${inputBase} text-[14px] font-bold`}
        />
      )}

      {/* Paragraph */}
      {block.type === 'paragraph' && (
        <EditableTextField
          value={block.text || ''}
          onChange={(text) => onChange({ text })}
          placeholder="Write your analysis..."
          multiline
          rows={4}
          onFieldFocus={onFieldFocus}
          onFieldSelect={onFieldSelect}
          className={`${inputBase} leading-relaxed`}
        />
      )}

      {/* Bullet / Numbered list */}
      {(block.type === 'bullet_list' || block.type === 'numbered_list') && (
        <div className="space-y-1.5">
          {(block.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-white/30 text-[12px]">{block.type === 'bullet_list' ? '•' : `${i + 1}.`}</span>
              <EditableTextField
                value={item}
                onChange={(text) => {
                  const items = [...(block.items || [])];
                  items[i] = text;
                  onChange({ items });
                }}
                placeholder="List item..."
                multiline={false}
                onFieldFocus={onFieldFocus}
                onFieldSelect={onFieldSelect}
                className={`${inputBase} flex-1`}
              />
              <button
                onClick={() => {
                  const items = (block.items || []).filter((_, idx) => idx !== i);
                  onChange({ items });
                }}
                className="text-white/20 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange({ items: [...(block.items || []), ''] })}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70"
          >
            <Plus className="h-3 w-3" /> Add item
          </button>
        </div>
      )}

      {/* Image */}
      {block.type === 'image' && (
        <ImageBlockEditor block={block} onChange={onChange} />
      )}

      {/* Callout */}
      {block.type === 'callout' && (
        <div className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Key Takeaway</span>
          </div>
          <EditableTextField
            value={block.text || ''}
            onChange={(text) => onChange({ text })}
            placeholder="The key insight from this section..."
            multiline
            rows={2}
            onFieldFocus={onFieldFocus}
            onFieldSelect={onFieldSelect}
            className={`${inputBase} border-[#c0911e]/20 bg-[#0a0c0e]`}
          />
        </div>
      )}

      {/* Hand Replay */}
      {block.type === 'hand_replay' && (
        <HandReplayBlockEditor block={block} onChange={onChange} />
      )}
    </div>
  );
}

function ImageBlockEditor({ block, onChange }: { block: ContentBlock; onChange: (patch: Partial<ContentBlock>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {block.url ? (
        <div className="relative overflow-hidden rounded-md border border-white/10">
          <img src={block.url} alt={block.caption || ''} className="w-full" />
          <button
            onClick={() => onChange({ url: '', caption: '' })}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/60 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 transition-colors hover:border-[#c0911e]/30"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <Upload className="h-5 w-5 text-white/20" strokeWidth={1.5} />
          <span className="text-[10px] text-white/30">Upload screenshot or image</span>
        </button>
      )}
      <input
        value={block.caption || ''}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Optional caption..."
        className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-1.5 text-[11px] text-white outline-none focus:border-[#c0911e]/40 placeholder:text-white/20"
      />
    </div>
  );
}

function HandReplayBlockEditor({ block, onChange }: { block: ContentBlock; onChange: (patch: Partial<ContentBlock>) => void }) {
  const [hands, setHands] = useState<ManualHandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const records = await listManualHands();
      setHands(records);
      setLoading(false);
    })();
  }, []);

  const filtered = hands.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = h.normalized_hand.title ?? '';
    return title.toLowerCase().includes(q) || h.hand_id.toLowerCase().includes(q);
  });

  const resolvePaste = async () => {
    const val = pasteInput.trim();
    if (!val) return;
    setResolving(true);
    setResolveError(null);
    const found = await findManualHand(val);
    setResolving(false);
    if (found) {
      onChange({ hand_id: found.hand_id });
      setPasteInput('');
      setShowPicker(false);
    } else {
      setResolveError('Hand not found. Check the ID and try again.');
    }
  };

  if (block.hand_id) {
    return (
      <div className="space-y-2">
        <div className="mb-1 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
          <span className="text-[10px] font-bold text-emerald-300/80">Hand attached</span>
          <span className="font-mono text-[9px] text-white/40">{block.hand_id}</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#c0911e]/20 bg-black/30">
          <EmbeddedHandReplayer handId={block.hand_id} />
        </div>
        <button
          onClick={() => onChange({ hand_id: '' })}
          className="text-[10px] text-white/40 hover:text-red-400"
        >
          Remove hand replay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Paste Hand ID input */}
      <div className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-2.5">
        <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/40 uppercase">Paste Hand ID</label>
        <div className="flex gap-1.5">
          <input
            value={pasteInput}
            onChange={(e) => { setPasteInput(e.target.value); setResolveError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void resolvePaste(); } }}
            placeholder="SVH-XXXXXXXX"
            className="flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-white/70 outline-none focus:border-[#c0911e]/40"
          />
          <button
            onClick={() => void resolvePaste()}
            disabled={!pasteInput.trim() || resolving}
            className="flex items-center gap-1 rounded-md border border-[#c091e]/40 bg-[#c091e]/15 px-3 py-1.5 text-[9px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40"
          >
            {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Resolve
          </button>
        </div>
        {resolveError && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-red-300/70">
            <AlertCircle className="h-3 w-3" /> {resolveError}
          </div>
        )}
      </div>

      {showPicker ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#0a0c0e] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hands..."
              className="flex-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#c0911e]/40"
            />
            <button onClick={() => setShowPicker(false)} className="text-white/30 hover:text-white/60">
              <X className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <div className="py-4 text-center text-[10px] text-white/30">Loading hands...</div>
          ) : filtered.length === 0 ? (
            <div className="py-4 text-center text-[10px] text-white/30">
              {hands.length === 0 ? 'No saved hands yet. Build a hand first.' : 'No matches found.'}
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {filtered.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { onChange({ hand_id: h.hand_id }); setShowPicker(false); }}
                  className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-[#c0911e]/30"
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-white/80">
                      {h.normalized_hand.title ?? 'Untitled Hand'}
                    </div>
                    <div className="truncate font-mono text-[9px] text-white/30">{h.hand_id}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-5 transition-colors hover:border-[#c0911e]/30"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <Layers className="h-5 w-5 text-white/20" strokeWidth={1.5} />
          <span className="text-[10px] text-white/30">Select a saved hand to embed</span>
        </button>
      )}
    </div>
  );
}

export function renderFreeformBlocks(blocks: ContentBlock[]): React.ReactNode {
  return blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return block.text ? (
          <h3 key={block.id} className="mt-5 mb-2 text-base font-bold text-white">{renderInlineCardText(block.text)}</h3>
        ) : null;
      case 'paragraph':
        return block.text ? (
          <p key={block.id} className="mb-3 text-[13px] leading-relaxed text-white/70">{renderInlineCardText(block.text)}</p>
        ) : null;
      case 'bullet_list':
        return block.items?.length ? (
          <ul key={block.id} className="mb-3 space-y-1 pl-4">
            {block.items.filter(Boolean).map((item, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-white/70 list-disc">{renderInlineCardText(item)}</li>
            ))}
          </ul>
        ) : null;
      case 'numbered_list':
        return block.items?.length ? (
          <ol key={block.id} className="mb-3 space-y-1 pl-4">
            {block.items.filter(Boolean).map((item, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-white/70 list-decimal">{renderInlineCardText(item)}</li>
            ))}
          </ol>
        ) : null;
      case 'image':
        return block.url ? (
          <figure key={block.id} className="mb-4">
            <img src={block.url} alt={block.caption || ''} className="rounded-lg border border-white/[0.06]" />
            {block.caption && (
              <figcaption className="mt-1.5 text-center text-[10px] text-white/35">{block.caption}</figcaption>
            )}
          </figure>
        ) : null;
      case 'callout':
        return block.text ? (
          <div key={block.id} className="mb-4 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/8 p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Key Takeaway</span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/80">{renderInlineCardText(block.text)}</p>
          </div>
        ) : null;
      case 'hand_replay':
        return block.hand_id ? (
          <div key={block.id} className="mb-4">
            <EmbeddedHandReplayer handId={block.hand_id} />
          </div>
        ) : null;
      default:
        return null;
    }
  });
}
