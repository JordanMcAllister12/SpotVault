import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { refreshUnreadCounts } from '@/lib/messagingCenterStore';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface ActivityItem {
  id: string;
  message_key: string;
  sender_type: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

interface Props {
  userId: string | undefined;
  listOnly?: boolean;
}

export function ActivityTab({ userId, listOnly }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('system_messages')
      .select('id, message_key, sender_type, subject, body, read, created_at')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as ActivityItem[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (item: ActivityItem) => {
    setSelected(item);
    if (item.read) return;
    const { error } = await supabase
      .from('system_messages')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('read', false);
    if (!error) {
      setItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, read: true } : m)));
      if (userId) void refreshUnreadCounts(userId);
    }
  }, [userId]);

  const header = (
    <div className="shrink-0 px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
          <Bell className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[12px] font-bold tracking-wide text-white">ACTIVITY</p>
          <p className="text-[7px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Notifications</p>
        </div>
      </div>
    </div>
  );

  if (selected && !listOnly) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-3">
          <button onClick={() => setSelected(null)} className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80">
            ← Back to Activity
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <h3 className="text-[13px] font-bold text-white">{selected.subject}</h3>
          <p className="mt-1 text-[9px] text-white/30">{formatTime(selected.created_at)}</p>
          <div className="mt-3 text-[12px] leading-relaxed text-white/75">{selected.body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading && <div className="py-6 text-center"><p className="text-[10px] text-white/30">Loading activity…</p></div>}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Bell className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="text-[10px] text-white/30">No activity yet.</p>
          </div>
        )}
        {!loading && items.map((item) => (
          <button
            key={item.id}
            onClick={() => markRead(item)}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 shrink-0">
              {!item.read && <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />}
              {item.read && <span className="h-2 w-2 rounded-full bg-white/15" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white/90">{item.subject}</p>
              <p className="truncate text-[9px] text-white/35">{item.body.slice(0, 60)}</p>
              <p className="mt-0.5 text-[8px] text-white/25">{formatTime(item.created_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
