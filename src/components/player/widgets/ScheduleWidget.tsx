import { useState } from 'react';
import { Plus, Trash2, CalendarDays, Clock } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface ScheduleItem {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
}

export function ScheduleWidget() {
  const [items, setItems] = usePersistentState<ScheduleItem[]>('player-schedule', []);
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', type: 'Tournament', date: '', time: '' });

  const addItem = () => {
    if (!newItem.title.trim() || !newItem.date) return;
    setItems([...items, { id: crypto.randomUUID(), ...newItem }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewItem({ title: '', type: 'Tournament', date: '', time: '' });
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const types = ['Tournament', 'Study Session', 'Coaching', 'Review', 'Event', 'Reminder'];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">Schedule</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/5"
          style={{ borderColor: BORDER, color: GOLD }}
        >
          <Plus className="h-3 w-3" strokeWidth={1.5} />
          Add
        </button>
      </div>

      {showForm && (
        <div className="shrink-0 border-b border-white/[0.06] p-3">
          <input
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            placeholder="Event title..."
            className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={newItem.type}
              onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none"
            >
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="date"
              value={newItem.date}
              onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none"
            />
            <input
              type="time"
              value={newItem.time}
              onChange={(e) => setNewItem({ ...newItem, time: e.target.value })}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none"
            />
            <button onClick={addItem} className="rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: BORDER, color: GOLD }}>Add</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <CalendarDays className="h-5 w-5 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[11px] text-white/30">No upcoming events.</p>
          <p className="text-[10px] text-white/20">Tournaments, study sessions, and coaching will appear here.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.map((item) => (
            <div key={item.id} className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
              <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(192,145,30,0.08)' }}>
                <span className="text-[8px] text-white/40">{new Date(item.date).toLocaleDateString('en', { month: 'short' })}</span>
                <span className="text-[11px] font-bold text-white/80">{new Date(item.date).getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-white/80">{item.title}</p>
                <div className="flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-[8px] font-medium" style={{ background: 'rgba(192,145,30,0.1)', color: GOLD, border: `1px solid ${BORDER}` }}>{item.type}</span>
                  {item.time && <span className="flex items-center gap-0.5 text-[9px] text-white/30"><Clock className="h-2.5 w-2.5" strokeWidth={1.5} />{item.time}</span>}
                </div>
              </div>
              <button onClick={() => deleteItem(item.id)} className="rounded p-1 text-white/25 transition-colors hover:text-red-400" aria-label="Delete event">
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
