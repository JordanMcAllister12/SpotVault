import { useState, useEffect, useCallback } from 'react';
import { Mail, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDemo } from '@/useDemo';
import { refreshUnreadCounts } from '@/lib/messagingCenterStore';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface SystemMessage {
  id: string;
  recipient_user_id: string;
  message_key: string;
  sender_type: string;
  subject: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
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
  userId: string | undefined;
  onOpen: () => void;
}

export function InboxTab({ userId, onOpen }: Props) {
  const state = useDemo();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [selected, setSelected] = useState<SystemMessage | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('system_messages')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setMessages(data as SystemMessage[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const markRead = useCallback(async (msg: SystemMessage) => {
    setSelected(msg);
    if (msg.read) return;
    const { error } = await supabase.from('system_messages').update({ read: true, read_at: new Date().toISOString() }).eq('id', msg.id).eq('read', false);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      if (userId) void refreshUnreadCounts(userId);
    }
  }, [userId]);

  if (selected) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-3">
          <button onClick={() => setSelected(null)} className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80">
            ← Back to Inbox
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: GOLD }}>{selected.sender_type}</p>
          <h3 className="mt-1 text-[14px] font-bold text-white">{selected.subject}</h3>
          <p className="mt-1 text-[9px] text-white/30">{formatTime(selected.created_at)}</p>
          <div className="mt-4 text-[12px] leading-relaxed text-white/75">{selected.body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
            <Mail className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-wide text-white">INBOX</p>
            <p className="text-[7px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Official Messages</p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading && <div className="py-6 text-center"><p className="text-[10px] text-white/30">Loading inbox…</p></div>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Mail className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="text-[10px] text-white/30">No official messages.</p>
          </div>
        )}
        {!loading && messages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => markRead(msg)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 shrink-0">
              {msg.read ? (
                <Mail className="h-4 w-4 text-white/20" strokeWidth={1.5} />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: 'rgba(212,165,44,0.15)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[11px] font-semibold text-white/90">{msg.subject}</p>
                {!msg.read && <span className="shrink-0 text-[8px] font-bold" style={{ color: GOLD }}>NEW</span>}
              </div>
              <p className="truncate text-[9px] text-white/35">{msg.body.slice(0, 80)}</p>
              <p className="mt-0.5 text-[8px] text-white/25">{formatTime(msg.created_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
