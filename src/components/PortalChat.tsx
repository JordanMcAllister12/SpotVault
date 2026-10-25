import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Hash,
  Users,
  Plus,
  Search,
  Send,
  Paperclip,
  Smile,
  Phone,
  UserCircle,
  X,
  Check,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import type { HubId } from '@/types';

export type PortalType = HubId;

export interface PortalMember {
  id: string;
  name: string;
  role: string;
  online: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  body: string;
  timestamp: string;
}

export interface ChannelDef {
  id: string;
  name: string;
  description: string;
}

interface ConversationState {
  type: 'channel' | 'dm';
  id: string;
}

interface Props {
  portalType: PortalType;
  portalLabel: string;
  members: PortalMember[];
  channels: ChannelDef[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

const floatStyle: React.CSSProperties = {
  background: 'rgba(10, 12, 14, 0.62)',
  border: '1px solid rgba(192, 145, 30, 0.18)',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.22)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};

const GOLD = '#d4a52c';
const GOLD_SOFT = 'rgba(192, 145, 30, 0.12)';
const GOLD_BORDER = 'rgba(192, 145, 30, 0.25)';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

function nowTime() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function PortalChat({
  portalType,
  portalLabel,
  members,
  channels,
  currentUserId,
  currentUserName,
  currentUserRole,
}: Props) {
  const [active, setActive] = useState<ConversationState>({ type: 'channel', id: channels[0]?.id ?? 'general' });
  const [dmConversations, setDmConversations] = useState<Record<string, ChatMessage[]>>({});
  const [channelMessages, setChannelMessages] = useState<Record<string, ChatMessage[]>>(() => {
    const seed: Record<string, ChatMessage[]> = {};
    channels.forEach((ch) => {
      seed[ch.id] = seedChannelMessages(ch.id, members, currentUserName, currentUserRole);
    });
    return seed;
  });
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [active, channelMessages, dmConversations]);

  const openChannel = (id: string) => {
    setActive({ type: 'channel', id });
    setUnread((u) => ({ ...u, [id]: 0 }));
  };

  const openDM = (memberId: string) => {
    if (!dmConversations[memberId]) {
      setDmConversations((prev) => ({ ...prev, [memberId]: [] }));
    }
    setActive({ type: 'dm', id: memberId });
    setUnread((u) => ({ ...u, [`dm-${memberId}`]: 0 }));
    setMemberMenu(null);
    setNewMessageOpen(false);
  };

