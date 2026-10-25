import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, MessageSquare, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import {
  getOrCreateConversation,
  fetchDMMessages,
  sendDMMessage,
  markConversationRead,
  type DMMessage,
} from '@/lib/dmStore';
import { fetchLoungePosts, createLoungePost, type LoungePost } from '@/lib/loungeStore';
import { getMyContacts, type Contact } from '@/lib/contactsEngine';
import { fetchProfile, type UserProfile } from '@/lib/profileStore';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';
import type { LoungeDirectContact } from '@/components/lounge/UniversalLounge';

interface Props {
  loungeSlug: string;
  account: SpotVaultAccount | null;
  channels?: string[];
  enableDirect?: boolean;
  seedGroupMessages?: GroupMsg[];
  seedDirectMessages?: GroupMsg[];
  seedGroupPresence?: { name: string; online: boolean }[];
  seedDirectContacts?: LoungeDirectContact[];
  mode?: 'group' | 'direct';
}

export interface GroupMsg {
  id: string;
  author: string;
  authorName: string;
  body: string;
  ts: string;
}

interface DirectContactInfo {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  online: boolean;
}

export function GroupChatModule({
  loungeSlug,
  account,
  channels = ['general'],
  enableDirect = true,
  seedGroupPresence = [],
  seedDirectContacts = [],
  mode,
}: Props) {
  const [tab, setTab] = useState<'group' | 'direct'>(mode === 'direct' ? 'direct' : 'group');
  const [activeChannel, setActiveChannel] = useState(channels[0] ?? 'general');
  const [draft, setDraft] = useState('');
  const [groupMsgs, setGroupMsgs] = useState<LoungePost[]>([]);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupSending, setGroupSending] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [directContacts, setDirectContacts] = useState<DirectContactInfo[]>([]);
  const [directConversations, setDirectConversations] = useState<Record<string, { conversationId: string; messages: DMMessage[]; unread: number }>>({});
  const [directLoading, setDirectLoading] = useState(false);
  const [directSending, setDirectSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const directScrollRef = useRef<HTMLDivElement>(null);

  const effectiveMode = mode;
  const showTabs = !effectiveMode;
  const showGroup = effectiveMode ? effectiveMode === 'group' : tab === 'group';
  const showDirect = effectiveMode ? effectiveMode === 'direct' : tab === 'direct' && enableDirect;

  // ── Load group messages from poker_lounge_messages (persistent) ──
  const loadGroupMessages = useCallback(async () => {
    if (!loungeSlug) return;
    setGroupLoading(true);
    const posts = await fetchLoungePosts(loungeSlug, 100);
    setGroupMsgs(posts);
    setGroupLoading(false);
  }, [loungeSlug]);

  useEffect(() => {
    void loadGroupMessages();
  }, [loadGroupMessages]);

  // Subscribe to realtime inserts for this lounge
  useEffect(() => {
    if (!loungeSlug) return;
    const channel = supabase
      .channel(`lounge-group-${loungeSlug}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'poker_lounge_messages', filter: `lounge_id=eq.${loungeSlug}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const post: LoungePost = {
            id: row.id as string,
            author_id: row.author_id as string,
            author_name: row.author_name as string,
            author_avatar: (row.author_avatar as string) ?? null,
            author_role: (row.author_role as string) ?? null,
            body: (row.body as string) ?? null,
            attachment_type: (row.attachment_type as string) ?? null,
            attachment_url: (row.attachment_url as string) ?? null,
            attachment_label: (row.attachment_label as string) ?? null,
            reply_to: (row.reply_to as string) ?? null,
            created_at: row.created_at as string,
            lounge_id: (row.lounge_id as string) ?? loungeSlug,
          };
          setGroupMsgs((prev) => [post, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loungeSlug]);

  // ── Load direct contacts + conversations from DB ──
  useEffect(() => {
    if (!account?.id) return;
    let cancelled = false;

    (async () => {
      setDirectLoading(true);

      let contacts: Contact[] = [];
      try {
        contacts = await getMyContacts(account.id);
      } catch { /* ignore */ }

      // Build contact info list — use seedDirectContacts as fallback display
      const contactInfos: DirectContactInfo[] = contacts.length > 0
        ? await Promise.all(contacts.map(async (c) => {
            const profile = await fetchProfile(c.user_id);
            return {
              id: c.user_id,
              name: profile?.display_name ?? 'Unknown',
              avatar: profile?.avatar_url ?? null,
              role: profile?.poker_role ?? 'PLAYER',
              online: false,
            };
          }))
        : seedDirectContacts.map((c) => ({
            id: c.id,
            name: c.name,
            avatar: c.avatar,
            role: c.role,
            online: c.online,
          }));

      if (cancelled) return;
      setDirectContacts(contactInfos);

      if (contactInfos.length > 0 && !selectedContact) {
        setSelectedContact(contactInfos[0].id);
      }

      setDirectLoading(false);
    })();

    return () => { cancelled = true; };
  }, [account?.id]);

  // ── Load DM messages for selected contact ──
  const loadDirectMessages = useCallback(async (otherUserId: string) => {
    if (!account?.id) return;
    const convId = await getOrCreateConversation(otherUserId);
    if (!convId) return;
    const msgs = await fetchDMMessages(convId);
    setDirectConversations((prev) => ({
      ...prev,
      [otherUserId]: { conversationId: convId, messages: msgs, unread: 0 },
    }));
    // Mark as read
    void markConversationRead(convId, account.id);
  }, [account?.id]);

  useEffect(() => {
    if (selectedContact && showDirect) {
      void loadDirectMessages(selectedContact);
    }
  }, [selectedContact, showDirect, loadDirectMessages]);

  // Subscribe to realtime DM updates for the active conversation
  useEffect(() => {
    if (!selectedContact || !showDirect) return;
    const conv = directConversations[selectedContact];
    if (!conv) return;

    const channel = supabase
      .channel(`dm-lounge-${conv.conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_inbox_messages', filter: `conversation_id=eq.${conv.conversationId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msg: DMMessage = {
            id: row.id as string,
            conversation_id: row.conversation_id as string,
            sender_id: row.sender_id as string,
            body: row.body as string,
            read: row.read as boolean,
            created_at: row.created_at as string,
          };
          setDirectConversations((prev) => {
            const existing = prev[selectedContact];
            if (!existing || existing.messages.some((m) => m.id === msg.id)) return prev;
            return {
              ...prev,
              [selectedContact]: { ...existing, messages: [...existing.messages, msg] },
            };
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedContact, showDirect, directConversations]);

  useEffect(() => {
    if (showGroup) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [groupMsgs, showGroup, activeChannel]);

  useEffect(() => {
    if (showDirect) directScrollRef.current?.scrollTo({ top: directScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [directConversations, showDirect]);

  const handleSendGroup = useCallback(async () => {
    if (!draft.trim() || !account) return;
    setGroupSending(true);
    const post = await createLoungePost({
      authorId: account.id,
      authorName: account.name,
      authorAvatar: null,
      authorRole: account.role ?? 'PLAYER',
      body: draft.trim(),
      loungeSlug,
    });
    if (post) {
      // Realtime subscription will add it, but add locally as fallback
      setGroupMsgs((prev) => {
        if (prev.some((m) => m.id === post.id)) return prev;
        return [post, ...prev];
      });
    }
    setDraft('');
    setGroupSending(false);
  }, [draft, account, loungeSlug]);

  const handleSendDirect = useCallback(async () => {
    if (!draft.trim() || !account || !selectedContact) return;
    setDirectSending(true);
    const conv = directConversations[selectedContact];
    if (!conv) {
      const convId = await getOrCreateConversation(selectedContact);
      if (convId) {
        const success = await sendDMMessage(convId, account.id, draft.trim());
        if (success) {
          const msgs = await fetchDMMessages(convId);
          setDirectConversations((prev) => ({
            ...prev,
            [selectedContact]: { conversationId: convId, messages: msgs, unread: 0 },
          }));
        }
      }
    } else {
      const success = await sendDMMessage(conv.conversationId, account.id, draft.trim());
      if (success) {
        const msgs = await fetchDMMessages(conv.conversationId);
        setDirectConversations((prev) => ({
          ...prev,
          [selectedContact]: { ...prev[selectedContact], messages: msgs },
        }));
      }
    }
    setDraft('');
    setDirectSending(false);
  }, [draft, account, selectedContact, directConversations]);

  return (
    <div className="flex h-full flex-col">
      {/* Tabs (only when not in dedicated mode) */}
      {showTabs && (
        <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.04] px-3 pt-3">
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
              tab === 'group' ? 'border-b-2 border-[#d4a52c] text-[#f5e6b0]' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Users className="h-3 w-3" /> Group
          </button>
          {enableDirect && (
            <button
              onClick={() => setTab('direct')}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                tab === 'direct' ? 'border-b-2 border-[#d4a52c] text-[#f5e6b0]' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <MessageSquare className="h-3 w-3" /> Direct
            </button>
          )}
        </div>
      )}

      {/* Group header in dedicated mode */}
      {effectiveMode === 'group' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
          <Users className="h-3.5 w-3.5 text-[#d4a52c]/60" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Group Chat</span>
          {seedGroupPresence.length > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] text-white/40">
                {seedGroupPresence.filter((p) => p.online).length} online
              </span>
            </div>
          )}
        </div>
      )}

      {/* Direct header in dedicated mode */}
      {effectiveMode === 'direct' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
          <MessageSquare className="h-3.5 w-3.5 text-[#d4a52c]/60" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Direct</span>
        </div>
      )}

      {showGroup && (
        <>
          {/* Channel tabs */}
          {channels.length > 1 && (
            <div className="flex shrink-0 gap-1 border-b border-white/[0.04] px-3 py-2">
              {channels.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setActiveChannel(ch)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    activeChannel === ch ? 'bg-[#c0911e]/10 text-[#f5e6b0]' : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  #{ch}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
            {groupLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-white/30" />
              </div>
            ) : groupMsgs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-[11px] text-white/25">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...groupMsgs].reverse().map((msg) => {
                  const isSelf = account?.id === msg.author_id;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
                      {!isSelf && <Avatar name={msg.author_name} size={28} />}
                      <div className={`max-w-[75%] ${isSelf ? 'text-right' : ''}`}>
                        {!isSelf && (
                          <div className="mb-0.5 text-[10px] font-medium text-white/50">{msg.author_name}</div>
                        )}
                        <div
                          className={`inline-block rounded-lg px-3 py-1.5 text-[12px] leading-relaxed ${
                            isSelf
                              ? 'bg-[#c0911e]/15 text-[#f5e6b0]'
                              : 'bg-white/[0.04] text-white/80'
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-white/[0.04] p-2">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !groupSending && handleSendGroup()}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
              />
              <button
                onClick={handleSendGroup}
                disabled={!draft.trim() || groupSending}
                className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 p-1.5 text-[#d4a52c] transition-all hover:bg-[#c0911e]/20 disabled:opacity-30"
              >
                {groupSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </>
      )}

      {showDirect && (
        <DirectMessagesTab
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSendDirect}
          contacts={directContacts}
          conversations={directConversations}
          currentUserId={account?.id ?? ''}
          selected={selectedContact}
          onSelectMember={(id) => setSelectedContact(id)}
          loading={directLoading}
          sending={directSending}
          scrollRef={directScrollRef}
        />
      )}
    </div>
  );
}

function DirectMessagesTab({
  draft,
  onDraftChange,
  onSend,
  contacts,
  conversations,
  currentUserId,
  selected,
  onSelectMember,
  loading,
  sending,
  scrollRef,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  contacts: DirectContactInfo[];
  conversations: Record<string, { conversationId: string; messages: DMMessage[]; unread: number }>;
  currentUserId: string;
  selected: string | null;
  onSelectMember: (id: string) => void;
  loading: boolean;
  sending: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const conv = selected ? conversations[selected] : null;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Contact list — compact rail */}
      <div className="w-20 shrink-0 overflow-y-auto border-r border-white/[0.04]">
        {loading ? (
          <div className="flex justify-center p-3">
            <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          </div>
        ) : contacts.length === 0 ? (
          <p className="p-3 text-[10px] text-white/25">No contacts</p>
        ) : (
          contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectMember(c.id)}
              className={`flex w-full items-center gap-1.5 px-2 py-2 text-left transition-colors ${
                selected === c.id ? 'bg-[#c0911e]/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar name={c.name} size={20} />
                {c.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#0a0c0e] bg-emerald-400" />
                )}
              </div>
              <span className="truncate text-[10px] text-white/60">{c.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
          {!conv || conv.messages.length === 0 ? (
            <p className="flex h-full items-center justify-center text-[10px] text-white/25">
              {loading ? 'Loading...' : 'Select a contact'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {conv.messages.map((m) => {
                const isSelf = m.sender_id === currentUserId;
                return (
                  <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-[11px] ${
                        isSelf ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'bg-white/[0.04] text-white/80'
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-white/[0.04] p-2">
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && onSend()}
              placeholder="Message..."
              className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
            />
            <button
              onClick={onSend}
              disabled={!draft.trim() || sending}
              className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 p-1.5 text-[#d4a52c] disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
