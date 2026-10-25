import { useState, useEffect, useCallback } from 'react';
import { Inbox, MessageSquare, Handshake, Calendar, Briefcase, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,11,14,0.92)';

interface Inquiry {
  id: string;
  type: string;
  from_name: string;
  subject: string;
  created_at: string;
  status: string;
}

const TYPE_ICONS: Record<string, typeof Inbox> = {
  business_inquiry: MessageSquare,
  partnership: Handshake,
  sponsorship: Briefcase,
  meeting: Calendar,
  service_request: Briefcase,
  opportunity: Handshake,
  creator_response: MessageSquare,
};

const DEMO_INQUIRIES: Inquiry[] = [
  { id: 'i1', type: 'partnership', from_name: 'PokerNews', subject: 'Partnership discussion for Q4', created_at: new Date(Date.now() - 3600000).toISOString(), status: 'new' },
  { id: 'i2', type: 'sponsorship', from_name: 'Alex "TheShark" Rivera', subject: 'Sponsorship opportunity', created_at: new Date(Date.now() - 7200000).toISOString(), status: 'new' },
  { id: 'i3', type: 'service_request', from_name: 'Sarah M.', subject: 'Inquiry about marketing services', created_at: new Date(Date.now() - 86400000).toISOString(), status: 'pending' },
  { id: 'i4', type: 'creator_response', from_name: 'Marcus "StreamGod" Williams', subject: 'Re: Brand collaboration', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'pending' },
];

export function InquiriesWidget({ accountId }: { accountId: string | null }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accountId) { setInquiries(DEMO_INQUIRIES); setLoading(false); return; }
    setInquiries(DEMO_INQUIRIES);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'rgba(192,145,30,0.1)', border: '1px solid rgba(192,145,30,0.15)' }}>
            <Inbox className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Inquiries</span>
        </div>
        {inquiries.filter(i => i.status === 'new').length > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: 'rgba(192,145,30,0.15)', color: GOLD }}>
            {inquiries.filter(i => i.status === 'new').length} new
          </span>
        )}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" /></div>
        ) : inquiries.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] text-white/30">No inquiries yet.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
            {inquiries.map((inq) => {
              const Icon = TYPE_ICONS[inq.type] ?? MessageSquare;
              return (
                <div key={inq.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-semibold text-white/75">{inq.from_name}</span>
                      {inq.status === 'new' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
                    </div>
                    <p className="truncate text-[10px] text-white/40">{inq.subject}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" strokeWidth={1.5} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
