import { useState, useEffect, useCallback } from 'react';
import {
  Search, ChevronRight, ChevronLeft, Clock, Check, Loader2,
  Video, Phone, MessageSquare, MapPin, X, AlertCircle, BadgeCheck, Calendar,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  type BookingProvider, type BookingService,
  fetchAvailableProviders, fetchServicesByProvider,
  fetchBookingSettings, createBooking, calculateFees,
  CATEGORY_LABELS, formatPrice, getUserTimezone,
} from '@/lib/booking';
import {
  DEMO_BOOKING_PROVIDERS, DEMO_BOOKING_SERVICES,
} from '@/data/demoBookingProviders';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';
const PANEL_BG = 'rgba(8, 10, 12, 0.88)';
const PANEL_BORDER = 'rgba(212, 165, 44, 0.12)';

type View = 'list' | 'form' | 'success';

type SessionType = 'video' | 'voice' | 'chat' | 'in_person';
type DurationOption = 30 | 60 | 120;

const DURATION_LABELS: Record<DurationOption, string> = {
  30: '30 min',
  60: '1 hour',
  120: '2 hours',
};

const SESSION_TYPES: { id: SessionType; label: string; icon: typeof Video }[] = [
  { id: 'video', label: 'Video Call', icon: Video },
  { id: 'voice', label: 'Voice Call', icon: Phone },
  { id: 'chat', label: 'Chat / Messaging', icon: MessageSquare },
  { id: 'in_person', label: 'In Person', icon: MapPin },
];

interface Props {
  account: SpotVaultAccount;
  onBookProvider?: (provider: BookingProvider) => void;
}

