import { useState, useCallback, useEffect } from 'react';

export interface AvailabilitySlot {
  id: string;
  day: string;
  start: string;
  end: string;
  recurring: boolean;
  date?: string;
}

export interface BookedSession {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  day: string;
  timeStart: string;
  durationMinutes: number;
  topic: string;
  serviceType?: string;
  videoLink?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_AVAILABILITY: AvailabilitySlot[] = [
  { id: 'a1', day: 'Monday', start: '18:00', end: '22:00', recurring: true },
  { id: 'a2', day: 'Wednesday', start: '18:00', end: '22:00', recurring: true },
  { id: 'a3', day: 'Saturday', start: '12:00', end: '18:00', recurring: true },
];

const DEFAULT_BOOKINGS: BookedSession[] = [
  { id: 'b1', studentId: 's1', studentName: 'Jordan Chen', date: getDayDate('Monday'), day: 'Monday', timeStart: '14:00', durationMinutes: 60, topic: 'C-Bet Frequencies', serviceType: '1-on-1 Session' },
  { id: 'b2', studentId: 's2', studentName: 'Alex Rivera', date: getDayDate('Monday'), day: 'Monday', timeStart: '16:30', durationMinutes: 60, topic: 'Final Table ICM Review', serviceType: '1-on-1 Session' },
  { id: 'b3', studentId: 's3', studentName: 'Sam Taylor', date: getDayDate('Tuesday'), day: 'Tuesday', timeStart: '19:00', durationMinutes: 90, topic: 'Preflop Ranges Deep Dive', serviceType: 'Group Coaching' },
  { id: 'b4', studentId: 's1', studentName: 'Jordan Chen', date: getDayDate('Wednesday'), day: 'Wednesday', timeStart: '18:30', durationMinutes: 60, topic: 'Hand History Review', serviceType: '1-on-1 Session' },
  { id: 'b5', studentId: 's4', studentName: 'Riley Park', date: getDayDate('Friday'), day: 'Friday', timeStart: '17:00', durationMinutes: 60, topic: 'Mental Game Check-in', serviceType: '1-on-1 Session' },
];

function getDayDate(dayName: string): string {
  const today = new Date();
  const dayIndex = DAYS.indexOf(dayName);
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const diff = (dayIndex - todayIndex + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

let availabilityState: AvailabilitySlot[] = [...DEFAULT_AVAILABILITY];
let bookingsState: BookedSession[] = [...DEFAULT_BOOKINGS];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function useCoachAvailability() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const addSlot = useCallback((slot: Omit<AvailabilitySlot, 'id'>) => {
    const newSlot: AvailabilitySlot = { ...slot, id: `a${Date.now()}` };
    availabilityState = [...availabilityState, newSlot];
    notify();
  }, []);

  const removeSlot = useCallback((id: string) => {
    availabilityState = availabilityState.filter((s) => s.id !== id);
    notify();
  }, []);

  return { slots: availabilityState, bookings: bookingsState, addSlot, removeSlot };
}

export function getCoachAvailability(): AvailabilitySlot[] {
  return availabilityState;
}

export function getCoachBookings(): BookedSession[] {
  return bookingsState;
}

export { DAYS };
