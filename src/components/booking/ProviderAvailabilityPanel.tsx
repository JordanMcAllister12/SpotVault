import { useState, useEffect, useCallback } from 'react';
import {
  Power, Plus, Trash2, Clock, Calendar, DollarSign, ShieldCheck,
  ChevronDown, ChevronUp, Save, Check, X, GraduationCap, Briefcase,
  Mic, TrendingUp, Users, Video, Phone, MessageSquare, Star,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import {
  type BookingProvider, type BookingService, type BookingTimeSlot,
  type BookingMode, type ServiceType,
  fetchProviderByAccountId, fetchServicesByProvider, fetchTimeSlotsByProvider,
  upsertProvider, addService, updateService, deleteService,
  addTimeSlot, deleteTimeSlot,
  CATEGORY_LABELS, SERVICE_TYPE_LABELS, DURATION_OPTIONS, DAY_NAMES,
  calculateFees, formatPrice,
} from '@/lib/booking';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const CATEGORY_OPTIONS = [
  { value: 'COACH', label: 'Coach', icon: GraduationCap },
  { value: 'CREATOR', label: 'Creator', icon: Mic },
  { value: 'POKER_PRO', label: 'Poker Pro', icon: Star },
  { value: 'BUSINESS', label: 'Business', icon: Briefcase },
  { value: 'INVESTOR', label: 'Investor', icon: TrendingUp },
  { value: 'INDUSTRY_EXPERT', label: 'Industry Executive', icon: Users },
];

const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'COACHING', label: 'Coaching' },
  { value: 'STRATEGY_SESSION', label: 'Strategy Session' },
  { value: 'CAREER_ADVICE', label: 'Career Advice' },
  { value: 'BUSINESS_CONSULTATION', label: 'Business Consultation' },
  { value: 'INDUSTRY_NETWORKING', label: 'Industry Networking' },
  { value: 'CONTENT_COLLABORATION', label: 'Content Collaboration' },
  { value: 'PRIVATE_CONVERSATION', label: 'Private Conversation' },
  { value: 'VIDEO_CALL', label: 'Video Call' },
  { value: 'VOICE_CALL', label: 'Voice Call' },
  { value: 'TEXT_CHAT', label: 'Text Chat' },
  { value: 'HAND_HISTORY_REVIEW', label: 'Hand History Review' },
  { value: 'TOURNAMENT_REVIEW', label: 'Tournament Review' },
  { value: 'DATABASE_REVIEW', label: 'Database Review' },
  { value: 'SWEAT_SESSION', label: 'Sweat Session' },
  { value: 'CUSTOM_SESSION', label: 'Custom Session' },
];

interface Props {
  account: SpotVaultAccount;
}

