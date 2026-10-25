import { useState, useCallback } from 'react';
import { X, Send, MessageCircle, Users, Coffee } from 'lucide-react';
import type { HandShareRef, ShareDestination } from '@/lib/handShareStore';
import { shareHandToCommunity, shareHandToLounge, shareHandToGroupChat, shareHandToDM } from '@/lib/handShareStore';

interface ShareHandModalProps {
  open: boolean;
  onClose: () => void;
  handRef: HandShareRef | null;
  authorId: string;
  authorName: string;
  authorRole: string;
  onShared?: () => void;
}

export function ShareHandModal({ open, onClose, handRef, authorId, authorName, authorRole, onShared }: ShareHandModalProps) {
  const [destination, setDestination] = useState<ShareDestination>('community');
  const [comment, setComment] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleShare = useCallback(async () => {
    if (!handRef) return;
    setSharing(true);
    setError(null);
    setSuccess(false);

    try {
      if (destination === 'community') {
        const ok = await shareHandToCommunity(authorId, authorName, authorRole, handRef, comment.trim());
        if (!ok) { setError('Failed to share to Community. You may need feed posting approval.'); return; }
      } else if (destination === 'dm') {
        if (!recipientUsername.trim()) { setError('Enter a recipient username.'); return; }
        const { supabase } = await import('@/lib/supabase');
        const { data: profile, error: pErr } = await supabase
          .from('user_profiles')
          .select('user_id')
          .ilike('username', recipientUsername.trim())
          .maybeSingle();
        if (pErr || !profile) { setError('User not found.'); return; }
        const recipientId = (profile as { user_id: string }).user_id;
        const ok = await shareHandToDM(authorId, authorName, recipientId, handRef, comment.trim());
        if (!ok) { setError('Failed to send DM.'); return; }
      } else if (destination === 'lounge') {
        const ok = await shareHandToLounge(authorId, authorName, authorRole, handRef, comment.trim(), 'manitoba-poker');
        if (!ok) { setError('Failed to share to Lounge.'); return; }
      } else if (destination === 'group-chat') {
        const ok = await shareHandToGroupChat(authorId, authorName, authorRole, handRef, comment.trim());
        if (!ok) { setError('Failed to share to group chat.'); return; }
      }
      setSuccess(true);
      onShared?.();
      setTimeout(() => { onClose(); setSuccess(false); setComment(''); setRecipientUsername(''); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSharing(false);
    }
  }, [handRef, destination, comment, recipientUsername, authorId, authorName, authorRole, onShared, onClose]);

  if (!open || !handRef) return null;

  const destinations: { id: ShareDestination; label: string; icon: typeof Users }[] = [
    { id: 'community', label: 'Community Feed', icon: Users },
    { id: 'lounge', label: 'Lounge', icon: Coffee },
    { id: 'group-chat', label: 'Group Chat', icon: MessageCircle },
    { id: 'dm', label: 'Direct Message', icon: Send },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border p-5"
        style={{ background: 'rgba(10,12,14,0.96)', border: '1px solid rgba(192,145,30,0.2)', boxShadow: '0 20px 60px -20px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Share Hand</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/60"><X size={16} /></button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Destination</p>
          <div className="grid grid-cols-2 gap-2">
            {destinations.map(d => {
              const Icon = d.icon;
              const active = destination === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDestination(d.id)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${active ? 'rgba(201,162,39,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: active ? '#d4a52c' : '#6b7280',
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {destination === 'dm' && (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Recipient Username</p>
            <input
              value={recipientUsername}
              onChange={e => setRecipientUsername(e.target.value)}
              placeholder="username"
              className="w-full rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/30"
            />
          </div>
        )}

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Comment (optional)</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Do you guys barrel this turn?"
            rows={3}
            className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[12px] text-white/80 outline-none focus:border-[#c0911e]/30"
          />
        </div>

        {error && <p className="mb-3 text-[11px] text-red-400/80">{error}</p>}
        {success && <p className="mb-3 text-[11px] text-green-400/80">Shared successfully!</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[11px] font-semibold text-white/50 hover:text-white/70">
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || success}
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
            style={{ borderColor: 'rgba(201,162,39,0.35)', background: 'rgba(201,162,39,0.15)', color: '#d4a52c' }}
          >
            <Send size={12} strokeWidth={2} />
            {sharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
