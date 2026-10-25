import { Check, Calendar, Clock, Zap, ChevronRight, ShieldCheck } from 'lucide-react';
import type { Booking, TalentProfile } from '@/data/talent';

interface Props {
  booking: Booking;
  talent: TalentProfile;
  onOpenRoom: () => void;
  onBackToMarketplace: () => void;
}

export function BookingConfirmation({ booking, talent, onOpenRoom, onBackToMarketplace }: Props) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-lg">
        <div className="metal-frame-raised rounded-2xl border border-[#c0911e]/30 bg-gradient-to-b from-[#0e1115] to-[#0a0c0e] p-8 text-center">
          {/* Check icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d4a52c]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 shadow-[0_0_32px_rgba(212,165,44,0.3)]">
            <Check className="h-8 w-8 text-[#d4a52c]" strokeWidth={2} />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-white">Booking Confirmed</h1>
          <p className="mt-1 text-sm text-[#5f6e7c]">Your session has been booked and a private room has been created.</p>

          {/* Talent */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">
              {talent.photoInitials}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{talent.name}</span>
                <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" />
              </div>
              <div className="text-xs text-[#5f6e7c]">{booking.serviceName}</div>
            </div>
          </div>

          {/* Details */}
          <div className="mt-6 space-y-2 rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#5f6e7c]">
                <Calendar className="h-3.5 w-3.5" /> <span className="text-xs">Date</span>
              </div>
              <span className="text-sm font-medium text-white">{booking.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#5f6e7c]">
                <Clock className="h-3.5 w-3.5" /> <span className="text-xs">Time</span>
              </div>
              <span className="text-sm font-medium text-white">{booking.timeStart} – {booking.timeEnd}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#1a1f25] pt-2">
              <div className="flex items-center gap-2 text-[#5f6e7c]">
                <Zap className="h-3.5 w-3.5 text-[#d4a52c]" /> <span className="text-xs">Paid</span>
              </div>
              <span className="text-sm font-bold text-[#d4a52c]">{booking.priceCredits.toLocaleString()} credits</span>
            </div>
          </div>

          {/* CTAs */}
          <button
            onClick={onOpenRoom}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
          >
            Open Session Room <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={onBackToMarketplace}
            className="mt-2 w-full rounded-lg border border-[#232a32] bg-[#161b21] py-2.5 text-xs font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e] hover:text-white"
          >
            Back to Marketplace
          </button>
        </div>
      </div>
    </div>
  );
}
