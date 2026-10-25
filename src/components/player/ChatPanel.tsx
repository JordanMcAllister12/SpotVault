import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AtSign,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Users,
  X,
  ChevronRight,
  ChevronLeft,
  FileText,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/shared/Avatar';
import { EmojiPicker } from '@/components/shared/EmojiPicker';
import {
  searchSpotVaultUsers,
  fetchDMMessages,
  type DMUser,
  type DMConversation,
  type DMMessage,
} from '@/lib/dmStore';
import { NewMessageModal } from '@/components/player/NewMessageModal';

const GOLD = '#d4a52c';
const GOLD_TEXT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

export type ChatSection = 'general' | 'network' | 'direct';

export interface ChannelDef {
  id: ChatSection;
  label: string;
}

export const DEFAULT_CHANNELS: ChannelDef[] = [
  { id: 'general', label: 'General' },
  { id: 'network', label: 'Connections' },
];

interface ChatPanelProps {
  section: ChatSection;
  onSelectSection: (s: ChatSection) => void;
  search: string;
  onSearchChange: (v: string) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  compact?: boolean;
  channels?: ChannelDef[];
  portalLabel?: string;
  // DM props (optional — defaults work for non-DM chat widgets)
  activeDM?: string | null;
  onSelectDM?: (conversationId: string) => void;
  dmConversations?: DMConversation[];
  dmMessages?: DMMessage[];
  currentUserId?: string;
  onNewDM?: (user: DMUser) => void;
}

