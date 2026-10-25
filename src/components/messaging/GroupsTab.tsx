import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronRight, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GroupChatModule } from '@/components/lounge/GroupChatModule';
import { refreshUnreadCounts, fetchGroupUnreadBreakdown } from '@/lib/messagingCenterStore';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface LoungeMembership {
  lounge_slug: string;
  status: string;
}

interface Props {
  account: SpotVaultAccount | null;
  listOnly?: boolean;
}

export function GroupsTab({ account, listOnly }: Props) {
  const [memberships, setMemberships] = useState<LoungeMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());

  const loadMemberships = useCallback(async () => {
    if (!account?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('lounge_memberships')
      .select('lounge_slug, status')
      .eq('user_id', account.id)
      .eq('status', 'active');
    setMemberships((data as LoungeMembership[]) ?? []);
    setLoading(false);
    const breakdown = await fetchGroupUnreadBreakdown(account.id);
    setUnreadMap(breakdown);
  }, [account?.id]);

  useEffect(() => { loadMemberships(); }, [loadMemberships]);

  // Refresh unread breakdown when returning to the group list
  useEffect(() => {
    if (!selectedSlug && account?.id) {
      void fetchGroupUnreadBreakdown(account.id).then(setUnreadMap);
    }
  }, [selectedSlug, account?.id]);

  const handleSelectGroup = async (slug: string) => {
    setSelectedSlug(slug);
    const { data } = await supabase.from('lounge_configs').select('name').eq('slug', slug).single();
    setGroupName(data?.name ?? slug);
    if (account?.id) {
      await supabase
        .from('lounge_read_state')
        .upsert({ user_id: account.id, lounge_slug: slug, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,lounge_slug' });
      void refreshUnreadCounts(account.id);
    }
  };

  // List-only mode (left column of desktop layout)
  if (listOnly) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
              <Users className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-wide text-white">GROUPS</p>
              <p className="text-[7px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Study & Strategy</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
          {loading && <div className="py-6 text-center"><p className="text-[10px] text-white/30">Loading groups…</p></div>}
          {!loading && memberships.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center">
              <Users className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
              <p className="text-[10px] text-white/30">No groups joined yet.</p>
              <p className="mt-1 text-[9px] text-white/20">Join a group from Community.</p>
            </div>
          )}
          {!loading && memberships.map((m) => {
            const unread = unreadMap.get(m.lounge_slug) ?? 0;
            return (
            <button
              key={m.lounge_slug}
              onClick={() => handleSelectGroup(m.lounge_slug)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)', color: GOLD }}>
                {m.lounge_slug.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/90">{m.lounge_slug.replace(/-/g, ' ')}</p>
                <p className="truncate text-[9px] text-white/35">{unread > 0 ? `${unread} unread` : 'Group'}</p>
              </div>
              {unread > 0 && (
                <span
                  className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-bold"
                  style={{ background: 'rgba(212,165,44,0.2)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
                >
                  {unread}
                </span>
              )}
              <ChevronRight className="h-3 w-3 shrink-0 text-white/20" strokeWidth={1.5} />
            </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full view (center column / mobile)
  if (selectedSlug) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-3">
          <button onClick={() => setSelectedSlug(null)} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white/80">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Groups
          </button>
          <h3 className="mt-2 text-[13px] font-bold text-white capitalize">{groupName}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <GroupChatModule
            loungeSlug={selectedSlug}
            account={account}
            mode="group"
            onBack={() => setSelectedSlug(null)}
          />
        </div>
      </div>
    );
  }

  // No selection — show group list (mobile / center column)
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.1)' }}>
            <Users className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-wide text-white">GROUPS</p>
            <p className="text-[7px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Study & Strategy</p>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading && <div className="py-6 text-center"><p className="text-[10px] text-white/30">Loading groups…</p></div>}
        {!loading && memberships.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Users className="mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
            <p className="text-[10px] text-white/30">No groups joined yet.</p>
            <p className="mt-1 text-[9px] text-white/20">Join a group from Community.</p>
          </div>
        )}
        {!loading && memberships.map((m) => {
          const unread = unreadMap.get(m.lounge_slug) ?? 0;
          return (
            <button
              key={m.lounge_slug}
              onClick={() => handleSelectGroup(m.lounge_slug)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)', color: GOLD }}>
                {m.lounge_slug.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/90">{m.lounge_slug.replace(/-/g, ' ')}</p>
                <p className="truncate text-[9px] text-white/35">{unread > 0 ? `${unread} unread` : 'Group'}</p>
              </div>
              {unread > 0 && (
                <span
                  className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-bold"
                  style={{ background: 'rgba(212,165,44,0.2)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
                >
                  {unread}
                </span>
              )}
              <ChevronRight className="h-3 w-3 shrink-0 text-white/20" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
