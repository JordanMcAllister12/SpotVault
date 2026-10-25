import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Check, Zap, Clock, Calendar,
  ShieldCheck, Video, MessageSquare,
} from 'lucide-react';
import {
  type TalentProfile, type TalentService,
  calculateEarnings, SERVICE_TYPE_LABELS,
} from '@/data/talent';

interface Props {
  talent: TalentProfile;
  service: TalentService;
  onConfirm: (booking: { date: string; timeStart: string; timeEnd: string }) => void;
  onCancel: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function generateTimeSlots(start: string, end: string, bufferMinutes: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let h = startH;
  let m = startM;
  const endTotal = endH * 60 + endM;
  while (h * 60 + m < endTotal) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30 + bufferMinutes;
    while (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function BookingFlow({ talent, service, onConfirm, onCancel }: Props) {
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return generateTimeSlots(talent.availableHours.start, talent.availableHours.end, talent.bufferMinutes);
  }, [selectedDate, talent]);

  const earnings = calculateEarnings(service.priceCredits);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const isDayAvailable = (dayNum: number) => {
    const date = new Date(viewYear, viewMonth, dayNum);
    const dayName = DAYS[date.getDay()];
    const dateStr = formatDate(viewYear, viewMonth, dayNum);
    if (dateStr < todayStr) return false;
    if (!talent.availableDays.includes(dayName)) return false;
    if (talent.vacationDates.includes(dateStr)) return false;
    return true;
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const [h, m] = selectedTime.split(':').map(Number);
    const endM = m + service.durationMinutes;
    const endH = h + Math.floor(endM / 60);
    const endMin = endM % 60;
    onConfirm({
      date: selectedDate,
      timeStart: selectedTime,
      timeEnd: `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
    });
  };

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
            <h1 className="text-lg font-bold tracking-tight text-white">Book a Session</h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">
              {talent.name} · {service.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['date', 'time', 'confirm'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                step === s || (['date','time','confirm'].indexOf(step) > i)
                  ? 'border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 text-[#d4a52c]'
                  : 'border-[#232a32] bg-[#161b21] text-[#5f6e7c]'
              }`}>
                {['date','time','confirm'].indexOf(step) > i ? <Check className="h-3 w-3" strokeWidth={2} /> : i + 1}
              </div>
              {i < 2 && <div className={`h-px w-6 ${['date','time','confirm'].indexOf(step) > i ? 'bg-[#d4a52c]/40' : 'bg-[#232a32]'}`} />}
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          {/* Step 1: Date */}
          {step === 'date' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Select a Date</h2>
              <div className="metal-panel rounded-xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
                      else setViewMonth(viewMonth - 1);
                    }}
                    className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <div className="text-sm font-bold text-white">{MONTHS[viewMonth]} {viewYear}</div>
                  <button
                    onClick={() => {
                      if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
                      else setViewMonth(viewMonth + 1);
                    }}
                    className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = formatDate(viewYear, viewMonth, day);
                    const available = isDayAvailable(day);
                    const isSelected = selectedDate === dateStr;
                    return (
                      <button
                        key={day}
                        disabled={!available}
                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                        className={`aspect-square rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 text-[#f5e6b0] gold-glow'
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
              {selectedDate && (
                <button
                  onClick={() => setStep('time')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
                >
                  Continue <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Step 2: Time */}
          {step === 'time' && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Select a Time</h2>
              <p className="mb-4 text-xs text-[#5f6e7c]">
                {talent.name}'s timezone: {talent.timezone} · Available {talent.availableHours.start}–{talent.availableHours.end}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-lg border py-3 text-sm font-medium transition-all ${
                      selectedTime === slot
                        ? 'border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 text-[#f5e6b0] gold-glow'
                        : 'border-[#232a32] bg-[#11151a] text-[#aab6c2] hover:border-[#38424e] hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              {selectedTime && (
                <button
                  onClick={() => setStep('confirm')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
                >
                  Continue <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedDate && selectedTime && (
            <div>
              <h2 className="mb-4 text-sm font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Confirm Booking</h2>
              <div className="metal-panel rounded-xl p-6">
                <div className="flex items-center gap-3 border-b border-[#1a1f25] pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">
                    {talent.photoInitials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{talent.name}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                    </div>
                    <div className="text-xs text-[#5f6e7c]">{service.name}</div>
                  </div>
                </div>
                <div className="space-y-3 py-4">
                  <DetailRow icon={Calendar} label="Date" value={selectedDate} />
                  <DetailRow icon={Clock} label="Time" value={`${selectedTime} – ${selectedTime}`} />
                  <DetailRow icon={Video} label="Type" value={SERVICE_TYPE_LABELS[service.type]} />
                  {service.includesMessaging && <DetailRow icon={MessageSquare} label="Messaging" value="Included" />}
                </div>
                <div className="space-y-2 border-t border-[#1a1f25] pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#5f6e7c]">Session Price</span>
                    <span className="flex items-center gap-1 font-bold text-white">
                      <Zap className="h-3.5 w-3.5 text-[#d4a52c]" /> {service.priceCredits.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#5f6e7c]">SpotVault Fee (20%)</span>
                    <span className="text-[#84929f]">{earnings.fee} credits</span>
                  </div>
                  <div className="flex justify-between border-t border-[#1a1f25] pt-2 text-sm">
                    <span className="font-semibold text-[#aab6c2]">Talent Earnings</span>
                    <span className="font-bold text-[#d4a52c]">{earnings.earnings} credits</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-sm font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
              >
                <Check className="h-4 w-4" strokeWidth={1.5} /> Book Session
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
      <div className="flex items-center gap-2 text-[#5f6e7c]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
