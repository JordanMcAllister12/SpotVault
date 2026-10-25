import { useState } from 'react';
import { CalendarCheck, Clock, Plus, X, Calendar } from 'lucide-react';
import { useCoachAvailability, DAYS } from '@/lib/coachAvailabilityStore';

interface Props {
  account: { id: string; name: string };
}

export function CoachAvailabilityView({ account: _account }: Props) {
  const { slots, addSlot, removeSlot } = useCoachAvailability();
  const [newSlot, setNewSlot] = useState({ day: 'Monday', start: '18:00', end: '20:00', recurring: true, date: '' });
  const [showAdd, setShowAdd] = useState(false);

  const handleAddSlot = () => {
    addSlot({
      day: newSlot.day,
      start: newSlot.start,
      end: newSlot.end,
      recurring: newSlot.recurring,
      date: newSlot.recurring ? undefined : newSlot.date,
    });
    setShowAdd(false);
    setNewSlot({ day: 'Monday', start: '18:00', end: '20:00', recurring: true, date: '' });
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Availability</h2>
            <p className="text-[10px] text-[#5f6e7c]">Set your recurring and one-off coaching availability</p>
          </div>
        </div>

        {/* Recurring Availability */}
        <div className="metal-panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Weekly Availability</h3>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 rounded-lg border border-[#c091e]/40 bg-gradient-to-b from-[#c091e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
            >
              <Plus className="h-3.5 w-3.5" /> Add Slot
            </button>
          </div>

          {showAdd && (
            <div className="mb-4 space-y-2 rounded-lg border border-[#232a32] bg-[#11151a] p-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[10px] text-[#84929f]">
                  <input
                    type="checkbox"
                    checked={newSlot.recurring}
                    onChange={(e) => setNewSlot((s) => ({ ...s, recurring: e.target.checked }))}
                    className="accent-[#d4a52c]"
                  />
                  Recurring weekly
                </label>
              </div>
              <div className="flex gap-2">
                <select value={newSlot.day} onChange={(e) => setNewSlot((s) => ({ ...s, day: e.target.value }))} className="flex-1 rounded-lg border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-xs text-white">
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                {!newSlot.recurring && (
                  <input type="date" value={newSlot.date} onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))} className="rounded-lg border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-xs text-white" />
                )}
                <input type="time" value={newSlot.start} onChange={(e) => setNewSlot((s) => ({ ...s, start: e.target.value }))} className="rounded-lg border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-xs text-white" />
                <input type="time" value={newSlot.end} onChange={(e) => setNewSlot((s) => ({ ...s, end: e.target.value }))} className="rounded-lg border border-[#232a32] bg-[#0a0c0e] px-3 py-2 text-xs text-white" />
                <button onClick={handleAddSlot} className="rounded-lg border border-[#c091e]/40 bg-[#c091e]/15 px-3 py-2 text-[10px] font-bold uppercase text-[#d4a52c]">Add</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {slots.length === 0 ? (
              <p className="text-sm text-[#5f6e7c]">No availability set. Add time slots when players can book you.</p>
            ) : (
              slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c091e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408]">
                      <Calendar className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-sm text-white">{slot.day}{!slot.recurring && slot.date ? ` (${slot.date})` : ''}</div>
                      <div className="text-xs text-[#5f6e7c]">{slot.start} – {slot.end} {slot.recurring && <span className="ml-1 text-[#475565]">· Recurring</span>}</div>
                    </div>
                  </div>
                  <button onClick={() => removeSlot(slot.id)} className="text-[#5f6e7c] hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/30 px-4 py-3">
          <p className="text-[10px] leading-relaxed text-[#5f6e7c]">Confirmed bookings appear automatically on your Coach Home schedule. This tab controls when you can be booked.</p>
        </div>
      </div>
    </div>
  );
}
