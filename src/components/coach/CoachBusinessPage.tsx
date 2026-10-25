import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CoachProfileBuilder } from '@/components/coach/CoachProfileBuilder';
import { CoachAvailabilityView } from '@/components/coach/CoachAvailabilityView';
import { CoachResultsGallery } from '@/components/coach/CoachResultsGallery';
import { CoachReviewsView } from '@/components/coach/CoachReviewsView';
import { CoachApplicationWizard } from '@/components/coach/CoachApplicationWizard';
import { CoachBookingRequests } from '@/components/coach/CoachBookingRequests';
import { ProfessionalListingForm } from '@/components/professional/ProfessionalListingForm';
import { PromotionComposer } from '@/components/professional/PromotionComposer';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

interface Props {
  account: { id: string; name: string };
  initialTab?: Tab;
}

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const SECTION_BG = 'rgba(8,10,12,0.82)';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'availability', label: 'Availability' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'results', label: 'Results' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'listing', label: 'Listing' },
  { id: 'apply', label: 'Apply' },
  { id: 'customize', label: 'Customize' },
] as const;

type Tab = typeof TABS[number]['id'];

function useHasCoachListing(account: { id: string }) {
  const [hasListing, setHasListing] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? account.id;
    const { data } = await supabase
      .from('coach_listings')
      .select('id')
      .eq('account_id', userId)
      .maybeSingle();
    setHasListing(!!data);
  }, [account.id]);

  useEffect(() => { void check(); }, [check]);

  return hasListing;
}

export function CoachBusinessPage({ account, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'profile');
  const [customMessage, setCustomMessage] = useState('');
  const [customSent, setCustomSent] = useState(false);
  const hasListing = useHasCoachListing(account);

  return (
    <PortalWorkspaceShell maxWidth="max-w-5xl">
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        {/* Tabs */}
        <div className="mx-4 mt-3 mb-2 flex gap-1 rounded-xl px-3 backdrop-blur-md"
          style={{ background: 'rgba(10,12,14,0.78)', border: '1px solid rgba(192,145,30,0.18)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                tab === t.id
                  ? 'border-[#d4a52c] text-[#f5e6b0]'
                  : 'border-transparent text-[#5f6e7c] hover:text-[#84929f]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Already-approved coach banner */}
        {hasListing === true && tab === 'profile' && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-[#4ade80]/20 bg-[#4ade80]/5 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#4ade80' }} />
            <span className="text-[10px] font-semibold text-[#4ade80]/80">You are an approved coach. Your profile is already active — no application needed.</span>
          </div>
        )}

        {/* Tab content */}
        <div className="p-4">
          {tab === 'profile' && <CoachProfileBuilder account={account} />}
          {tab === 'availability' && <CoachAvailabilityView account={account} />}
          {tab === 'bookings' && <CoachBookingRequests account={account} />}
          {tab === 'results' && <CoachResultsGallery account={account} />}
          {tab === 'reviews' && <CoachReviewsView account={account} />}
          {tab === 'apply' && <CoachApplicationWizard account={account} />}
          {tab === 'listing' && (
            <div className="space-y-6">
              <ProfessionalListingForm portalType="coach-portal" userId={account.id} displayName={account.name} />
              <div className="border-t border-white/[0.06] pt-4">
                <PromotionComposer portalType="coach-portal" />
              </div>
            </div>
          )}
          {tab === 'customize' && (
            <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: SECTION_BG, backdropFilter: 'blur(8px)' }}>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
                <h3 className="text-sm font-bold text-white">Customize Your Portal</h3>
              </div>
              <p className="mb-4 text-[12px] leading-relaxed text-white/55">
                Need something specific for your coaching business? SpotVault Coach Portals can be configured
                around your workflow. Request additional tools, reports, integrations or custom functionality.
              </p>
              <p className="mb-4 text-[11px] text-white/40">
                Additional customization or development fees may apply depending on scope.
              </p>
              {customSent ? (
                <div className="rounded-lg border border-[#d4a52c]/30 bg-[#c0911e]/10 p-4 text-center">
                  <p className="text-[12px] font-semibold text-[#f5e6b0]">
                    Request submitted. The SpotVault team will review your request and follow up.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Describe what you need — tools, reports, integrations, or custom functionality..."
                    className="h-28 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/80 placeholder-white/25 focus:border-[#d4a52c]/40 focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!customMessage.trim()) return;
                      setCustomSent(true);
                    }}
                    disabled={!customMessage.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/50 bg-[#c0911e]/20 px-4 py-2.5 text-[10px] font-bold uppercase text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <Send className="h-3.5 w-3.5" /> Request Customization
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </PortalWorkspaceShell>
  );
}