export function ProviderAvailabilityPanel({ account }: Props) {
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [services, setServices] = useState<BookingService[]>([]);
  const [slots, setSlots] = useState<BookingTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Form state
  const [isAvailable, setIsAvailable] = useState(false);
  const [bookingMode, setBookingMode] = useState<BookingMode>('paid');
  const [displayName, setDisplayName] = useState(account.name);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('COACH');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [minNotice, setMinNotice] = useState(12);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [maxDaily, setMaxDaily] = useState(5);
  const [maxWeekly, setMaxWeekly] = useState(20);
  const [bookingNotes, setBookingNotes] = useState('');
  const [specialties, setSpecialties] = useState('');

  // New service form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [newService, setNewService] = useState({
    name: '', description: '', service_type: 'COACHING' as string,
    duration_minutes: 60, price_credits: 200, includes_messaging: true,
    allows_file_upload: false, cancellation_hours: 24, lead_time_hours: 12,
  });

  // New slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [newSlot, setNewSlot] = useState({
    is_recurring: true, day_of_week: 1, specific_date: '',
    start_time: '18:00', end_time: '21:00',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const p = await fetchProviderByAccountId(account.id);
    if (p) {
      setProvider(p);
      setIsAvailable(p.is_available);
      setBookingMode(p.booking_mode as BookingMode);
      setDisplayName(p.display_name);
      setTitle(p.title || '');
      setSubtitle(p.subtitle || '');
      setCategory(p.category);
      setBio(p.bio || '');
      setTimezone(p.timezone);
      setMinNotice(p.min_notice_hours);
      setMaxAdvance(p.max_advance_days);
      setMaxDaily(p.max_daily_bookings);
      setMaxWeekly(p.max_weekly_bookings);
      setBookingNotes(p.booking_notes || '');
      setSpecialties(p.specialties.join(', '));
      const [ss, sl2] = await Promise.all([
        fetchServicesByProvider(p.id),
        fetchTimeSlotsByProvider(p.id),
      ]);
      setServices(ss);
      setSlots(sl2);
    } else {
      setServices([]);
      setSlots([]);
    }
    setLoading(false);
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    await upsertProvider({
      account_id: account.id,
      display_name: displayName,
      title: title || null,
      subtitle: subtitle || null,
      category,
      bio: bio || null,
      photo_initials: displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      verified: provider?.verified ?? false,
      is_available: isAvailable,
      booking_mode: bookingMode,
      timezone,
      min_notice_hours: minNotice,
      max_advance_days: maxAdvance,
      max_daily_bookings: maxDaily,
      max_weekly_bookings: maxWeekly,
      booking_notes: bookingNotes || null,
      eligibility_role: provider?.eligibility_role ?? 'coach',
      specialties: specialties.split(',').map(s => s.trim()).filter(Boolean),
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    load();
  };

  const handleAddService = async () => {
    if (!provider) return;
    await addService({
      provider_id: provider.id,
      name: newService.name,
      description: newService.description || null,
      service_type: newService.service_type,
      duration_minutes: newService.duration_minutes,
      price_credits: newService.price_credits,
      is_active: true,
      includes_messaging: newService.includes_messaging,
      allows_file_upload: newService.allows_file_upload,
      cancellation_hours: newService.cancellation_hours,
      lead_time_hours: newService.lead_time_hours,
      max_per_day: maxDaily,
      max_per_week: maxWeekly,
    });
    setNewService({
      name: '', description: '', service_type: 'COACHING',
      duration_minutes: 60, price_credits: 200, includes_messaging: true,
      allows_file_upload: false, cancellation_hours: 24, lead_time_hours: 12,
    });
    setShowServiceForm(false);
    load();
  };

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    load();
  };

  const handleAddSlot = async () => {
    if (!provider) return;
    await addTimeSlot({
      provider_id: provider.id,
      day_of_week: newSlot.is_recurring ? newSlot.day_of_week : null,
      specific_date: newSlot.is_recurring ? null : newSlot.specific_date || null,
      start_time: newSlot.start_time,
      end_time: newSlot.end_time,
      is_recurring: newSlot.is_recurring,
      is_blackout: false,
    });
    setNewSlot({ ...newSlot, specific_date: '' });
    setShowSlotForm(false);
    load();
  };

  const handleDeleteSlot = async (id: string) => {
    await deleteTimeSlot(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-white/30">Loading availability settings…</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">My Availability</h2>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/60 uppercase">
              Booking Marketplace · Provider Settings
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-50"
          >
            {savedFlash ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Save className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save'}
          </button>
        </div>

        {/* Availability toggle */}
        <Section title="Availability Status" icon={Power}>
          <div className="flex items-center justify-between rounded-lg border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            <div>
              <div className="text-sm font-semibold text-white">Available for Bookings</div>
              <div className="text-xs text-white/40">Turn on to let users discover and request your time</div>
            </div>
            <button
              onClick={() => setIsAvailable(!isAvailable)}
              className="relative h-7 w-12 rounded-full border transition-all"
              style={{
                background: isAvailable ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)',
                borderColor: isAvailable ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <div
                className="absolute top-0.5 h-6 w-6 rounded-full transition-all"
                style={{
                  left: isAvailable ? '22px' : '2px',
                  background: isAvailable ? '#34d399' : '#5f6e7c',
                }}
              />
            </button>
          </div>
        </Section>

        {/* Profile */}
        <Section title="Provider Profile" icon={Star}>
          <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            <Field label="Display Name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Professional Poker Coach"
                  className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                />
              </Field>
              <Field label="Subtitle">
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Tournament Specialist · ICM Expert"
                  className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                />
              </Field>
            </div>
            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                      category === c.value
                        ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                        : 'border-[#232a32] bg-[#11151a] text-[#84929f] hover:border-[#38424e]'
                    }`}
                  >
                    <c.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell users about your experience and what you offer…"
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
              />
            </Field>
            <Field label="Specialties (comma-separated)">
              <input
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="Strategy, ICM, Mental Game"
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
              />
            </Field>
          </div>
        </Section>

        {/* Booking Mode */}
        <Section title="Booking Mode" icon={ShieldCheck}>
          <div className="space-y-2 rounded-lg border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            {[
              { value: 'paid' as BookingMode, label: 'Paid Bookings Only', desc: 'Users pay to book your time' },
              { value: 'meeting_requests' as BookingMode, label: 'Meeting Requests Only', desc: 'Users request time without payment' },
              { value: 'both' as BookingMode, label: 'Paid + Meeting Requests', desc: 'Accept both paid bookings and free requests' },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setBookingMode(m.value)}
                className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-all ${
                  bookingMode === m.value
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/10'
                    : 'border-[#232a32] bg-[#11151a] hover:border-[#38424e]'
                }`}
              >
                <div>
                  <div className={`text-sm font-semibold ${bookingMode === m.value ? 'text-[#f5e6b0]' : 'text-white'}`}>{m.label}</div>
                  <div className="text-xs text-white/40">{m.desc}</div>
                </div>
                <div
                  className="h-4 w-4 rounded-full border-2"
                  style={{
                    borderColor: bookingMode === m.value ? '#d4a52c' : '#38424e',
                    background: bookingMode === m.value ? '#d4a52c' : 'transparent',
                  }}
                />
              </button>
            ))}
          </div>
        </Section>

        {/* Scheduling Rules */}
        <Section title="Scheduling Rules" icon={Clock}>
          <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 sm:grid-cols-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            <Field label="Min Notice (hrs)">
              <input type="number" value={minNotice} onChange={(e) => setMinNotice(Number(e.target.value))}
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40" />
            </Field>
            <Field label="Max Advance (days)">
              <input type="number" value={maxAdvance} onChange={(e) => setMaxAdvance(Number(e.target.value))}
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40" />
            </Field>
            <Field label="Max Daily">
              <input type="number" value={maxDaily} onChange={(e) => setMaxDaily(Number(e.target.value))}
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40" />
            </Field>
            <Field label="Max Weekly">
              <input type="number" value={maxWeekly} onChange={(e) => setMaxWeekly(Number(e.target.value))}
                className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40" />
            </Field>
            <div className="col-span-2 sm:col-span-4">
              <Field label="Booking Notes / Instructions">
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  rows={2}
                  placeholder="Any instructions for users booking your time…"
                  className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* Services */}
        <Section title="Interaction Types" icon={Video}>
          <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            {services.length === 0 && !showServiceForm && (
              <div className="py-6 text-center text-xs text-white/30">
                No services yet. Add your first interaction type below.
              </div>
            )}
            {services.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-[#232a32] bg-[#0a0c0e] p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{s.name}</span>
                    <span className="rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#d4a52c] uppercase">
                      {SERVICE_TYPE_LABELS[s.service_type] || s.service_type}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatPrice(s.price_credits)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteService(s.id)}
                  className="rounded-md border border-[#232a32] p-1.5 text-white/30 transition-all hover:border-red-500/30 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {showServiceForm && (
              <div className="space-y-3 rounded-md border border-[#c0911e]/20 bg-[#0a0c0e] p-4">
                <Field label="Session Name">
                  <input
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    placeholder="60 Minute Strategy Session"
                    className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    rows={2}
                    placeholder="What does this session include?"
                    className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select
                      value={newService.service_type}
                      onChange={(e) => setNewService({ ...newService, service_type: e.target.value })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    >
                      {SERVICE_TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Duration (min)">
                    <select
                      value={newService.duration_minutes}
                      onChange={(e) => setNewService({ ...newService, duration_minutes: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d} minutes</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (credits)">
                    <input
                      type="number"
                      value={newService.price_credits}
                      onChange={(e) => setNewService({ ...newService, price_credits: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </Field>
                  <Field label="Cancellation (hrs)">
                    <input
                      type="number"
                      value={newService.cancellation_hours}
                      onChange={(e) => setNewService({ ...newService, cancellation_hours: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input type="checkbox" checked={newService.includes_messaging}
                      onChange={(e) => setNewService({ ...newService, includes_messaging: e.target.checked })} />
                    Includes messaging
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input type="checkbox" checked={newService.allows_file_upload}
                      onChange={(e) => setNewService({ ...newService, allows_file_upload: e.target.checked })} />
                    File upload
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddService}
                    disabled={!newService.name}
                    className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#c0911e]/25 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Add Service
                  </button>
                  <button
                    onClick={() => setShowServiceForm(false)}
                    className="rounded-md border border-[#232a32] px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:border-[#38424e]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showServiceForm && (
              <button
                onClick={() => setShowServiceForm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#232a32] py-2.5 text-xs font-medium text-white/40 transition-all hover:border-[#c0911e]/30 hover:text-[#d4a52c]"
              >
                <Plus className="h-3.5 w-3.5" /> Add Interaction Type
              </button>
            )}
          </div>
        </Section>

        {/* Time Slots */}
        <Section title="Time Slots" icon={Calendar}>
          <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            {slots.length === 0 && !showSlotForm && (
              <div className="py-6 text-center text-xs text-white/30">
                No time slots yet. Add your availability below.
              </div>
            )}
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between rounded-md border border-[#232a32] bg-[#0a0c0e] p-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-[#d4a52c] uppercase">
                    {slot.is_recurring ? 'Weekly' : 'One-time'}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {slot.is_recurring
                      ? DAY_NAMES[slot.day_of_week ?? 0]
                      : slot.specific_date}
                  </span>
                  <span className="text-xs text-white/40">
                    {slot.start_time} – {slot.end_time}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="rounded-md border border-[#232a32] p-1.5 text-white/30 transition-all hover:border-red-500/30 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {showSlotForm && (
              <div className="space-y-3 rounded-md border border-[#c0911e]/20 bg-[#0a0c0e] p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewSlot({ ...newSlot, is_recurring: true })}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                      newSlot.is_recurring
                        ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                        : 'border-[#232a32] bg-[#11151a] text-white/50'
                    }`}
                  >
                    Recurring Weekly
                  </button>
                  <button
                    onClick={() => setNewSlot({ ...newSlot, is_recurring: false })}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-all ${
                      !newSlot.is_recurring
                        ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                        : 'border-[#232a32] bg-[#11151a] text-white/50'
                    }`}
                  >
                    Specific Date
                  </button>
                </div>
                {newSlot.is_recurring ? (
                  <Field label="Day of Week">
                    <select
                      value={newSlot.day_of_week}
                      onChange={(e) => setNewSlot({ ...newSlot, day_of_week: Number(e.target.value) })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    >
                      {DAY_NAMES.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Date">
                    <input
                      type="date"
                      value={newSlot.specific_date}
                      onChange={(e) => setNewSlot({ ...newSlot, specific_date: e.target.value })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Time">
                    <input
                      type="time"
                      value={newSlot.start_time}
                      onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </Field>
                  <Field label="End Time">
                    <input
                      type="time"
                      value={newSlot.end_time}
                      onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                      className="w-full rounded-md border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-sm text-white outline-none focus:border-[#c0911e]/40"
                    />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSlot}
                    className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/40 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#c0911e]/25"
                  >
                    <Check className="h-3.5 w-3.5" /> Add Slot
                  </button>
                  <button
                    onClick={() => setShowSlotForm(false)}
                    className="rounded-md border border-[#232a32] px-4 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:border-[#38424e]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showSlotForm && (
              <button
                onClick={() => setShowSlotForm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#232a32] py-2.5 text-xs font-medium text-white/40 transition-all hover:border-[#c0911e]/30 hover:text-[#d4a52c]"
              >
                <Plus className="h-3.5 w-3.5" /> Add Time Slot
              </button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Power; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.3)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-xs font-bold tracking-widest text-white/70 uppercase">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold tracking-widest text-white/40 uppercase">{label}</label>
      {children}
    </div>
  );
}

export function ProviderAvailabilityPanelWithErrorBoundary(props: Props) {
  return (
    <ErrorBoundary variant="widget">
      <ProviderAvailabilityPanel {...props} />
    </ErrorBoundary>
  );
}
