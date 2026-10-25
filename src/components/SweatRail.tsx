import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Flame, Plus, X, Trophy,
  Users, Star, Circle, Pencil, Check, Square, Send, ChevronDown,
} from 'lucide-react';
import {
  useSweatStore, postSweat, updateSweat, endSweat, deleteSweat,
  type Sweat, type SweatCategory,
} from '@/lib/sweatStore';
import { UserIdentityHoverCard } from '@/components/community/UserIdentityHoverCard';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { hubGlassNav, hubGlassCard } from '@/components/shared/hubGlass';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const MAX_VISIBLE = 4;

const SITES = ['GG', 'PokerStars', 'WPT Global', 'CoinPoker', 'WSOP Online', 'Other'];

interface SweatRailProps {
  isActive: boolean;
  onActivate: () => void;
}

export function SweatRail({ isActive, onActivate }: SweatRailProps) {
  const [tab, setTab] = useState<SweatCategory>('friends');
  const [showForm, setShowForm] = useState(false);
  const [expandedSweat, setExpandedSweat] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState('');
  const [editComment, setEditComment] = useState('');
  const [showAll, setShowAll] = useState(false);

  const { sweats: rawSweats } = useSweatStore();
  const sweats = Array.isArray(rawSweats) ? rawSweats : [];

  const liveSweats = sweats.filter((s) => s.status === 'live' && s.category === tab);
  const activeCount = liveSweats.length;
  const visibleSweats = showAll ? liveSweats : liveSweats.slice(0, MAX_VISIBLE);

  const handleInteraction = useCallback(() => {
    onActivate();
  }, [onActivate]);

  const handleEndSweat = (id: string) => {
    endSweat(id);
    handleInteraction();
  };

  const handleDeleteSweat = (id: string) => {
    deleteSweat(id);
    handleInteraction();
  };

  const startEdit = (sweat: Sweat) => {
    setEditingId(sweat.id);
    setEditPosition(sweat.position);
    setEditComment(sweat.comment ?? '');
  };

  const saveEdit = () => {
    if (editingId) {
      updateSweat(editingId, editPosition, editComment);
    }
    setEditingId(null);
    handleInteraction();
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onMouseDown={onActivate}
      onTouchStart={onActivate}
    >
      {/* Header + selector in compact glass nav */}
      <div className="shrink-0 px-2.5 pt-2 pb-1.5" style={hubGlassNav}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-md border"
              style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}
            >
              <Flame className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-bold tracking-wide text-white">SWEAT RAIL</span>
            {activeCount > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                {activeCount} LIVE
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowForm((v) => !v); handleInteraction(); }}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.08] bg-black/30 text-white/40 transition-colors hover:text-[#d4a52c]"
            title="Post a sweat"
            aria-label="Post a sweat"
          >
            {showForm ? <X className="h-3 w-3" strokeWidth={1.5} /> : <Plus className="h-3 w-3" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-1.5 flex gap-1">
          <SweatTab
            label="FOLLOWING"
            icon={Users}
            active={tab === 'friends'}
            onClick={() => { setTab('friends'); handleInteraction(); }}
          />
          <SweatTab
            label="NOTABLES"
            icon={Star}
            active={tab === 'notables'}
            onClick={() => { setTab('notables'); handleInteraction(); }}
          />
        </div>
      </div>

      {/* Inline submission panel */}
      {showForm && (
        <SweatFormInline
          onClose={() => setShowForm(false)}
          onPost={(site, tournament, table, position, stack, comment, category) => {
            postSweat(site, tournament, table, position, stack, comment, category);
            setShowForm(false);
            setTab(category);
            handleInteraction();
          }}
          defaultCategory={tab}
        />
      )}

      {/* Body — compact vertical listing, up to 4 visible */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {activeCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.06)' }}
            >
              <Flame className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <p className="mt-2 text-[9px] font-medium text-white/50">No active sweats.</p>
            <p className="mt-0.5 text-[8px] text-white/30">Post "I'm Deep" to share a run.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {visibleSweats.map((sweat) => (
                <CompactSweatCard
                  key={sweat.id}
                  sweat={sweat}
                  expanded={expandedSweat === sweat.id}
                  onExpand={() => { setExpandedSweat(expandedSweat === sweat.id ? null : sweat.id); handleInteraction(); }}
                  onEdit={() => startEdit(sweat)}
                  onEnd={() => handleEndSweat(sweat.id)}
                  onDelete={() => handleDeleteSweat(sweat.id)}
                  editing={editingId === sweat.id}
                  editPosition={editPosition}
                  editComment={editComment}
                  onEditPosition={setEditPosition}
                  onEditComment={setEditComment}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </div>

            {/* Empty slots placeholder */}
            {activeCount < MAX_VISIBLE && activeCount > 0 && (
              <div className="mt-1.5 space-y-1">
                {Array.from({ length: MAX_VISIBLE - activeCount }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-dashed py-2.5 text-center"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <span className="text-[7px] text-white/15">Empty slot</span>
                  </div>
                ))}
              </div>
            )}

            {/* View All toggle */}
            {activeCount > MAX_VISIBLE && (
              <button
                onClick={() => { setShowAll((v) => !v); handleInteraction(); }}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-white/[0.06] py-1 text-[8px] font-semibold tracking-wide text-white/40 transition-colors hover:text-white/70"
              >
                {showAll ? 'Show Less' : `View All (${activeCount})`}
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showAll ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SweatTab({
  label, icon: Icon, active, onClick,
}: {
  label: string;
  icon: typeof Users;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[8px] font-bold tracking-wide transition-all"
      style={{
        background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
        color: active ? GOLD_SOFT : 'rgba(255,255,255,0.35)',
        border: active ? `1px solid ${BORDER}` : '1px solid transparent',
      }}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={1.5} />
      {label}
    </button>
  );
}

function CompactSweatCard({
  sweat, expanded, onExpand, onEdit, onEnd, onDelete,
  editing, editPosition, editComment, onEditPosition, onEditComment, onSaveEdit, onCancelEdit,
}: {
  sweat: Sweat;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onEnd: () => void;
  onDelete: () => void;
  editing: boolean;
  editPosition: string;
  editComment: string;
  onEditPosition: (v: string) => void;
  onEditComment: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-2"
      style={hubGlassCard}
    >
      {/* Author + live status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full border text-[7px] font-bold text-white/80"
            style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}
          >
            {sweat.authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <UserIdentityHoverCard userId={sweat.authorId} fallbackName={sweat.authorName}>
            <span className="text-[10px] font-bold text-white">{sweat.authorName}</span>
          </UserIdentityHoverCard>
          <UserIdentityFlag userId={sweat.authorId} fallbackName={sweat.authorName} size="sm" />
        </div>
        <span
          className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[6px] font-bold"
          style={{
            background: sweat.status === 'live' ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.12)',
            color: sweat.status === 'live' ? '#34d399' : '#94a3b8',
          }}
        >
          <Circle
            className="h-1 w-1"
            style={{ fill: sweat.status === 'live' ? '#34d399' : '#94a3b8', color: sweat.status === 'live' ? '#34d399' : '#94a3b8' }}
            strokeWidth={0}
          />
          {sweat.status === 'live' ? 'LIVE' : 'ENDED'}
        </span>
      </div>

      {/* Site + tournament */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="inline-block rounded px-1 py-0.5 text-[7px] font-bold tracking-wide"
          style={{ background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
        >
          {sweat.site}
        </span>
        <span className="truncate text-[9px] font-semibold text-white/90">{sweat.tournament}</span>
      </div>

      {/* Stats */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-white/50">
        <span className="font-mono">{sweat.position}</span>
        <span className="text-white/15">·</span>
        <span>{sweat.table}</span>
        {sweat.stack && (
          <>
            <span className="text-white/15">·</span>
            <span style={{ color: GOLD }}>{sweat.stack}</span>
          </>
        )}
      </div>

      {/* Comment preview */}
      {sweat.comment && !expanded && (
        <p className="mt-1 truncate text-[8px] italic text-white/40">"{sweat.comment}"</p>
      )}

      {editing ? (
        <div className="mt-1.5 space-y-1">
          <input
            value={editPosition}
            onChange={(e) => onEditPosition(e.target.value)}
            placeholder="Position (e.g. 1 / 18)"
            className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[9px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
          />
          <textarea
            value={editComment}
            onChange={(e) => onEditComment(e.target.value)}
            placeholder="Update comment..."
            maxLength={140}
            rows={2}
            className="w-full resize-none rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[9px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
          />
          <div className="flex gap-1">
            <button
              onClick={onSaveEdit}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1 text-[8px] font-bold transition-colors"
              style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={1.5} /> Save
            </button>
            <button
              onClick={onCancelEdit}
              className="flex items-center justify-center rounded-md border border-white/[0.08] px-2 py-1 text-[8px] font-bold text-white/50"
            >
              <X className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Actions */}
          <div className="mt-1.5 flex items-center gap-1">
            <button
              onClick={onExpand}
              className="flex-1 rounded-md border py-0.5 text-[8px] font-bold tracking-wide transition-colors"
              style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            >
              {expanded ? 'HIDE' : 'DETAILS'}
            </button>
            <button onClick={onEdit} className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition-colors hover:text-white/70" title="Update" aria-label="Update sweat">
              <Pencil className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
            <button onClick={onEnd} className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition-colors hover:text-red-400/70" title="End sweat" aria-label="End sweat">
              <Square className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
            <button onClick={onDelete} className="flex h-5 w-5 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition-colors hover:text-red-400/70" title="Delete sweat" aria-label="Delete sweat">
              <X className="h-2.5 w-2.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-1.5 space-y-0.5 border-t border-white/[0.06] pt-1.5">
              <DetailRow label="Site" value={sweat.site} />
              <DetailRow label="Tournament" value={sweat.tournament} />
              <DetailRow label="Table" value={sweat.table} />
              <DetailRow label="Position" value={sweat.position} />
              {sweat.stack && <DetailRow label="Stack" value={sweat.stack} />}
              <DetailRow label="Posted" value={timeAgo(sweat.createdAt)} />
              <DetailRow label="Updated" value={timeAgo(sweat.updatedAt)} />
              {sweat.comment && (
                <p className="mt-1 text-[9px] italic leading-relaxed text-white/60">"{sweat.comment}"</p>
              )}
            </div>
          )}

          {/* Messaging composer */}
          {expanded && (
            <SweatMessages sweatId={sweat.id} authorName={sweat.authorName} />
          )}
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[7px] font-mono tracking-wider text-white/25 uppercase">{label}</span>
      <span className="text-[8px] text-white/60">{value}</span>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function SweatFormInline({
  onClose, onPost, defaultCategory,
}: {
  onClose: () => void;
  onPost: (site: string, tournament: string, table: string, position: string, stack: string, comment: string, category: SweatCategory) => void;
  defaultCategory: SweatCategory;
}) {
  const [site, setSite] = useState(SITES[0]);
  const [customSite, setCustomSite] = useState('');
  const [tournament, setTournament] = useState('');
  const [table, setTable] = useState('');
  const [position, setPosition] = useState('');
  const [stack, setStack] = useState('');
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState<SweatCategory>(defaultCategory);

  const finalSite = site === 'Other' ? customSite.trim() || 'Other' : site;
  const canPost = tournament.trim() && table.trim() && position.trim();

  const handleSubmit = () => {
    if (!canPost) return;
    onPost(finalSite, tournament.trim(), table.trim(), position.trim(), stack.trim(), comment.trim(), category);
  };

  return (
    <div
      className="shrink-0 px-2.5 pb-2 pt-1.5"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className="rounded-xl border p-2.5"
        style={{
          ...hubGlassCard,
          borderColor: BORDER,
        }}
      >
        {/* Header row */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[10px] font-bold tracking-wide text-white">I'M DEEP</span>
          </div>
          <button onClick={onClose} className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 hover:text-white" aria-label="Close form">
            <X className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="mb-2 flex gap-1">
          <SweatTab label="FOLLOWING" icon={Users} active={category === 'friends'} onClick={() => setCategory('friends')} />
          <SweatTab label="NOTABLES" icon={Star} active={category === 'notables'} onClick={() => setCategory('notables')} />
        </div>

        {/* Compact two-row composer grid */}
        <div className="space-y-1.5">
          {/* Row 1: Site | Tournament */}
          <div className="flex gap-1.5">
            <div className="min-w-[90px] flex-1">
              <label className="mb-0.5 block text-[7px] font-mono tracking-wider text-white/30 uppercase">Site</label>
              <select
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="w-full rounded-md border border-white/[0.08] bg-black/40 px-1.5 py-1 text-[9px] text-white outline-none focus:border-[#c0911e]/35"
                style={{ appearance: 'none', backgroundImage: 'none' }}
              >
                {SITES.map((s) => (
                  <option key={s} value={s} className="bg-[#0a0908] text-white">{s}</option>
                ))}
              </select>
              {site === 'Other' && (
                <input
                  value={customSite}
                  onChange={(e) => setCustomSite(e.target.value)}
                  placeholder="Site name..."
                  className="mt-1 w-full rounded-md border border-white/[0.08] bg-black/40 px-1.5 py-1 text-[9px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
                />
              )}
            </div>
            <div className="min-w-0 flex-[2]">
              <FormField label="Tournament" value={tournament} onChange={setTournament} placeholder="$525 Bounty HR" />
            </div>
          </div>

          {/* Row 2: Stack | Comment | Post */}
          <div className="flex flex-wrap gap-1.5">
            <div className="min-w-[70px] flex-1">
              <FormField label="Stack" value={stack} onChange={setStack} placeholder="42 BB" />
            </div>
            <div className="min-w-[100px] flex-[2]">
              <FormField label="Comment" value={comment} onChange={setComment} placeholder="Final 3 tables…" />
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={handleSubmit}
                disabled={!canPost}
                className="flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-wide transition-all disabled:opacity-30"
                style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
              >
                <Send className="h-2.5 w-2.5" strokeWidth={1.5} /> POST
              </button>
            </div>
          </div>

          {/* Hidden fields — Table and Position are less important for quick posts */}
          <div className="flex gap-1.5">
            <div className="min-w-[70px] flex-1">
              <FormField label="Table" value={table} onChange={setTable} placeholder="Table 17" />
            </div>
            <div className="min-w-[70px] flex-1">
              <FormField label="Position" value={position} onChange={setPosition} placeholder="8 / 143" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[7px] font-mono tracking-wider text-white/30 uppercase">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-[9px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
      />
    </div>
  );
}

interface SweatMessage {
  id: string;
  text: string;
  author: string;
  ts: number;
}

function SweatMessages({ sweatId, authorName }: { sweatId: string; authorName: string }) {
  const [messages, setMessages] = useState<SweatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(`sweat-msgs-${sweatId}`);
      return stored ? JSON.parse(stored) as SweatMessage[] : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(`sweat-msgs-${sweatId}`, JSON.stringify(messages));
    } catch { /* ignore quota errors */ }
  }, [messages, sweatId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: `${Date.now()}`, text: trimmed, author: 'You', ts: Date.now() }]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
      <p className="mb-1 text-[7px] font-mono tracking-[0.15em] text-white/25 uppercase">Messages</p>
      {messages.length > 0 && (
        <div ref={listRef} className="mb-1.5 max-h-20 space-y-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {messages.map((m) => (
            <div key={m.id} className="flex gap-1">
              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#c0911e]/15 text-[6px] font-bold text-[#f5e6b0]">
                {m.author === 'You' ? 'Y' : m.author.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-[8px] font-bold text-white/70">{m.author}</span>
                  <span className="text-[6px] text-white/25">{timeAgo(m.ts)}</span>
                </div>
                <p className="break-words text-[8px] leading-relaxed text-white/55">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {messages.length === 0 && (
        <p className="mb-1.5 text-[7px] text-white/20">No messages yet. Start the conversation.</p>
      )}
      <div className="flex items-end gap-1">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="min-h-[20px] flex-1 resize-none rounded-md border border-white/[0.08] bg-black/30 px-1.5 py-0.5 text-[8px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-white/40 transition-colors hover:text-[#d4a52c] disabled:opacity-30"
          aria-label="Send message"
        >
          <Send className="h-2.5 w-2.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
