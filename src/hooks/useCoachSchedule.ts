import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchProviderByAccountId,
  fetchTimeSlotsByProvider,
  fetchBookingsForUser,
  addTimeSlot,
  deleteTimeSlot,
  type BookingProvider,
  type BookingTimeSlot,
  type Booking,
} from '@/lib/booking';

export interface DaySchedule {
  date: Date;
  dayName: string;
  dayShort: string;
  dateNum: number;
  isToday: boolean;
  bookings: Booking[];
  availableSlots: BookingTimeSlot[];
  blackouts: BookingTimeSlot[];
}

export function useCoachSchedule(accountId: string | null | undefined) {
  const [provider, setProvider] = useState<BookingProvider | null>(null);
  const [slots, setSlots] = useState<BookingTimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const prov = await fetchProviderByAccountId(accountId);
      setProvider(prov);

      if (prov) {
        const [timeSlots, userBookings] = await Promise.all([
          fetchTimeSlotsByProvider(prov.id),
          fetchBookingsForUser(accountId),
        ]);
        setSlots(timeSlots);
        setBookings(userBookings);
      } else {
        setSlots([]);
        setBookings([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => { load(); }, [load]);

  const handleAddSlot = useCallback(async (
    dayOfWeek: number | null,
    specificDate: string | null,
    startTime: string,
    endTime: string,
    isRecurring: boolean,
    isBlackout: boolean,
  ): Promise<boolean> => {
    if (!provider) return false;
    const result = await addTimeSlot({
      provider_id: provider.id,
      day_of_week: dayOfWeek,
      specific_date: specificDate,
      start_time: startTime,
      end_time: endTime,
      is_recurring: isRecurring,
      is_blackout: isBlackout,
    });
    if (result) {
      setSlots((prev) => [...prev, result].sort((a, b) => (a.day_of_week ?? 99) - (b.day_of_week ?? 99)));
      return true;
    }
    return false;
  }, [provider]);

  const handleDeleteSlot = useCallback(async (slotId: string): Promise<boolean> => {
    const ok = await deleteTimeSlot(slotId);
    if (ok) {
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    }
    return ok;
  }, []);

  const getNext7Days = useCallback((): DaySchedule[] => {
    const days: DaySchedule[] = [];
    const now = new Date();
    const todayIdx = now.getDay();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dow = date.getDay();

      const dayBookings = bookings.filter((b) => {
        const bDate = new Date(b.start_time);
        return bDate.toDateString() === date.toDateString() && b.booking_status !== 'cancelled' && b.booking_status !== 'declined';
      });

      const daySlots = slots.filter((s) => {
        if (s.is_blackout) return false;
        if (s.specific_date) {
          return s.specific_date === date.toISOString().slice(0, 10);
        }
        if (s.day_of_week !== null && s.is_recurring) {
          return s.day_of_week === dow;
        }
        return false;
      });

      const dayBlackouts = slots.filter((s) => {
        if (!s.is_blackout) return false;
        if (s.specific_date) {
          return s.specific_date === date.toISOString().slice(0, 10);
        }
        if (s.day_of_week !== null && s.is_recurring) {
          return s.day_of_week === dow;
        }
        return false;
      });

      days.push({
        date,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow],
        dayShort: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dow],
        dateNum: date.getDate(),
        isToday: i === 0,
        bookings: dayBookings,
        availableSlots: daySlots,
        blackouts: dayBlackouts,
      });
    }

    return days;
  }, [bookings, slots]);

  return {
    provider,
    slots,
    bookings,
    loading,
    error,
    refresh,
    addSlot: handleAddSlot,
    deleteSlot: handleDeleteSlot,
    getNext7Days,
  };
}