export function ChatPanel({
  section, onSelectSection, search, onSearchChange,
  draft, onDraftChange, onSend, compact,
  channels = DEFAULT_CHANNELS, portalLabel = 'Player Lounge',
  activeDM = null, onSelectDM, dmConversations = [], dmMessages = [], currentUserId = '', onNewDM,
}: ChatPanelProps) {
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<DMUser[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channelDef = channels.find((c) => c.id === section);
  const title = section === 'direct' ? 'Direct Messages' : (channelDef?.label ?? 'General');
  const subtitle = section === 'direct' ? 'Private conversations' : portalLabel;
  const placeholder = section === 'direct' ? 'Start a private conversation...' : `Write in # ${channelDef?.label ?? 'General'}...`;

  // When in DM section and search has no matching conversations, search users
  const handleSearchChange = useCallback((value: string) => {
    onSearchChange(value);
    if (section !== 'direct') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setUserSearchResults([]);
      setUserSearching(false);
      return;
    }
    setUserSearching(true);
    debounceRef.current = setTimeout(async () => {
      const filteredConvs = dmConversations.filter((c) =>
        (c.otherUsername || c.otherDisplayName || '').toLowerCase().includes(value.toLowerCase()),
      );
      if (filteredConvs.length === 0) {
        const users = await searchSpotVaultUsers(value);
        setUserSearchResults(users);
      } else {
        setUserSearchResults([]);
      }
      setUserSearching(false);
    }, 350);
  }, [section, onSearchChange, dmConversations]);

  const handleNewMessage = useCallback((user: DMUser) => {
    setShowNewMessage(false);
    onNewDM?.(user);
  }, [onNewDM]);

  return (
    <div className="flex h-full min-h-0">
      <ChatNavigation
        activeSection={section}
        activeDM={activeDM}
        search={search}
        onSearchChange={handleSearchChange}
        onSelectSection={(next) => { onSelectSection(next); setLeftDrawerOpen(false); setRightPanelOpen(false); onSearchChange(''); setUserSearchResults([]); }}
        onSelectDM={onSelectDM ?? (() => {})}
        onNewMessage={() => setShowNewMessage(true)}
        mobileOpen={leftDrawerOpen}
        onCloseMobile={() => setLeftDrawerOpen(false)}
        portalLabel={portalLabel}
        channels={channels}
        dmConversations={dmConversations}
        userSearchResults={userSearchResults}
        userSearching={userSearching}
        onSearchUsersClick={handleNewMessage}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader title={title} subtitle={subtitle} onToggleRightPanel={() => setRightPanelOpen((open) => !open)} />
        <div className="flex min-h-0 flex-1 flex-col p-2.5 sm:p-3">
          <ChatBoard
            section={section}
            activeDM={activeDM}
            channels={channels}
            dmMessages={dmMessages}
            currentUserId={currentUserId}
            dmConversations={dmConversations}
          />
          <MessageComposer value={draft} placeholder={placeholder} onChange={onDraftChange} onSend={onSend} />
        </div>
      </main>

      {!compact && (
        <ChatContextPanel section={section} open={rightPanelOpen} onClose={() => setRightPanelOpen(false)} />
      )}

      <NewMessageModal
        open={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onSelectUser={handleNewMessage}
      />
    </div>
  );
}

function ChatNavigation({
  activeSection, activeDM, search, onSearchChange, onSelectSection, onSelectDM, onNewMessage,
  mobileOpen, onCloseMobile, portalLabel, channels, dmConversations, userSearchResults, userSearching, onSearchUsersClick,
}: {
  activeSection: ChatSection;
  activeDM: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectSection: (section: ChatSection) => void;
  onSelectDM: (conversationId: string) => void;
  onNewMessage: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  portalLabel: string;
  channels: ChannelDef[];
  dmConversations: DMConversation[];
  userSearchResults: DMUser[];
  userSearching: boolean;
  onSearchUsersClick: (user: DMUser) => void;
}) {
  const filtered = filterDmEntries(dmConversations, search);
  const showUserSearch = activeSection === 'direct' && search.trim() && filtered.length === 0;

  return (
    <>
      {mobileOpen && (
        <button aria-label="Close chat navigation" className="absolute inset-0 z-40 bg-black/65 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`absolute bottom-0 left-0 top-0 z-50 flex w-[200px] shrink-0 flex-col border-r border-white/[0.06] transition-transform duration-200 md:relative md:z-0 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: 'rgba(6,5,4,0.9)' }}
      >
        <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-3 md:hidden">
          <span className="text-[10px] font-semibold tracking-[0.18em] text-white/60 uppercase">{portalLabel}</span>
          <button onClick={onCloseMobile} className="rounded p-1 text-white/40 hover:text-white" aria-label="Close navigation">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-2.5 py-3">
          <div>
            <p className="mb-1.5 px-2 text-[9px] font-semibold tracking-[0.2em] text-white/30 uppercase">Channels</p>
            {channels.map((ch) => (
              <ChatSectionButton key={ch.id} icon={Hash} label={ch.label} active={activeSection === ch.id} onClick={() => onSelectSection(ch.id)} />
            ))}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <p className="text-[9px] font-semibold tracking-[0.2em] text-white/30 uppercase">Direct Messages</p>
              <button
                onClick={onNewMessage}
                className="rounded p-0.5 text-white/35 transition-colors hover:bg-white/5 hover:text-[#d4a52c]"
                title="New message"
                aria-label="New message"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <label className="mb-2 flex items-center gap-2 rounded-md border border-white/[0.07] bg-black/25 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search conversations"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
              />
              {userSearching && <Loader2 className="h-3 w-3 shrink-0 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />}
            </label>

            {/* Existing DM conversations */}
            {filtered.length > 0 && (
              <div className="space-y-0.5">
                {filtered.map((entry) => {
                  const isActive = activeSection === 'direct' && activeDM === entry.conversationId;
                  const displayName = entry.otherDisplayName || entry.otherUsername;
                  return (
                    <button
                      key={entry.conversationId}
                      onClick={() => onSelectDM(entry.conversationId)}
                      className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                      style={{
                        background: isActive ? 'rgba(192, 145, 30, 0.14)' : 'transparent',
                        border: isActive ? `1px solid ${BORDER}` : '1px solid transparent',
                      }}
                    >
                      <Avatar
                        userId={entry.otherUserId}
                        name={displayName}
                        avatarUrl={entry.otherAvatarUrl}
                        size={24}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium" style={{ color: isActive ? GOLD_TEXT : 'rgba(255,255,255,0.48)' }}>
                        {displayName}
                      </span>
                      {entry.unread > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c0911e] px-1 text-[8px] font-bold text-black">{entry.unread}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* User search results (when no existing conversations match) */}
            {showUserSearch && (
              <div className="mt-1 space-y-0.5">
                <p className="px-2 py-1 text-[8px] font-bold tracking-widest text-white/25 uppercase">
                  Search users for "{search}"
                </p>
                {userSearchResults.length === 0 && !userSearching && (
                  <p className="px-2 py-2 text-[10px] text-white/25">No users found.</p>
                )}
                {userSearchResults.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => onSearchUsersClick(user)}
                    className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <Avatar
                      userId={user.user_id}
                      name={user.display_name || user.username}
                      avatarUrl={user.avatar_url}
                      size={24}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[11px] font-medium text-white/60">{user.display_name || user.username}</span>
                        {user.is_verified && <UserCheck className="h-2.5 w-2.5 shrink-0 text-[#d4a52c]" strokeWidth={2} />}
                      </div>
                      <span className="text-[9px] text-white/30">@{user.username}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filtered.length === 0 && !showUserSearch && (
              <p className="px-2 py-4 text-[11px] leading-relaxed text-white/25">No conversations yet.</p>
            )}
          </div>
        </div>

        <div className="mt-auto border-t border-white/[0.06] px-3 py-2.5">
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] text-white/35 transition-colors hover:bg-white/5 hover:text-white/70">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Chat preferences</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function filterDmEntries(entries: DMConversation[], search: string): DMConversation[] {
  if (!search.trim()) return entries;
  const q = search.toLowerCase();
  return entries.filter((e) =>
    (e.otherUsername || '').toLowerCase().includes(q) ||
    (e.otherDisplayName || '').toLowerCase().includes(q),
  );
}

function ChatSectionButton({ icon: Icon, label, active, onClick }: { icon: typeof Hash; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors"
      style={{
        background: active ? 'rgba(192, 145, 30, 0.14)' : 'transparent',
        color: active ? GOLD_TEXT : 'rgba(255,255,255,0.48)',
        border: active ? `1px solid ${BORDER}` : '1px solid transparent',
      }}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-[#d4a52c]" />}
      <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} style={{ color: active ? GOLD : 'rgba(255,255,255,0.35)' }} />
      <span className="text-[11px] font-medium tracking-wide">{label}</span>
    </button>
  );
}

function ChatHeader({ title, subtitle, onToggleRightPanel }: { title: string; subtitle: string; onToggleRightPanel: () => void }) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/20 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
          {title === 'Direct Messages' ? <MessageCircle className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} /> : <Hash className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[12px] font-semibold text-white">{title}</h1>
          <p className="truncate text-[10px] text-white/35">{subtitle}</p>
        </div>
      </div>
      <button onClick={onToggleRightPanel} className="rounded-md p-1.5 text-white/35 transition-colors hover:bg-white/5 hover:text-white/75" title="Toggle details" aria-label="Toggle details">
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </header>
  );
}

function ChatBoard({ section, activeDM, channels = DEFAULT_CHANNELS, dmMessages, currentUserId, dmConversations }: {
  section: ChatSection;
  activeDM: string | null;
  channels?: ChannelDef[];
  dmMessages: DMMessage[];
  currentUserId: string;
  dmConversations: DMConversation[];
}) {
  const channelDef = channels.find((c) => c.id === section);
  const activeConv = dmConversations.find((c) => c.conversationId === activeDM);
  const heading = section === 'direct' ? (activeConv ? (activeConv.otherDisplayName || activeConv.otherUsername) : 'Direct Messages') : `# ${channelDef?.label ?? 'General'}`;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages.length]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border"
      style={{
        background: 'rgba(8, 7, 6, 0.72)',
        borderColor: BORDER,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 0 40px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-4 py-2">
        {section === 'direct' ? <MessageCircle className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} /> : <Hash className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
        <span className="text-[11px] font-semibold tracking-wide text-white/70">{heading}</span>
      </div>

      {section === 'direct' && activeDM && dmMessages.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3">
          {dmMessages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    isMine
                      ? 'bg-[#d4a52c]/15 text-[#f5e6b0]'
                      : 'border border-white/[0.06] bg-white/[0.04] text-white/80'
                  }`}
                >
                  <p>{msg.body}</p>
                  <div className={`mt-0.5 text-[9px] ${isMine ? 'text-[#d4a52c]/50' : 'text-white/25'}`}>
                    {formatMessageTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-8">
          <div className="max-w-xs text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.06)' }}>
              {section === 'general' ? <Hash className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} /> : section === 'network' ? <Users className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} /> : <MessageCircle className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />}
            </div>
            <p className="mt-3.5 text-[13px] font-medium text-white/60">{section === 'direct' ? 'Select a conversation.' : 'No messages yet.'}</p>
            <p className="mt-1 text-[12px] text-white/40">{section === 'direct' ? 'Choose a contact or start a new message.' : 'Start the conversation.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function MessageComposer({ value, placeholder, onChange, onSend }: { value: string; placeholder: string; onChange: (value: string) => void; onSend: () => void }) {
  return (
    <div className="shrink-0 pt-2.5">
      <div className="flex items-center gap-1.5 rounded-xl border bg-black/40 px-2 py-2 focus-within:border-[#c0911e]/35" style={{ borderColor: BORDER }}>
        <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/5 hover:text-[#d4a52c]" title="Attach file" aria-label="Attach file"><Paperclip className="h-4 w-4" strokeWidth={1.5} /></button>
        <button className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/5 hover:text-[#d4a52c] sm:flex" title="Attach image" aria-label="Attach image"><ImageIcon className="h-4 w-4" strokeWidth={1.5} /></button>
        <button className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/5 hover:text-[#d4a52c] sm:flex" title="Share SpotVault content" aria-label="Share SpotVault content"><AtSign className="h-4 w-4" strokeWidth={1.5} /></button>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') onSend(); }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/25"
          aria-label="Message"
        />
        <EmojiPicker onInsert={(emoji) => onChange(value + emoji)} />
        <button onClick={onSend} disabled={!value.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:text-white/15 enabled:bg-[#c0911e]/15 enabled:text-[#d4a52c] enabled:hover:bg-[#c0911e]/25" title="Send message" aria-label="Send message"><Send className="h-4 w-4" strokeWidth={1.5} /></button>
      </div>
    </div>
  );
}

function ChatContextPanel({ section, open, onClose }: { section: ChatSection; open: boolean; onClose: () => void }) {
  const title = section === 'general' ? 'Online' : section === 'network' ? 'Connections' : 'Conversation Details';
  const description = section === 'general' ? 'Members currently visible in the Player Lounge will appear here.' : section === 'network' ? 'Your approved connections will appear here.' : 'Participants and shared content will appear here.';
  return (
    <aside className={`${open ? 'absolute right-0 top-0 z-30 flex' : 'hidden'} h-full w-[200px] shrink-0 flex-col border-l border-white/[0.06] lg:relative lg:flex`} style={{ background: 'rgba(6,5,4,0.85)' }}>
      <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-white/55 uppercase">{title}</span>
        <button onClick={onClose} className="rounded p-1 text-white/35 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Close details"><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /></button>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 text-center">
        <p className="text-[11px] leading-relaxed text-white/25">{description}</p>
      </div>
    </aside>
  );
}
