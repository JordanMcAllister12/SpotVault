import { useState, useEffect, useCallback } from 'react';
import { Shield, UserX, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UserIdentityHoverCard } from '@/components/community/UserIdentityHoverCard';
import { UserIdentityFlag } from '@/components/community/UserIdentityFlag';
import { useDemo } from '@/useDemo';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  userId: string;
}

interface Profile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  poker_role: string | null;
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function ConversationDetailsPane({ userId }: Props) {
  const state = useDemo();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from('user_profiles')
      .select('user_id, username, display_name, avatar_url, bio, poker_role')
      .eq('user_id', userId)
      .single();
    if (p) setProfile(p as Profile);

    const myId = state.currentAccount?.id;
    if (myId) {
      const { data: rel } = await supabase
        .from('sv_relationships')
        .select('type, status')
        .or(`and(user_a_id.eq.${myId},user_b_id.eq.${userId}),and(user_a_id.eq.${userId},user_b_id.eq.${myId})`)
        .limit(1);
      if (rel && rel.length > 0) {
        const r = rel[0];
        if (r.type === 'block') { setIsBlocked(true); setRelationship('blocked'); }
        else if (r.type === 'network_contact') setRelationship(r.status);
        else if (r.type === 'follow') setRelationship('following');
        else setRelationship(r.type);
      }
    }
  }, [userId, state.currentAccount?.id]);

  useEffect(() => { load(); }, [load]);

  const handleBlock = async () => {
    const myId = state.currentAccount?.id;
    if (!myId) return;
    if (isBlocked) {
      await supabase.from('sv_relationships').delete().match({ user_a_id: myId, user_b_id: userId, type: 'block' });
      setIsBlocked(false);
      setRelationship(null);
    } else {
      await supabase.from('sv_relationships').insert({ user_a_id: myId, user_b_id: userId, type: 'block', status: 'active' });
      setIsBlocked(true);
      setRelationship('blocked');
    }
  };

  const displayName = profile?.display_name ?? profile?.username ?? 'Unknown';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-3 py-3 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold tracking-wider uppercase text-white/50">Details</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {/* Avatar + name */}
        <div className="flex flex-col items-center text-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" style={{ border: `2px solid ${BORDER}` }} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-bold text-white/80" style={{ borderColor: BORDER, background: 'rgba(20,22,24,0.6)' }}>
              {initials(displayName)}
            </div>
          )}
          <UserIdentityHoverCard userId={userId} fallbackName={displayName}>
            <p className="mt-2 text-[13px] font-bold text-white">{displayName}</p>
          </UserIdentityHoverCard>
          <div className="mt-1 flex items-center gap-1.5">
            <UserIdentityFlag userId={userId} size="sm" />
          </div>
          {profile?.poker_role && <p className="mt-1 text-[9px] text-white/35 uppercase tracking-wider">{profile.poker_role}</p>}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <p className="text-[8px] font-bold tracking-wider uppercase text-white/40">Bio</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/55">{profile.bio}</p>
          </div>
        )}

        {/* Relationship status */}
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[8px] font-bold tracking-wider uppercase text-white/40">Relationship</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-white/30" strokeWidth={1.5} />
            <span className="text-[10px] text-white/55 capitalize">{relationship ?? 'No relationship'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 border-t border-white/[0.06] pt-3 space-y-2">
          <button
            onClick={handleBlock}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{
              borderColor: isBlocked ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)',
              background: isBlocked ? 'rgba(248,113,113,0.1)' : 'transparent',
              color: isBlocked ? '#f87171' : 'rgba(255,255,255,0.5)',
            }}
          >
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            {isBlocked ? 'Unblock User' : 'Block User'}
          </button>
        </div>
      </div>
    </div>
  );
}
