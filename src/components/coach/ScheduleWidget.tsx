import { useState, useCallback } from 'react';
import {
  Calendar, Plus, X, Clock, Video, ChevronRight, ChevronDown,
  Trash2, Ban, Repeat, CalendarDays, AlertCircle,
} from 'lucide-react';
import type { DaySchedule } from '@/hooks/useCoachSchedule';
import type { Booking, BookingTimeSlot } from '@/lib/booking';
import { DAY_NAMES, formatTimeInZone, SERVICE_TYPE_LABELS } from '@/lib/booking';

const GOLD = '#d4a52c';
const GOLD_BORDER = 'rgba(192,145,30,0.25)';
const GOLD_SOFT = 'rgba(192,145,30,0.12)';

interface ScheduleWidgetProps {
  days: DaySchedule[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddSlot: (
    dayOfWeek: number | null,
    specificDate: string | null,
    startTime: string,
    endTime: string,
    isRecurring: boolean,
    isBlackout: boolean,
  ) => Promise<boolean>;
  onDeleteSlot: (slotId: string) => Promise<boolean>;
  hasProvider: boolean;
  onSetupProvider?: () => void;
}

export function ScheduleWidget({
  days, loading, error, onRefresh, onAddSlot, onDeleteSlot, hasProvider, onSetupProvider,
}: ScheduleWidgetProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSlot, setNewSlot] = useState({
    mode: 'recurring' as 'recurring' | 'one-time' | 'block',
    dayOfWeek: 1,
    specificDate: '',
    startTime: '18:00',
    endTime: '20:00',
  });

  const handleAdd = useCallback(async () => {
    const isBlackout = newSlot.mode === 'block';
    const isRecurring = newSlot.mode === 'recurring';
    const dayOfWeek = isRecurring ? newSlot.dayOfWeek : null;
    const specificDate = !isRecurring ? newSlot.specificDate : null;
    if (!isRecurring && !specificDate) return;
    const ok = await onAddSlot(dayOfWeek, specificDate, newSlot.startTime, newSlot.endTime, isRecurring, isBlackout);
    if (ok) {
      setShowAddForm(false);
      setNewSlot({ mode: 'recurring', dayOfWeek: 1, specificDate: '', startTime: '18:00', endTime: '20:00' });
    }
  }, [newSlot, onAddSlot]);

  const handleDelete = useCallback(async (slotId: string) => {
    await onDeleteSlot(slotId);
  }, [onDeleteSlot]);