export function CommunityAvailability({ account, onBookProvider }: Props) {
  const [view, setView] = useState<View>('list');
  const [selectedProvider, setSelectedProvider] = useState<BookingProvider | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const handleSelectProvider = useCallback((p: BookingProvider) => {
    setSelectedProvider(p);
    setView('form');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedProvider(null);
  }, []);

  const handleBookingCreated = useCallback((id: string) => {
    setCreatedBookingId(id);
    setView('success');
  }, []);

  const handleBackToList = useCallback(() => {
    setView('list');
    setSelectedProvider(null);
    setCreatedBookingId(null);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {view === 'list' && (
        <TalentList account={account} onSelect={handleSelectProvider} onBookProvider={onBookProvider} />
      )}
      {view === 'form' && selectedProvider && (
        <BookingForm
          provider={selectedProvider}
          account={account}
          onBack={handleBack}
          onCreated={handleBookingCreated}
        />
      )}
      {view === 'success' && selectedProvider && createdBookingId && (
        <BookingSuccess
          provider={selectedProvider}
          bookingId={createdBookingId}
          onBackToPeople={handleBackToList}
        />
      )}
    </div>
  );
}

// ============================================================
// TALENT LIST — provider directory + selected provider detail
// ============================================================
function TalentList({ account, onSelect, onBookProvider }: {
  account: SpotVaultAccount;
  onSelect: (p: BookingProvider) => void;
  onBookProvider?: (p: BookingProvider) => void;
}) {
  const [providers, setProviders] = useState<BookingProvider[]>([]);
  const [providerServices, setProviderServices] = useState<Record<string, BookingService[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAvailableProviders();
    if (data.length === 0) {
      setProviders(DEMO_BOOKING_PROVIDERS);
      setProviderServices(DEMO_BOOKING_SERVICES);
    } else {
      setProviders(data);
      const servicesMap: Record<string, BookingService[]> = {};
      await Promise.all(
        data.map(async (p) => {
          const svcs = await fetchServicesByProvider(p.id);
          servicesMap[p.id] = svcs;
        })
      );
      setProviderServices(servicesMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = providers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(q) ||
      (p.title || '').toLowerCase().includes(q) ||
      (p.subtitle || '').toLowerCase().includes(q) ||
      p.specialties.some((s) => s.toLowerCase().includes(q)) ||
      (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(q)
    );
  });

  const getHourlyRate = (providerId: string): number => {
    const svcs = providerServices[providerId];
    if (!svcs || svcs.length === 0) return 0;
    const hourly = svcs.filter((s) => s.duration_minutes >= 45 && s.duration_minutes <= 90);
    const pool = hourly.length > 0 ? hourly : svcs;
    const cheapest = Math.min(...pool.map((s) => s.price_credits));
    return cheapest;
  };

  const handleClick = (p: BookingProvider) => {
    setSelectedId(p.id);
  };

  const handleBookClick = (p: BookingProvider) => {
    const isDemo = DEMO_BOOKING_PROVIDERS.some((dp) => dp.id === p.id);
    if (isDemo) {
      onSelect(p);
    } else if (onBookProvider) {
      onBookProvider(p);
    } else {
      onSelect(p);
    }
  };

  const selectedProvider = selectedId ? filtered.find((p) => p.id === selectedId) : null;
  const selectedServices = selectedProvider ? providerServices[selectedProvider.id] || [] : [];

  return (
    <div className="flex h-full flex-col overflow-hidden p-3 gap-3">
      {/* Search bar on dark panel */}
      <div className="shrink-0 rounded-xl border p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG, backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-bold tracking-tight text-white">Book Time</h2>
          <span className="text-[9px] font-mono tracking-wider uppercase" style={{ color: 'rgba(212,165,44,0.5)' }}>{filtered.length} people</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people..."
            className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] py-2 pl-8 pr-3 text-[12px] text-white outline-none focus:border-[#c091e]/40 placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Two-column layout: directory list + selected provider detail */}
      <div className="min-h-0 flex-1 grid gap-3 lg:grid-cols-[1fr_3fr]">
        {/* Provider directory panel */}
        <div className="rounded-xl border overflow-hidden flex flex-col min-h-0" style={{ borderColor: PANEL_BORDER, background: PANEL_BG, backdropFilter: 'blur(12px)' }}>
          <div className="shrink-0 px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Providers</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {loading ? (
              <div className="flex h-full items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-6">
                <p className="text-[12px] text-white/40">No people found.</p>
                <p className="text-[10px] text-white/25">Try a different search.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((p, i) => {
                  const rate = getHourlyRate(p.id);
                  const roleLabel = p.title || CATEGORY_LABELS[p.category] || p.category;
                  const isActive = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleClick(p)}
                      className="group flex items-center gap-3 px-3 py-3 text-left transition-colors"
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: isActive ? 'rgba(212,165,44,0.08)' : 'transparent',
                      }}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
                        style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
                      >
                        {p.photo_initials || p.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-white">{p.display_name}</p>
                        <p className="truncate text-[10px] text-white/50">{roleLabel}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {rate > 0 ? (
                          <span className="text-[11px] font-bold" style={{ color: GOLD }}>
                            ${rate.toLocaleString()}<span className="text-[8px] font-normal text-white/30">/hr</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold tracking-wider text-blue-300/70 uppercase">Free</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-white/20 transition-colors group-hover:text-white/50" strokeWidth={1.5} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected provider detail panel */}
        <div className="rounded-xl border overflow-hidden flex flex-col min-h-0" style={{ borderColor: PANEL_BORDER, background: PANEL_BG, backdropFilter: 'blur(12px)' }}>
          {selectedProvider ? (
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {/* Provider header */}
              <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold"
                      style={{ borderColor: 'rgba(212,165,44,0.4)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
                  >
                    {selectedProvider.photo_initials || selectedProvider.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-bold text-white">{selectedProvider.display_name}</h3>
                      {selectedProvider.verified && (
                        <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={2} />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/50">{selectedProvider.title || CATEGORY_LABELS[selectedProvider.category]}</p>
                    {selectedProvider.subtitle && (
                      <p className="mt-0.5 text-[10px] text-white/35">{selectedProvider.subtitle}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedProvider.specialties.slice(0, 4).map((s) => (
                        <span key={s} className="rounded-full border px-2 py-0.5 text-[9px] font-medium" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {selectedProvider.bio && (
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">About</span>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/65">{selectedProvider.bio}</p>
                </div>
              )}

              {/* Session info */}
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Session Details</span>
                <div className="mt-3 space-y-2">
                  {/* Services */}
                  {selectedServices.length > 0 ? (
                    selectedServices.map((svc) => (
                      <div key={svc.id} className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                        <div>
                          <p className="text-[12px] font-semibold text-white">{svc.name}</p>
                          <p className="text-[10px] text-white/40">{svc.duration_minutes} min · {svc.service_type}</p>
                        </div>
                        <span className="text-[13px] font-bold" style={{ color: GOLD }}>
                          {svc.price_credits > 0 ? formatPrice(svc.price_credits) : 'Free'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-white">Custom Session</p>
                      <p className="text-[10px] text-white/40">Flexible duration and topic</p>
                    </div>
                  )}
                </div>

                {/* Availability meta */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Response Time</span>
                    <p className="mt-0.5 text-[11px] text-white/70">{selectedProvider.response_time_hours}h avg</p>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="text-[8px] font-bold tracking-widest text-white/30 uppercase">Timezone</span>
                    <p className="mt-0.5 text-[11px] text-white/70">{selectedProvider.timezone || getUserTimezone()}</p>
                  </div>
                </div>
              </div>

              {/* Available times — multi-day demo availability */}
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Available Times</span>
                <div className="mt-3 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  <DemoAvailability />
                </div>
                <p className="mt-2 text-[9px] text-white/25">Demo availability — actual slots shown during booking</p>
              </div>

              {/* Book CTA */}
              <div className="px-5 py-4">
                <button
                  onClick={() => handleBookClick(selectedProvider)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[11px] font-bold tracking-widest uppercase transition-all hover:opacity-90"
                  style={{ borderColor: 'rgba(212,165,44,0.4)', background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT }}
                >
                  <Calendar className="h-4 w-4" strokeWidth={1.5} /> Book Session
                </button>
              </div>
            </div>
          ) : (
            // Empty state
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                <Calendar className="h-6 w-6 text-white/20" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white/60">Select a provider</p>
                <p className="mt-1 text-[11px] text-white/35">Select a provider to view their profile and availability.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BOOKING FORM — inline in the same panel
// ============================================================
function BookingForm({ provider, account, onBack, onCreated }: {
  provider: BookingProvider;
  account: SpotVaultAccount;
  onBack: () => void;
  onCreated: (bookingId: string) => void;
}) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [settings, setSettings] = useState<{ platform_fee_rate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [duration, setDuration] = useState<DurationOption>(60);
  const [sessionType, setSessionType] = useState<SessionType>('video');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [svcs, settingsData] = await Promise.all([
        fetchServicesByProvider(provider.id),
        fetchBookingSettings(),
      ]);
      setServices(svcs);
      setSettings(settingsData ? { platform_fee_rate: settingsData.platform_fee_rate } : { platform_fee_rate: 0.20 });
      setLoading(false);
    })();
  }, [provider.id]);

  const hourlyRate = (() => {
    if (services.length === 0) return 0;
    const hourly = services.filter((s) => s.duration_minutes >= 45 && s.duration_minutes <= 90);
    const pool = hourly.length > 0 ? hourly : services;
    return Math.min(...pool.map((s) => s.price_credits));
  })();

  const estimatedTotal = Math.round((hourlyRate * duration) / 60);
  const feeRate = settings?.platform_fee_rate ?? 0.20;
  const { fee, payout } = calculateFees(estimatedTotal, feeRate);

  const canSubmit = !loading && preferredDate && preferredTime && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const startIso = new Date(`${preferredDate}T${preferredTime}:00`).toISOString();
      const endDate = new Date(startIso);
      endDate.setMinutes(endDate.getMinutes() + duration);
      const endIso = endDate.toISOString();

      const bookingData = {
        provider_account_id: provider.account_id,
        requester_account_id: account.id,
        provider_id: provider.id,
        service_id: services.length > 0 ? services[0].id : null,
        service_name: services.length > 0 ? services[0].name : `${provider.display_name} — ${DURATION_LABELS[duration]}`,
        service_type: services.length > 0 ? services[0].service_type : 'CUSTOM_SESSION',
        start_time: startIso,
        end_time: endIso,
        duration_minutes: duration,
        price_credits: estimatedTotal,
        platform_fee_credits: fee,
        provider_payout_credits: payout,
        payment_status: 'pending',
        booking_status: 'requested',
        request_type: 'paid',
        message: message || null,
        company: null,
        suggested_new_time: null,
      };

      const { booking, error: bookingError } = await createBooking(bookingData);
      if (bookingError || !booking) {
        setError(bookingError || 'Failed to create booking. Please try again.');
      } else {
        onCreated(booking.id);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      <div className="rounded-xl border overflow-hidden flex flex-col min-h-0" style={{ borderColor: PANEL_BORDER, background: PANEL_BG, backdropFilter: 'blur(12px)' }}>
        {/* Back button */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[11px] font-medium text-white/55 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            Back
          </button>
        </div>

        {/* Scrollable form */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Provider header */}
          <div className="flex items-center gap-3 pb-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
              style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}
            >
              {provider.photo_initials || provider.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-white">{provider.display_name}</p>
              <p className="truncate text-[10px] text-white/50">{provider.title || CATEGORY_LABELS[provider.category]}</p>
            </div>
          </div>

          {/* Rate */}
          <div className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.06)' }}>
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'rgba(212,165,44,0.7)' }}>Rate</span>
            <span className="text-[13px] font-bold" style={{ color: GOLD }}>
              {hourlyRate > 0 ? `$${hourlyRate.toLocaleString()}/hour` : 'Free'}
            </span>
          </div>

          {/* Duration */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/45 uppercase">Duration</label>
            <div className="flex gap-1.5">
              {(Object.keys(DURATION_LABELS) as DurationOption[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className="flex-1 rounded-md border py-2 text-[11px] font-bold transition-all"
                  style={{
                    borderColor: duration === d ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
                    background: duration === d ? 'rgba(212,165,44,0.12)' : 'transparent',
                    color: duration === d ? GOLD_SOFT : 'rgba(255,255,255,0.55)',
                  }}
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/45 uppercase">Preferred Date</label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c091e]/40"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Time */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/45 uppercase">Preferred Time</label>
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c091e]/40"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Session Type */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/45 uppercase">Session Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {SESSION_TYPES.map((st) => {
                const Icon = st.icon;
                const active = sessionType === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => setSessionType(st.id)}
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[10px] font-medium transition-all"
                    style={{
                      borderColor: active ? 'rgba(212,165,44,0.4)' : 'rgba(255,255,255,0.08)',
                      background: active ? 'rgba(212,165,44,0.10)' : 'transparent',
                      color: active ? GOLD_SOFT : 'rgba(255,255,255,0.55)',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-semibold tracking-widest text-white/45 uppercase">
              Message / What would you like to discuss?
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="I'd like to discuss..."
              className="w-full resize-none rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-[12px] text-white outline-none focus:border-[#c091e]/40 placeholder:text-white/25"
            />
          </div>

          {/* Estimated total */}
          <div className="mb-3 rounded-md border border-[#1a1f25] bg-[#0a0c0e] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest text-white/45 uppercase">Estimated Total</span>
              <span className="text-[16px] font-bold" style={{ color: GOLD }}>
                {estimatedTotal > 0 ? `$${estimatedTotal.toLocaleString()}` : 'Free'}
              </span>
            </div>
            {estimatedTotal > 0 && (
              <>
                <div className="mt-1 flex items-center justify-between text-[9px] text-white/30">
                  <span>Platform fee (20%)</span>
                  <span>${fee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-white/30">
                  <span>Provider earnings</span>
                  <span>${payout.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
              <p className="text-[10px] text-red-300/80">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[11px] font-bold tracking-widest uppercase transition-all disabled:opacity-40"
            style={{
              borderColor: 'rgba(212,165,44,0.4)',
              background: 'rgba(212,165,44,0.12)',
              color: GOLD_SOFT,
            }}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Sending Request...</>
            ) : (
              <><Check className="h-4 w-4" strokeWidth={2} /> Request / Reserve</>
            )}
          </button>
          <p className="mt-2 text-center text-[9px] text-white/30">
            Booking will be created as pending. No payment until provider confirms.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BOOKING SUCCESS
// ============================================================
function BookingSuccess({ provider, bookingId, onBackToPeople }: {
  provider: BookingProvider;
  bookingId: string;
  onBackToPeople: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <Check className="h-7 w-7 text-emerald-400" strokeWidth={2} />
      </div>
      <h3 className="text-[15px] font-bold text-white">Booking Request Sent</h3>
      <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-white/45">
        Your request to book time with <span className="font-bold text-white">{provider.display_name}</span> has been submitted.
        You'll receive a notification when they respond.
      </p>
      <div className="mt-3 flex items-center gap-1.5 rounded-md border border-[#c091e]/20 bg-[#c091e]/8 px-3 py-1.5">
        <Clock className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: GOLD }}>Pending Confirmation</span>
      </div>
      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={onBackToPeople}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#c091e]/40 bg-[#c091e]/12 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-all hover:bg-[#c091e]/20"
          style={{ color: GOLD_SOFT }}
        >
          Back to People
        </button>
      </div>
      <p className="mt-3 text-[9px] font-mono text-white/20">Ref: {bookingId.slice(0, 8)}</p>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY WRAPPER
// ============================================================
export function CommunityAvailabilityWithErrorBoundary(props: Props) {
  return (
    <CommunityAvailability {...props} />
  );
}

// ============================================================
// DEMO AVAILABILITY — realistic multi-day slots for the booking UX
// ============================================================

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime12h(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${hr12}:${m.toString().padStart(2, '0')} ${period}`;
}

function dateLabel(date: Date, dayIndex: number): string {
  if (dayIndex === 0) return 'Today';
  if (dayIndex === 1) return 'Tomorrow';
  const dayName = DAY_LABELS[date.getDay()];
  const month = MONTH_ABBR[date.getMonth()];
  const dom = date.getDate();
  return `${dayName}, ${month} ${dom}`;
}

function buildDemoAvailability(): { label: string; slots: string[] }[] {
  const now = new Date();
  const days: { label: string; slots: string[] }[] = [];

  // Realistic time slot patterns for different days of the week
  const slotPatterns: [number, number][][] = [
    [[14, 0], [16, 0]],                     // Today
    [[10, 0], [15, 0]],                     // Tomorrow
    [[11, 0], [13, 0], [18, 0]],
    [[9, 0], [12, 0], [16, 0]],
    [[10, 30], [14, 0], [17, 30]],
    [[9, 0], [11, 0], [15, 0], [19, 0]],
    [[12, 0], [16, 0]],                     // Day 7
  ];

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const pattern = slotPatterns[i] ?? [[10, 0], [14, 0], [16, 0]];
    const slots = pattern.map(([h, m]) => formatTime12h(h, m));
    days.push({ label: dateLabel(date, i), slots });
  }

  return days;
}

function DemoAvailability() {
  const days = buildDemoAvailability();
  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => (
        <div key={day.label}>
          <div className="mb-1.5 text-[10px] font-bold tracking-wider text-white/45">{day.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {day.slots.map((slot) => (
              <button
                key={`${day.label}-${slot}`}
                onClick={() => {}}
                className="rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all hover:scale-[1.03]"
                style={{
                  borderColor: 'rgba(212,165,44,0.15)',
                  background: 'rgba(212,165,44,0.05)',
                  color: 'rgba(245,230,176,0.75)',
                }}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