  const sendMessage = () => {
    if (!draft.trim()) return;
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      authorId: currentUserId,
      authorName: currentUserName,
      authorRole: currentUserRole,
      body: draft.trim(),
      timestamp: nowTime(),
    };
    if (active.type === 'channel') {
      setChannelMessages((prev) => ({
        ...prev,
        [active.id]: [...(prev[active.id] ?? []), msg],
      }));
    } else {
      setDmConversations((prev) => ({
        ...prev,
        [active.id]: [...(prev[active.id] ?? []), msg],
      }));
    }
    setDraft('');
  };

  const activeChannel = channels.find((c) => c.id === active.id);
  const activeDMMember = members.find((m) => m.id === active.id);

  const messages =
    active.type === 'channel'
      ? channelMessages[active.id] ?? []
      : dmConversations[active.id] ?? [];

  const headerTitle =
    active.type === 'channel'
      ? `# ${activeChannel?.name ?? 'general'}`
      : activeDMMember?.name ?? 'Direct Message';

  const headerSubtitle =
    active.type === 'channel'
      ? activeChannel?.description ?? ''
      : activeDMMember
        ? `${activeDMMember.role} · ${activeDMMember.online ? 'Online' : 'Offline'}`
        : '';

  const dmMembers = members.filter((m) => m.id !== currentUserId);
  const filteredMembers = memberSearch
    ? dmMembers.filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : dmMembers;

  return (
    <div className="flex h-full w-full flex-col gap-3 p-1">
      {/* ===== Three-column workspace — all transparent, individual panels float ===== */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* ===== LEFT: Channels + DMs ===== */}
        <aside className="hidden w-64 shrink-0 flex-col gap-3 md:flex">
          {/* Community channels */}
          <div className="flex flex-col gap-1 p-3" style={floatStyle}>
            <div className="mb-2 flex items-center gap-2">
              <Hash className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>{portalLabel} Community</span>
            </div>
            {channels.map((ch) => {
              const isActive = active.type === 'channel' && active.id === ch.id;
              const count = unread[ch.id] ?? 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => openChannel(ch.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all"
                  style={{
                    background: isActive ? GOLD_SOFT : 'transparent',
                    border: isActive ? `1px solid ${GOLD_BORDER}` : '1px solid transparent',
                    color: isActive ? '#f5e6b0' : '#84929f',
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#c7cfd8'; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#84929f'; } }}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} style={{ color: isActive ? GOLD : '#5f6e7c' }} />
                  <span className="flex-1 truncate text-xs font-medium">{ch.name}</span>
                  {count > 0 && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: GOLD_SOFT, color: GOLD }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Direct Messages */}
          <div className="flex flex-col gap-1 p-3" style={floatStyle}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>Direct Messages</span>
              </div>
              <button
                onClick={() => setNewMessageOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded-md border transition-all"
                style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: GOLD }}
                title="New Message"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
            {dmMembers.map((m) => {
              const isActive = active.type === 'dm' && active.id === m.id;
              const key = `dm-${m.id}`;
              const count = unread[key] ?? 0;
              return (
                <button
                  key={m.id}
                  onClick={() => openDM(m.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all"
                  style={{
                    background: isActive ? GOLD_SOFT : 'transparent',
                    color: isActive ? '#f5e6b0' : '#84929f',
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#c7cfd8'; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#84929f'; } }}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border text-[8px] font-semibold"
                      style={{ borderColor: GOLD_BORDER, background: 'rgba(20,22,24,0.6)', color: '#c7cfd8' }}>
                      {initials(m.name)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border"
                      style={{ background: m.online ? '#34d399' : '#475569', borderColor: 'rgba(10,12,14,0.9)' }} />
                  </div>
                  <span className="flex-1 truncate text-xs font-medium">{m.name}</span>
                  {count > 0 && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: GOLD_SOFT, color: GOLD }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ===== CENTER: Conversation ===== */}
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-5 py-3" style={floatStyle}>
            <div className="flex items-center gap-3">
              {active.type === 'channel' ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT }}>
                  <Hash className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
                </div>
              ) : activeDMMember ? (
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-semibold"
                    style={{ borderColor: GOLD_BORDER, background: 'rgba(20,22,24,0.6)', color: '#c7cfd8' }}>
                    {initials(activeDMMember.name)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                    style={{ background: activeDMMember.online ? '#34d399' : '#475569', borderColor: 'rgba(10,12,14,0.9)' }} />
                </div>
              ) : null}
              <div>
                <div className="text-sm font-bold text-white">{headerTitle}</div>
                <div className="text-[10px] text-[#7A7D7F]">{headerSubtitle}</div>
              </div>
            </div>
            {active.type === 'dm' && activeDMMember && (
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
                  style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }}>
                  <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> View Profile
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)', color: '#84929f' }}
                  title="Call placeholder">
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.5} /> Start Call
                </button>
              </div>
            )}
          </div>

          {/* Messages — scrollable */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-8 w-8 text-[#4A4D4F]" strokeWidth={1.5} />
                <p className="mt-3 text-xs text-[#7A7D7F]">
                  {active.type === 'channel' ? 'No messages yet. Start the conversation.' : 'Say hello to start your private conversation.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.authorId === currentUserId;
                const author = members.find((m) => m.id === msg.authorId);
                return (
                  <div key={msg.id} className="flex items-start gap-3 px-4 py-3" style={floatStyle}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                      style={{ borderColor: GOLD_BORDER, background: isSelf ? GOLD_SOFT : 'rgba(20,22,24,0.6)', color: isSelf ? GOLD : '#c7cfd8' }}>
                      {initials(msg.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{msg.authorName}</span>
                        {author?.online && <ShieldCheck className="h-3 w-3" strokeWidth={1.5} style={{ color: GOLD }} />}
                        {msg.authorRole && (
                          <span className="rounded border px-1.5 py-0.5 text-[8px] font-mono tracking-widest uppercase"
                            style={{ borderColor: GOLD_BORDER, background: 'rgba(20,22,24,0.5)', color: '#aab6c2' }}>
                            {msg.authorRole}
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-[#5f6e7c]">{msg.timestamp}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[#c7cfd8]">{msg.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="flex shrink-0 items-center gap-2 p-3" style={floatStyle}>
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)', color: '#7A7D7F' }}
              title="Attachment (placeholder)">
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={active.type === 'channel' ? `Message #${activeChannel?.name ?? 'general'}...` : `Message ${activeDMMember?.name ?? ''}...`}
              className="flex-1 rounded-lg border px-3 py-2.5 text-sm text-white placeholder-[#475565]"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}
            />
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)', color: '#7A7D7F' }}
              title="Emoji (placeholder)">
              <Smile className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={sendMessage}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all"
              style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: GOLD }}
              title="Send">
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </main>

        {/* ===== RIGHT: Members ===== */}
        <aside className="hidden w-60 shrink-0 flex-col gap-3 lg:flex">
          <div className="flex flex-col gap-2 p-3" style={floatStyle}>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: '#f5e6b0' }}>{portalLabel} Members</span>
            </div>
            <div className="mb-1 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">
              {members.filter((m) => m.online).length} Online · {members.length} Total
            </div>
            {members.map((m) => (
              <div key={m.id} className="relative">
                <button
                  onClick={() => setMemberMenu((cur) => (cur === m.id ? null : m.id))}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all"
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border text-[9px] font-semibold"
                      style={{ borderColor: GOLD_BORDER, background: 'rgba(20,22,24,0.6)', color: '#c7cfd8' }}>
                      {initials(m.name)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                      style={{ background: m.online ? '#34d399' : '#475569', borderColor: 'rgba(10,12,14,0.9)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white">{m.name}</div>
                    <div className="truncate text-[10px] text-[#7A7D7F]">{m.role}</div>
                  </div>
                </button>
                {memberMenu === m.id && m.id !== currentUserId && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border p-1"
                    style={{ borderColor: GOLD_BORDER, background: 'rgba(10,12,14,0.96)', backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                    <button
                      onClick={() => setMemberMenu(null)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] text-[#c7cfd8] transition-all hover:bg-[#151719]">
                      <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} /> View Profile
                    </button>
                    <button
                      onClick={() => openDM(m.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] font-semibold transition-all"
                      style={{ color: GOLD }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = GOLD_SOFT; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} /> Message
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ===== Mobile channel/member toggle ===== */}
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase"
          style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }}>
          <Hash className="h-3.5 w-3.5" strokeWidth={1.5} /> Channels
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)', color: '#84929f' }}>
          <Users className="h-3.5 w-3.5" strokeWidth={1.5} /> Members
        </button>
      </div>

      {/* ===== New Message Modal ===== */}
      {newMessageOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-xl border p-5" style={{ borderColor: GOLD_BORDER, background: 'rgba(10,12,14,0.97)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
                <span className="text-sm font-bold tracking-wide text-white">New Message</span>
              </div>
              <button onClick={() => setNewMessageOpen(false)} className="text-[#7A7D7F] transition-all hover:text-white">
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}>
              <Search className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: '#5f6e7c' }} />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={`Search ${portalLabel} members...`}
                className="flex-1 bg-transparent text-xs text-white placeholder-[#475565] focus:outline-none"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#7A7D7F]">No members found.</div>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => openDM(m.id)}
                    className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all"
                    style={{ borderColor: 'transparent', background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = GOLD_BORDER; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-semibold"
                        style={{ borderColor: GOLD_BORDER, background: 'rgba(20,22,24,0.6)', color: '#c7cfd8' }}>
                        {initials(m.name)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border"
                        style={{ background: m.online ? '#34d399' : '#475569', borderColor: 'rgba(10,12,14,0.9)' }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-white">{m.name}</div>
                      <div className="text-[10px] text-[#7A7D7F]">{m.role}</div>
                    </div>
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ===== Seed data helpers =====

function seedChannelMessages(channelId: string, members: PortalMember[], currentUserName: string, _currentUserRole: string): ChatMessage[] {
  const seeds: Record<string, ChatMessage[]> = {
    general: [
      { id: 'g1', authorId: 'mem-casey', authorName: 'Casey', authorRole: 'Investor', body: 'Morning everyone. Anyone looked at the new opportunity Bryan posted?', timestamp: '10:42 AM' },
      { id: 'g2', authorId: 'mem-kevin', authorName: 'Kevin Martin', authorRole: 'Investor', body: 'Yeah, glanced at the deck. The numbers look strong but I want to understand the customer acquisition strategy better.', timestamp: '10:48 AM' },
      { id: 'g3', authorId: 'mem-randy', authorName: 'Randy Kasper', authorRole: 'Investor / Advisor', body: 'I have a call with the founder Thursday. Happy to bring back questions if anyone has specific ones.', timestamp: '11:02 AM' },
      { id: 'g4', authorId: 'mem-bryan', authorName: 'Bryan Paris', authorRole: 'COO', body: 'I can share more context on the poker-infrastructure angle if useful. The distribution model is the differentiator.', timestamp: '11:15 AM' },
    ],
    'deal-flow': [
      { id: 'd1', authorId: 'mem-bryan', authorName: 'Bryan Paris', authorRole: 'COO', body: 'New deal posted this morning — poker analytics platform, seed stage, $500K raise. Open for review.', timestamp: '9:30 AM' },
      { id: 'd2', authorId: 'mem-casey', authorName: 'Casey', authorRole: 'Investor', body: 'Following. Will review the deck today.', timestamp: '9:45 AM' },
    ],
    introductions: [
      { id: 'i1', authorId: 'mem-randy', authorName: 'Randy Kasper', authorRole: 'Investor / Advisor', body: 'Welcome to the Investor Hub. Introduce yourself when you have a moment — who you are, what you invest in, what you are looking for.', timestamp: 'Yesterday' },
    ],
    'poker-industry': [
      { id: 'p1', authorId: 'mem-kevin', authorName: 'Kevin Martin', authorRole: 'Investor', body: 'GGPoker just announced another series. The growth trajectory in online poker is still strong.', timestamp: '1h' },
    ],
    announcements: [
      { id: 'a1', authorId: 'mem-bryan', authorName: 'Bryan Paris', authorRole: 'COO', body: 'Portal chat is now live for Investor Hub members. Use #general for open discussion and #deal-flow for active opportunities.', timestamp: 'Just now' },
    ],
  };
  return seeds[channelId] ?? [];
}
