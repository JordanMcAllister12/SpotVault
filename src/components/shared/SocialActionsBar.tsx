import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, UserCheck, MessageSquare, UserX, Loader2,
  BadgeCheck, Users, Gift,
} from 'lucide-react';
import {
  followUser, unfollowUser, blockUser,
  type FollowResult,
} from '@/lib/followEngine';
import {
  requestContact, acceptContact, declineContact, removeContact,
} from '@/lib/authEngine';
import {
  getRelationshipStatus, type RelationshipStatus,
} from '@/lib/socialGraphStore';
import { dispatchOpenGiftModal } from '@/lib/giftEvents';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export function SocialActionsBar({
  targetUserId,
  recipientName,
  onMessage,
  onProfileViewed,
}: {
  targetUserId: string;
  recipientName?: string;
  onMessage?: () => void;
  onProfileViewed?: () => void;
}) {
  const [status, setStatus] = useState<RelationshipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const s = await getRelationshipStatus(targetUserId);
    setStatus(s);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  if (loading || !status || status.is_self) return null;

  if (status.is_blocked) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-3 text-[11px] text-white/40">
        <UserX className="h-3.5 w-3.5" />
        This user is blocked
      </div>
    );
  }

  const handleFollow = async () => {
    setActing('follow');
    const result: FollowResult | null = await followUser(targetUserId);
    if (result) {
      setStatus(prev => prev ? {
        ...prev,
        is_following: result === 'following' || result === 'already_following',
        is_mutual: result === 'following' && prev.is_followed_by,
      } : prev);
    }
    setActing(null);
  };

  const handleUnfollow = async () => {
    setActing('follow');
    const ok = await unfollowUser(targetUserId);
    if (ok) {
      setStatus(prev => prev ? { ...prev, is_following: false, is_mutual: false } : prev);
    }
    setActing(null);
  };

  const handleAddContact = async () => {
    setActing('contact');
    await requestContact(targetUserId);
    setStatus(prev => prev ? { ...prev, contact_request_pending: true } : prev);
    setActing(null);
  };

  const handleAcceptContact = async () => {
    if (!status.contact_relationship_id) return;
    setActing('contact');
    await acceptContact(status.contact_relationship_id);
    setStatus(prev => prev ? {
      ...prev,
      is_contact: true,
      contact_request_pending: false,
    } : prev);
    setActing(null);
  };

  const handleDeclineContact = async () => {
    if (!status.contact_relationship_id) return;
    setActing('contact');
    await declineContact(status.contact_relationship_id);
    setStatus(prev => prev ? { ...prev, contact_request_pending: false } : prev);
    setActing(null);
  };

  const handleRemoveContact = async () => {
    if (!status.contact_relationship_id) return;
    setActing('contact');
    await removeContact(status.contact_relationship_id);
    setStatus(prev => prev ? { ...prev, is_contact: false, contact_relationship_id: null } : prev);
    setActing(null);
  };

  const handleBlock = async () => {
    setActing('block');
    const ok = await blockUser(targetUserId);
    if (ok) {
      setStatus(prev => prev ? { ...prev, is_blocked: true } : prev);
    }
    setActing(null);
    setShowBlockConfirm(false);
  };

  return (
    <div className="space-y-2.5 px-3 pb-3">
      {/* Relationship indicators */}
      <div className="flex flex-wrap items-center gap-1.5">
        {status.is_followed_by && !status.is_following && (
          <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/40">
            <BadgeCheck className="h-2.5 w-2.5" /> Follows You
          </span>
        )}
        {status.is_mutual && (
          <span className="flex items-center gap-1 rounded-full border border-[#c0911e]/20 bg-[#c0911e]/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: GOLD_SOFT }}>
            <Users className="h-2.5 w-2.5" /> Mutual Follow
          </span>
        )}
        {status.is_contact && (
          <span className="flex items-center gap-1 rounded-full border border-[#c0911e]/20 bg-[#c0911e]/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ color: GOLD_SOFT }}>
            <UserCheck className="h-2.5 w-2.5" /> Contact
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Follow / Following */}
        {!status.is_following ? (
          <button
            onClick={handleFollow}
            disabled={acting === 'follow'}
            className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[#c0911e]/[0.15]"
            style={{ color: GOLD_SOFT }}
          >
            {acting === 'follow' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            Follow
          </button>
        ) : (
          <button
            onClick={handleUnfollow}
            disabled={acting === 'follow'}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-all hover:text-white/70"
          >
            {acting === 'follow' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
            Following
          </button>
        )}

        {/* Contact actions */}
        {status.is_contact ? (
          <button
            onClick={handleRemoveContact}
            disabled={acting === 'contact'}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-all hover:text-white/70"
          >
            {acting === 'contact' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
            Remove Contact
          </button>
        ) : status.contact_request_pending ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
            Request Sent
          </span>
        ) : (
          <button
            onClick={handleAddContact}
            disabled={acting === 'contact'}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/60 transition-all hover:text-white/80"
          >
            {acting === 'contact' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            Add Contact
          </button>
        )}

        {/* Message — only if contact */}
        {status.is_contact && onMessage && (
          <button
            onClick={onMessage}
            className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[#c0911e]/[0.15]"
            style={{ color: GOLD_SOFT }}
          >
            <MessageSquare className="h-3 w-3" />
            Message
          </button>
        )}

        {/* Gift Spot */}
        {!status.is_blocked && (
          <button
            onClick={() => dispatchOpenGiftModal({ recipientId: targetUserId, recipientName: recipientName || 'this user' })}
            className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[#c0911e]/[0.15]"
            style={{ color: GOLD_SOFT }}
          >
            <Gift className="h-3 w-3" />
            Gift Spot
          </button>
        )}

        {/* Block */}
        {!showBlockConfirm ? (
          <button
            onClick={() => setShowBlockConfirm(true)}
            className="ml-auto flex items-center gap-1 rounded-lg border border-white/5 bg-transparent px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/20 transition-colors hover:text-white/40"
          >
            <UserX className="h-3 w-3" />
            Block
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleBlock}
              disabled={acting === 'block'}
              className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-red-400/70 transition-colors hover:bg-red-500/[0.12]"
            >
              {acting === 'block' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm Block'}
            </button>
            <button
              onClick={() => setShowBlockConfirm(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/40"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Accept/Decline for incoming contact requests */}
      {status.contact_request_pending && status.is_followed_by && !status.is_contact && (
        <div className="flex items-center gap-2 rounded-lg border border-[#c0911e]/15 bg-[#c0911e]/[0.03] px-3 py-2">
          <span className="text-[10px] text-white/50">Contact request from this user:</span>
          <button
            onClick={handleAcceptContact}
            disabled={acting === 'contact'}
            className="flex items-center gap-1 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: GOLD_SOFT }}
          >
            {acting === 'contact' ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
            Accept
          </button>
          <button
            onClick={handleDeclineContact}
            disabled={acting === 'contact'}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
