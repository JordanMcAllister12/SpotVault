import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Check, Clock, Calendar,
  ShieldCheck, Video, MessageSquare, Zap, DollarSign,
  Send, AlertCircle,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  type BookingProvider, type BookingService, type BookingTimeSlot,
  type Booking, type RequestType,
  fetchServicesByProvider, fetchTimeSlotsByProvider,
  fetchBookingSettings, createBooking,
  CATEGORY_LABELS, SERVICE_TYPE_LABELS, DURATION_OPTIONS, DAY_NAMES,
  calculateFees, formatPrice, makeIsoFromLocal, getUserTimezone,
  formatDateInZone, formatTimeInZone,
} from '@/lib/booking';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Props {
  provider: BookingProvider;
  account: SpotVaultAccount;
  onConfirmed: (booking: Booking) => void;
  onCancel: () => void;
}

export function UniversalBookingFlow({ provider, account, onConfirmed, onCancel }: Props) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [slots, setSlots] = useState<BookingTimeSlot[]>([]);
  const [settings, setSettings] = useState<{ platform_fee_rate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow state
  const [requestType, setRequestType] = useState<RequestType>('paid');
  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [step, setStep] = useState<'type' | 'service' | 'date' | 'time' | 'confirm' | 'request' | 'done'>('type');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Request form state
  const [requestMessage, setRequestMessage] = useState('');
  const [requestCompany, setRequestCompany] = useState('');
  const [requestDuration, setRequestDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const userTz = getUserTimezone();

  const load = useCallback(async () => {
    setLoading(true);
    const [svcs, sl, st] = await Promise.all([
      fetchServicesByProvider(provider.id),
      fetchTimeSlotsByProvider(provider.id),
      fetchBookingSettings(),
    ]);
    setServices(svcs);
    setSlots(sl);
    setSettings(st);
    // Default request type based on provider mode
    if (provider.booking_mode === 'meeting_requests') {
      setRequestType('meeting_request');
      setStep('request');
    } else {
      setRequestType('paid');
      setStep('service');
    }
    setLoading(false);
  }, [provider.id, provider.booking_mode]);

  useEffect(() => { load(); }, [load]);

  const acceptsPaid = provider.booking_mode === 'paid' || provider.booking_mode === 'both';
  const acceptsFree = provider.booking_mode === 'meeting_requests' || provider.booking_mode === 'both';

  // Generate available dates from recurring slots
  const availableDayOfWeek = useMemo(() => {
    const days = new Set<number>();
    for (const slot of slots) {
      if (slot.is_recurring && slot.day_of_week !== null) days.add(slot.day_of_week);
    }
    return days;
  }, [slots]);

  const availableSpecificDates = useMemo(() => {
    const dates = new Set<string>();
    for (const slot of slots) {
      if (!slot.is_recurring && slot.specific_date) dates.add(slot.specific_date);
    }
    return dates;
  }, [slots]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const isDayAvailable = (dayNum: number) => {
    const date = new Date(viewYear, viewMonth, dayNum);
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    if (dateStr < todayStr) return false;
    if (date > new Date(Date.now() + provider.max_advance_days * 24 * 60 * 60 * 1000)) return false;
    if (availableSpecificDates.has(dateStr)) return true;
    if (availableDayOfWeek.has(date.getDay())) return true;
    return false;
  };

  const timeSlotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const result: { start: string; end: string }[] = [];
    const date = new Date(selectedDate);
    const dow = date.getDay();
    for (const slot of slots) {
      if (slot.is_blackout) continue;
      if (slot.is_recurring && slot.day_of_week === dow) {
        result.push({ start: slot.start_time, end: slot.end_time });
      } else if (!slot.is_recurring && slot.specific_date === selectedDate) {
        result.push({ start: slot.start_time, end: slot.end_time });
      }
    }
    return result;
  }, [selectedDate, slots]);

  const generateSlotTimes = (start: string, end: string, durationMin: number): string[] => {
    const times: string[] = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let h = sh, m = sm;
    const endTotal = eh * 60 + em;
    while (h * 60 + m + durationMin <= endTotal) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += durationMin;
      while (m >= 60) { h += 1; m -= 60; }
    }
    return times;
  };

  const allSlotTimes = useMemo(() => {
    const duration = selectedService?.duration_minutes || requestDuration;
    const all: string[] = [];
    for (const slot of timeSlotsForDate) {
      all.push(...generateSlotTimes(slot.start, slot.end, duration));
    }
    return [...new Set(all)].sort();
  }, [timeSlotsForDate, selectedService, requestDuration]);

  const feeRate = settings?.platform_fee_rate ?? 0.20;
  const fees = selectedService ? calculateFees(selectedService.price_credits, feeRate) : null;

  const handleConfirmPaid = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    const startIso = makeIsoFromLocal(selectedDate, selectedTime);
    const endIso = new Date(new Date(startIso).getTime() + selectedService.duration_minutes * 60000).toISOString();
    const { booking, error: bErr } = await createBooking({
      provider_account_id: provider.account_id,
      requester_account_id: account.id,
      provider_id: provider.id,
      service_id: selectedService.id,
      service_name: selectedService.name,
      service_type: selectedService.service_type,
      start_time: startIso,
      end_time: endIso,
      duration_minutes: selectedService.duration_minutes,
      price_credits: selectedService.price_credits,
      platform_fee_credits: fees?.fee ?? 0,
      provider_payout_credits: fees?.payout ?? 0,
      payment_status: 'pending',
      booking_status: 'confirmed',
      request_type: 'paid',
    });
    setSubmitting(false);
    if (bErr) { setError(bErr); return; }
    if (booking) { setStep('done'); onConfirmed(booking); }
  };

  const handleSendRequest = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    const startIso = makeIsoFromLocal(selectedDate, selectedTime);
    const endIso = new Date(new Date(startIso).getTime() + requestDuration * 60000).toISOString();
    const { booking, error: bErr } = await createBooking({
      provider_account_id: provider.account_id,
      requester_account_id: account.id,
      provider_id: provider.id,
      service_id: null,
      service_name: null,
      service_type: null,
      start_time: startIso,
      end_time: endIso,
      duration_minutes: requestDuration,
      price_credits: 0,
      platform_fee_credits: 0,
      provider_payout_credits: 0,
      payment_status: 'n/a',
      booking_status: 'requested',
      request_type: 'meeting_request',
      message: requestMessage || null,
      company: requestCompany || null,
    });
    setSubmitting(false);
    if (bErr) { setError(bErr); return; }
    if (booking) { setStep('done'); onConfirmed(booking); }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-white/30">Loading booking flow…</div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
          <Check className="h-8 w-8 text-green-400" strokeWidth={2} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">
            {requestType === 'paid' ? 'Booking Confirmed' : 'Request Sent'}
          </h3>
          <p className="mt-1 text-sm text-white/40">
            {requestType === 'paid'
              ? 'Your session has been booked. Check My Bookings for details.'
              : 'Your meeting request has been sent. You will be notified when the provider responds.'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-6 py-2.5 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#c0911e]/25"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050608]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Cancel
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              {requestType === 'paid' ? 'Book a Session' : 'Request a Meeting'}
            </h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">
              {provider.display_name} · {CATEGORY_LABELS[provider.category] || provider.category}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
        <div className="mx-auto max-w-2xl">
          {/* Step: Type Selection (if both) */}
          {acceptsPaid && acceptsFree && step === 'type' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Choose an Option</h2>
              <div className="space-y-3">
                <button
                  onClick={() => { setRequestType('paid'); setStep('service'); }}
                  className="flex w-full items-center justify-between rounded-xl border border-[#232a32] bg-[#11151a] p-4 text-left transition-all hover:border-[#c0911e]/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-[#d4a52c]" />
                      <span className="text-sm font-bold text-white">Book a Paid Session</span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">Choose a session type, date, and time. Instant confirmation.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
                <button
                  onClick={() => { setRequestType('meeting_request'); setStep('request'); }}
                  className="flex w-full items-center justify-between rounded-xl border border-[#232a32] bg-[#11151a] p-4 text-left transition-all hover:border-[#c0911e]/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-bold text-white">Request a Meeting</span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">Send a meeting request with your preferred time and reason.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </button>
              </div>
            </div>
          )}

          {/* Step: Service Selection */}
          {step === 'service' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Select a Session Type</h2>
              {services.length === 0 ? (
                <p className="text-xs text-white/30">This provider has not listed any services yet.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s); setStep('date'); }}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                        selectedService?.id === s.id
                          ? 'border-[#c0911e]/50 bg-[#c0911e]/10'
                          : 'border-[#232a32] bg-[#11151a] hover:border-[#38424e]'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{s.name}</span>
                          <span className="rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-[#d4a52c] uppercase">
                            {SERVICE_TYPE_LABELS[s.service_type] || s.service_type}
                          </span>
                        </div>
                        {s.description && <p className="mt-1 text-xs text-white/40">{s.description}</p>}
                        <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_minutes} min</span>
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-[#d4a52c]" />{formatPrice(s.price_credits)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Date Selection */}
          {step === 'date' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Select a Date</h2>
              <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }}
                    className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <div className="text-sm font-bold text-white">{MONTHS[viewMonth]} {viewYear}</div>
                  <button
                    onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }}
                    className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const available = isDayAvailable(day);
                    const isSelected = selectedDate === dateStr;
                    return (
                      <button
                        key={day}
                        disabled={!available}
                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                        className={`aspect-square rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 text-[#f5e6b0]'
                            : available
                            ? 'border-[#232a32] bg-[#11151a] text-[#aab6c2] hover:border-[#38424e] hover:text-white'
                            : 'border-[#1a1f25] bg-[#0a0c0e] text-[#2a323b] cursor-not-allowed'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-3 text-[10px] text-white/30">
                Times shown in your timezone: {userTz}
              </p>
              {selectedDate && (
                <button
                  onClick={() => setStep('time')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all"
                >
                  Continue <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Step: Time Selection */}
          {step === 'time' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Select a Time</h2>
              <p className="mb-4 text-xs text-white/40">
                {formatDateInZone(selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(), userTz)} · Your time: {userTz}
              </p>
              {allSlotTimes.length === 0 ? (
                <p className="text-xs text-white/30">No available time slots for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {allSlotTimes.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                        selectedTime === slot
                          ? 'border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 text-[#f5e6b0]'
                          : 'border-[#232a32] bg-[#11151a] text-[#aab6c2] hover:border-[#38424e] hover:text-white'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
              {selectedTime && (
                <button
                  onClick={() => setStep(requestType === 'paid' ? 'confirm' : 'request')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all"
                >
                  Continue <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Step: Confirm (Paid) */}
          {step === 'confirm' && selectedService && selectedDate && selectedTime && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Confirm Booking</h2>
              <div className="rounded-xl border p-6" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
                <div className="flex items-center gap-3 border-b border-[#1a1f25] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">
                    {provider.photo_initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{provider.display_name}</span>
                      {provider.verified && <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />}
                    </div>
                    <div className="text-xs text-white/40">{selectedService.name}</div>
                  </div>
                </div>
                <div className="space-y-3 py-4">
                  <DetailRow icon={Calendar} label="Date" value={formatDateInZone(makeIsoFromLocal(selectedDate, selectedTime), userTz)} />
                  <DetailRow icon={Clock} label="Time" value={`${selectedTime} (${userTz})`} />
                  <DetailRow icon={Video} label="Type" value={SERVICE_TYPE_LABELS[selectedService.service_type] || selectedService.service_type} />
                  <DetailRow icon={Clock} label="Duration" value={`${selectedService.duration_minutes} minutes`} />
                </div>
                <div className="space-y-2 border-t border-[#1a1f25] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Session Price</span>
                    <span className="flex items-center gap-1 font-bold text-white">
                      <Zap className="h-3.5 w-3.5 text-[#d4a52c]" /> {formatPrice(selectedService.price_credits)}
                    </span>
                  </div>
                  {fees && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">SpotVault Fee ({Math.round(feeRate * 100)}%)</span>
                      <span className="text-white/50">{fees.fee} credits</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#1a1f25] pt-2 text-sm">
                    <span className="font-semibold text-[#aab6c2]">Total</span>
                    <span className="font-bold text-[#d4a52c]">{formatPrice(selectedService.price_credits)}</span>
                  </div>
                </div>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <button
                onClick={handleConfirmPaid}
                disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30 disabled:opacity-50"
              >
                {submitting ? 'Booking…' : <><Check className="h-4 w-4" strokeWidth={1.5} /> Book Session</>}
              </button>
            </div>
          )}

          {/* Step: Request Form (Non-monetized) */}
          {step === 'request' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Request a Meeting</h2>
              <div className="space-y-4 rounded-xl border p-6" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
                <div className="flex items-center gap-3 border-b border-[#1a1f25] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">
                    {provider.photo_initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{provider.display_name}</span>
                      {provider.verified && <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />}
                    </div>
                    <div className="text-xs text-white/40">{CATEGORY_LABELS[provider.category] || provider.category}</div>
                  </div>
                </div>

                {/* Date selection */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Preferred Date</label>
                  <input
                    type="date"
                    value={selectedDate || ''}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(null); }}
                    min={todayStr}
                    className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Requested Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setRequestDuration(d)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                          requestDuration === d
                            ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                            : 'border-[#232a32] bg-[#11151a] text-white/50 hover:border-[#38424e]'
                        }`}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time selection */}
                {selectedDate && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Preferred Time ({userTz})</label>
                    {allSlotTimes.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {allSlotTimes.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTime(slot)}
                            className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                              selectedTime === slot
                                ? 'border-[#c0911e]/50 bg-[#c0911e]/15 text-[#f5e6b0]'
                                : 'border-[#232a32] bg-[#11151a] text-[#aab6c2] hover:border-[#38424e]'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="time"
                        value={selectedTime || ''}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                      />
                    )}
                  </div>
                )}

                {/* Company/Project */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Company / Project (optional)</label>
                  <input
                    value={requestCompany}
                    onChange={(e) => setRequestCompany(e.target.value)}
                    placeholder="Your company or project name"
                    className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-white/40 uppercase">Reason for Meeting</label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    rows={3}
                    placeholder="Briefly describe why you would like to meet…"
                    className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                  />
                </div>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <button
                onClick={handleSendRequest}
                disabled={submitting || !selectedDate || !selectedTime}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : <><Send className="h-4 w-4" strokeWidth={1.5} /> Send Request</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-white/40">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