  const handleSetAvailability = useCallback(() => {
    if (!hasProvider && onSetupProvider) {
      onSetupProvider();
      return;
    }
    setShowAddForm((s) => !s);
  }, [hasProvider, onSetupProvider]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto h-6 w-6 animate-pulse text-[#5f6e7c]" strokeWidth={1.5} />
          <p className="mt-2 text-[11px] text-[#5f6e7c]">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[11px] text-red-400">{error}</p>
        <button
          onClick={onRefresh}
          className="rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2" style={{ borderColor: 'rgba(192,145,30,0.12)' }}>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: '#f5e6b0' }}>Next 7 Days</span>
        </div>
        <button
          onClick={handleSetAvailability}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold tracking-widest uppercase transition-all"
          style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }}
        >
          <Plus className="h-3 w-3" /> Set Availability
        </button>
      </div>

      {/* Provider setup notice (secondary, does not replace schedule) */}
      {!hasProvider && (
        <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: 'rgba(192,145,30,0.12)' }}>
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400/70" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-amber-200/80">Coaching availability isn't set up yet</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-amber-200/50">
                Create your coaching profile and availability to accept bookings.
              </p>
              {onSetupProvider && (
                <button
                  onClick={onSetupProvider}
                  className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-amber-200 transition-all hover:bg-amber-500/20"
                >
                  Set Up Coaching
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add availability form */}
      {showAddForm && hasProvider && (
        <div className="shrink-0 border-b p-3" style={{ borderColor: 'rgba(192,145,30,0.12)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-[#84929f]">New Availability</span>
            <button onClick={() => setShowAddForm(false)} className="text-[#5f6e7c] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {/* Mode toggle */}
            <div className="flex gap-1.5">
              {(['recurring', 'one-time', 'block'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setNewSlot((s) => ({ ...s, mode }))}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all"
                  style={
                    newSlot.mode === mode
                      ? { borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }
                      : { borderColor: 'rgba(255,255,255,0.06)', background: 'transparent', color: '#5f6e7c' }
                  }
                >
                  {mode === 'recurring' ? 'Recurring' : mode === 'one-time' ? 'One-Time' : 'Block Off'}
                </button>
              ))}
            </div>

            {newSlot.mode === 'recurring' ? (
              <select
                value={newSlot.dayOfWeek}
                onChange={(e) => setNewSlot((s) => ({ ...s, dayOfWeek: parseInt(e.target.value) }))}
                className="w-full rounded-lg border px-3 py-2 text-xs text-white"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}
              >
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}</option>)}
              </select>
            ) : (
              <input
                type="date"
                value={newSlot.specificDate}
                onChange={(e) => setNewSlot((s) => ({ ...s, specificDate: e.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-xs text-white"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}
              />
            )}

            <div className="flex gap-2">
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))}
                className="flex-1 rounded-lg border px-3 py-2 text-xs text-white"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}
              />
              <input
                type="time"
                value={newSlot.endTime}
                onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))}
                className="flex-1 rounded-lg border px-3 py-2 text-xs text-white"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.5)' }}
              />
            </div>
            <button
              onClick={handleAdd}
              className="w-full rounded-lg border py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
              style={{ borderColor: GOLD_BORDER, background: GOLD_SOFT, color: '#f5e6b0' }}
            >
              {newSlot.mode === 'block' ? 'Block Off Time' : 'Add Availability'}
            </button>
          </div>
        </div>
      )}

      {/* 7-day rolling schedule — always visible */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {days.map((day, idx) => {
          const isExpanded = expandedDay === idx;
          const hasBookings = day.bookings.length > 0;
          const hasAvailability = day.availableSlots.length > 0;
          const isBlackout = day.blackouts.length > 0 && !hasAvailability && !hasBookings;
          const isEmpty = !hasBookings && !hasAvailability && !isBlackout;

          return (
            <div key={idx} className="rounded-lg border" style={{ borderColor: 'rgba(192,145,30,0.1)' }}>
              {/* Day header */}
              <button
                onClick={() => setExpandedDay(isExpanded ? null : idx)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <span className="text-[9px] font-bold tracking-widest" style={{ color: day.isToday ? GOLD : '#5f6e7c' }}>{day.dayShort}</span>
                  <span className={`text-base font-bold ${day.isToday ? 'text-[#d4a52c]' : 'text-white/70'}`}>{day.dateNum}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {day.isToday && (
                    <span className="mr-1.5 rounded bg-[#d4a52c]/20 px-1 py-0.5 text-[7px] font-bold tracking-widest text-[#d4a52c]">TODAY</span>
                  )}
                  {hasBookings && (
                    <span className="text-[11px] text-white/80">
                      {day.bookings.length} session{day.bookings.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {hasAvailability && !hasBookings && (
                    <span className="text-[11px] text-[#5f6e7c]">
                      {day.availableSlots.length} slot{day.availableSlots.length !== 1 ? 's' : ''} available
                    </span>
                  )}
                  {isBlackout && (
                    <span className="text-[11px] text-red-400/60">Blocked off</span>
                  )}
                  {isEmpty && (
                    <span className="text-[11px] text-[#38424e]">No availability set</span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5f6e7c]" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5f6e7c]" />
                )}
              </button>

              {/* Expanded day detail */}
              {isExpanded && (
                <div className="space-y-1.5 border-t px-3 py-2" style={{ borderColor: 'rgba(192,145,30,0.08)' }}>
                  {/* Booked sessions */}
                  {day.bookings.map((b) => (
                    <BookingRow key={b.id} booking={b} />
                  ))}

                  {/* Available slots */}
                  {day.availableSlots.map((slot) => (
                    <SlotRow key={slot.id} slot={slot} onDelete={handleDelete} />
                  ))}

                  {/* Blackout slots */}
                  {day.blackouts.map((slot) => (
                    <BlackoutRow key={slot.id} slot={slot} onDelete={handleDelete} />
                  ))}

                  {isEmpty && (
                    <div className="py-2 text-center">
                      <span className="text-[10px] text-[#38424e]">No sessions or availability set</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const time = formatTimeInZone(booking.start_time);
  const endTime = formatTimeInZone(booking.end_time);
  const statusColor = booking.booking_status === 'confirmed' ? GOLD : '#84929f';

  return (
    <div
      className="flex items-center gap-2 rounded-lg border p-2"
      style={{ borderColor: 'rgba(192,145,30,0.2)', background: 'rgba(192,145,30,0.06)' }}
    >
      <div className="shrink-0 text-[10px] font-mono" style={{ color: GOLD }}>{time}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-semibold text-white">
          {booking.service_name ?? SERVICE_TYPE_LABELS[booking.service_type ?? ''] ?? 'Session'}
        </div>
        <div className="truncate text-[10px]" style={{ color: statusColor }}>
          {booking.booking_status === 'confirmed' ? 'Confirmed' : booking.booking_status === 'pending' ? 'Pending' : booking.booking_status}
        </div>
      </div>
      <div className="shrink-0 text-[9px] text-[#5f6e7c]">{endTime}</div>
    </div>
  );
}

function SlotRow({ slot, onDelete }: { slot: BookingTimeSlot; onDelete: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-dashed p-2"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(20,22,24,0.3)' }}
    >
      <div className="shrink-0 text-[10px] font-mono text-[#5f6e7c]">{slot.start_time}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-[#5f6e7c]">{slot.start_time} – {slot.end_time}</div>
        <div className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-[#475569] uppercase">
          {slot.is_recurring && <Repeat className="h-2.5 w-2.5" />}
          Available
        </div>
      </div>
      <button
        onClick={() => onDelete(slot.id)}
        className="text-[#475569] transition-colors hover:text-red-400"
        title="Remove slot"
        aria-label="Remove slot"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function BlackoutRow({ slot, onDelete }: { slot: BookingTimeSlot; onDelete: (id: string) => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border p-2"
      style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.04)' }}
    >
      <Ban className="h-3 w-3 shrink-0 text-red-400/60" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-red-400/70">{slot.start_time} – {slot.end_time}</div>
        <div className="text-[9px] font-bold tracking-widest text-red-400/50 uppercase">Blocked</div>
      </div>
      <button
        onClick={() => onDelete(slot.id)}
        className="text-red-400/40 transition-colors hover:text-red-400"
        title="Remove block"
        aria-label="Remove block"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
