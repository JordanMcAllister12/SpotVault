import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import {
  getOrCreateConversation,
  fetchDMMessages,
  sendDMMessage,
  markConversationRead,
  type DMConversation,
  type DMMessage,
} from '@/lib/dmStore';
import { refreshUnreadCounts } from '@/lib/messagingCenterStore';
import { UserIdentityHoverCard } from '@/components/community/UserIdentityHoverCard';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import type { ContactListItem } from './ConversationListPane';
import type { SpotVaultAccount } from '@/types';

const BORDER = 'rgba(212, 165, 44, 0.18)';
const GOLD_SOFT = '#f5e6b0';

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

interface Props {
  account: SpotVaultAccount | null;
  contact: ContactListItem | null;
  initialConversationUserId?: string | null;
  onBack: () => void;
  onShowDetails?: () => void;
  compact?: boolean;
}

export function ConversationPane({ account, contact, initialConversationUserId, onBack, onShowDetails, compact }: Props) {
  const [conv, setConv] = useState<DMConversation | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = account?.id ?? '';

  const openConversation = useCallback(async (userId: string, displayName: string, username: string, avatarUrl: string | null) => {
    setLoading(true);
    let found = conv;
    if (!found || found.otherUserId !== userId) {
      const convId = await getOrCreateConversation(userId);
      if (convId) {
        found = {
          conversationId: convId, otherUserId: userId, otherUsername: username,
          otherDisplayName: displayName, otherAvatarUrl: avatarUrl,
          lastMessagePreview: '', lastMessageAt: null, unread: 0,
        };
        setConv(found);
      }
    }
    if (found) {
      const msgs = await fetchDMMessages(found.conversationId);
      setMessages(msgs);
      await markConversationRead(found.conversationId, currentUserId);
      void refreshUnreadCounts(currentUserId);
    }
    setLoading(false);
  }, [conv, currentUserId]);

  useEffect(() => {
    if (contact) {
      openConversation(contact.userId, contact.displayName, contact.username, contact.avatarUrl);
    } else if (initialConversationUserId) {
      openConversation(initialConversationUserId, 'User', '', null);
    }
  }, [contact, initialConversationUserId, openConversation]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, conv]);

  const handleSend = async () => {
    if (!draft.trim() || !conv || sending) return;
    setSending(true);
    const body = draft.trim();
    setDraft('');
    const success = await sendDMMessage(conv.conversationId, currentUserId, body);
    if (success) {
      const msgs = await fetchDMMessages(conv.conversationId);
      setMessages(msgs);
    }
    setSending(false);
  };

  if (!conv && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-[11px] text-white/30">Select a conversation to start messaging.</p>
      </div>
    );
  }

  const displayName = conv?.otherDisplayName ?? conv?.otherUsername ?? contact?.displayName ?? 'User';
  const username = conv?.otherUsername ?? contact?.username ?? '';
  const avatarUrl = conv?.otherAvatarUrl ?? contact?.avatarUrl ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-black/30 text-white/50 transition-colors hover:text-white/80">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" style={{ border: `1px solid ${BORDER}` }} />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold text-white/80" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}>
                {initials(displayName)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <UserIdentityHoverCard userId={conv?.otherUserId ?? contact?.userId ?? ''} fallbackName={displayName}>
                <p className="truncate text-[11px] font-bold text-white">{displayName}</p>
              </UserIdentityHoverCard>
              <UserIdentityFlag userId={conv?.otherUserId ?? contact?.userId ?? ''} size="sm" />
            </div>
            {username && <p className="text-[8px] text-white/40">{username}</p>}
          </div>
          {onShowDetails && !compact && (
            <button onClick={onShowDetails} className="text-[9px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70">
              Info
            </button>
          )}
        </div>
      </div>

      {/* Message history */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading && <div className="py-4 text-center"><p className="text-[10px] text-white/30">Loading…</p></div>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[10px] text-white/30">No messages yet.</p>
            <p className="text-[9px] text-white/20">Start the conversation below.</p>
          </div>
        )}
        {!loading && messages.map((msg) => {
          const isSelf = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`mb-2 flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-lg px-2.5 py-1.5"
                style={{
                  background: isSelf ? 'rgba(212,165,44,0.12)' : 'rgba(255,255,255,0.05)',
                  border: isSelf ? `1px solid ${BORDER}` : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <p className="text-[11px] leading-relaxed text-white/85">{msg.body}</p>
                <p className="mt-0.5 text-[8px] text-white/25">{formatTime(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${displayName}…`}
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95 disabled:opacity-30"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
