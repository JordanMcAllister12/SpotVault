import { useState, useEffect, useCallback } from 'react';
import { UserCheck, X, Check, Loader2, ArrowLeft, BadgeCheck } from 'lucide-react';
import { getPendingContactRequests, acceptContact, declineContact } from '@/lib/authEngine';
import { fetchProfile, type UserProfile } from '@/lib/profileStore';
import { dispatchOpenProfile } from '@/lib/profileEvents';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface PendingRequest {
  relationship_id: string;
  requester_id: string;
  created_at: string;
}

interface EnrichedRequest extends PendingRequest {
  profile: UserProfile | null;
}

export function ContactRequestsPanel({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const pending = await getPendingContactRequests();
    const enriched = await Promise.all(
      pending.map(async (req) => {
        const profile = await fetchProfile(req.requester_id);
        return { ...req, profile };
      })
    );
    setRequests(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleAccept = async (relationshipId: string) => {
    setActingOn(relationshipId);
    const ok = await acceptContact(relationshipId);
    if (ok) {
      setRequests(prev => prev.filter(r => r.relationship_id !== relationshipId));
    }
    setActingOn(null);
  };

  const handleDecline = async (relationshipId: string) => {
    setActingOn(relationshipId);
    const ok = await declineContact(relationshipId);
    if (ok) {
      setRequests(prev => prev.filter(r => r.relationship_id !== relationshipId));
    }
    setActingOn(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <h2 className="text-sm font-bold text-white">Contact Requests</h2>
        {requests.length > 0 && (
          <span className="ml-auto rounded-full border border-[#c0911e]/20 bg-[#c0911e]/[0.06] px-2 py-0.5 text-[10px] font-bold" style={{ color: GOLD_SOFT }}>
            {requests.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        )}
        {!loading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-[12px] text-white/40">No pending contact requests</p>
            <p className="mt-1 text-[10px] text-white/25">
              When someone sends you a contact request, it will appear here.
            </p>
          </div>
        )}
        {requests.map(req => {
          const name = req.profile?.display_name || 'SpotVault User';
          const username = req.profile?.username;
          const avatar = req.profile?.avatar_url;
          const role = req.profile?.poker_role;
          const verified = req.profile?.is_verified;

          return (
            <div
              key={req.relationship_id}
              className="mb-2 rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { onClose(); dispatchOpenProfile(req.requester_id); }}
                  className="shrink-0"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-bold text-white/60">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { onClose(); dispatchOpenProfile(req.requester_id); }}
                      className="truncate text-[12px] font-semibold text-white hover:underline"
                    >
                      {name}
                    </button>
                    {verified && <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: GOLD }} />}
                  </div>
                  {username && <p className="truncate text-[10px] text-white/40">@{username}</p>}
                  {role && <p className="truncate text-[9px] text-white/30">{role}</p>}
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => handleAccept(req.relationship_id)}
                  disabled={actingOn === req.relationship_id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/[0.08] py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[#c0911e]/[0.15]"
                  style={{ color: GOLD_SOFT }}
                >
                  {actingOn === req.relationship_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(req.relationship_id)}
                  disabled={actingOn === req.relationship_id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-colors hover:text-white/70"
                >
                  <X className="h-3 w-3" />
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
