import { useState, useEffect, useCallback, useRef } from 'react';
import { CalendarDays, Clock, Plus, X, ChevronRight, ChevronLeft, Video, Users, MessageSquare } from 'lucide-react';
import { FloatingWindow } from '@/components/player/FloatingWindow';
import { useUserPreferences, type WidgetLayout } from '@/hooks/useUserPreferences';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_BORDER = 'rgba(192,145,30,0.25)';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ScheduleEntry {
  id?: string;
  entry_type: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  label: string;
}

interface BookingItem {
  id: string;
  title: string;
  date: string;
  time: string;
  client_name: string;
  status: string;
}

export interface ScheduleWidgetState {
  open: boolean;
  minimized: boolean;
  pos: { x: number; y: number };
  size: { width: number; height: number };
  z: number;
  editMode: boolean;
}

export interface ScheduleWidgetActions {
  setOpen: (v: boolean) => void;
  setMinimized: (v: boolean) => void;
  setPos: (p: { x: number; y: number }) => void;
  setSize: (s: { width: number; height: number }) => void;
  setEditMode: (v: boolean) => void;
  bringToFront: () => void;
  config: { widgetId: string; defaultPos: { x: number; y: number }; defaultSize: { width: number; height: number } };
}

export function useScheduleWidget(
  accountId: string | null | undefined,
  config: { widgetId: string; defaultPos: { x: number; y: number }; defaultSize: { width: number; height: number } },
  baseZ: number = 14,
): [ScheduleWidgetState, ScheduleWidgetActions] {
  const prefs = useUserPreferences(accountId);
  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(config.defaultPos);
  const [size, setSize] = useState(config.defaultSize);
  const [z, setZ] = useState(baseZ);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (prefs.loading) return;
    const layouts = prefs.prefs.coachWidgetLayouts;
    const saved = layouts[config.widgetId];
    if (saved) {
      setOpen(saved.open);
      setMinimized(saved.minimized);
      setPos({ x: saved.x, y: saved.y });
      setSize({ width: saved.width, height: saved.height });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loading, config.widgetId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const layout: WidgetLayout = {
        x: pos.x, y: pos.y, width: size.width, height: size.height,
        open, minimized, maximized: false,
      };
      prefs.setCoachWidgetLayout(config.widgetId, layout);
    }, 800);
    saveTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [pos, size, open, minimized, config.widgetId, prefs]);

  const bringToFront = useCallback(() => setZ(zv => zv + 1), []);

  const state: ScheduleWidgetState = { open, minimized, pos, size, z, editMode };
  const actions: ScheduleWidgetActions = {
    setOpen, setMinimized, setPos, setSize, setEditMode, bringToFront, config,
  };

  return [state, actions];
}

export function ScheduleWidget({ state, actions, accountId }: {
  state: ScheduleWidgetState;
  actions: ScheduleWidgetActions;
  accountId: string | null;
}) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const { data: avail } = await supabase
      .from('creator_availability')
      .select('*')
      .eq('account_id', accountId);
    setEntries((avail ?? []) as ScheduleEntry[]);

    // Demo bookings — in production these would come from a bookings table
    const today = new Date();
    setBookings([
      { id: 'b1', title: 'Video Call', date: today.toISOString().slice(0, 10), time: '2:00 PM', client_name: 'Alex R.', status: 'confirmed' },
      { id: 'b2', title: 'Content Consultation', date: today.toISOString().slice(0, 10), time: '4:30 PM', client_name: 'Sarah M.', status: 'confirmed' },
      { id: 'b3', title: 'Brand Discussion', date: new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10), time: '10:00 AM', client_name: 'PokerNews', status: 'pending' },
    ]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  const getNext7Days = () => {
    const days: { date: Date; label: string; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        label: i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : DAYS[d.getDay()].toUpperCase(),
        isToday: i === 0,
      });
    }
    return days;
  };

  const getDayAvailability = (date: Date) => {
    const dow = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);
    const weekly = entries.filter(e => e.entry_type === 'weekly' && e.day_of_week === dow && e.is_available);
    const blocked = entries.find(e => e.entry_type === 'blocked_date' && e.specific_date === dateStr);
    if (blocked) return null;
    if (weekly.length === 0) return null;
    return weekly.map(e => `${e.start_time ?? ''} – ${e.end_time ?? ''}`).join(', ');
  };

  const getDayBookings = (date: Date) => {
    const dateStr = date.toISOString().slice(0, 10);
    return bookings.filter(b => b.date === dateStr);
  };

  const next7 = getNext7Days();

  return (
    <>
      {state.open && !state.minimized && (
        <FloatingWindow
          id={actions.config.widgetId}
          title="Schedule"
          subtitle="Next 7 days"
          icon={<CalendarDays className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />}
          position={state.pos}
          size={state.size}
          collapsed={false}
          maximized={false}
          minimized={false}
          pinned={false}
          zIndex={state.z}
          onChangePosition={actions.setPos}
          onChangeSize={actions.setSize}
          onToggleCollapse={() => {}}
          onToggleMaximize={() => actions.setSize({ width: 480, height: 600 })}
          onToggleMinimize={() => actions.setMinimized(true)}
          onTogglePin={() => {}}
          onClose={() => actions.setOpen(false)}
          onBringToFront={actions.bringToFront}
          minWidth={360}
          resizable
        >
          <div className="flex h-full flex-col overflow-hidden">
            {/* Edit toggle */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.04] px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {state.editMode ? 'Edit Availability' : 'Upcoming Schedule'}
              </span>
              <button
                onClick={() => actions.setEditMode(!state.editMode)}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                style={{ borderColor: state.editMode ? GOLD : BORDER_LIGHT, color: state.editMode ? GOLD : '#9ca3af', background: state.editMode ? 'rgba(192,145,30,0.08)' : 'transparent' }}
              >
                {state.editMode ? <X size={10} /> : <Plus size={10} />}
                {state.editMode ? 'Done' : 'Edit Availability'}
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
                </div>
              ) : state.editMode ? (
                <EditMode entries={entries} setEntries={setEntries} accountId={accountId} />
              ) : (
                <div className="space-y-2">
                  {next7.map((day) => {
                    const dayBookings = getDayBookings(day.date);
                    const avail = getDayAvailability(day.date);
                    const dateLabel = `${MONTHS[day.date.getMonth()]} ${day.date.getDate()}`;
                    return (
                      <div key={day.date.toISOString()} className="rounded-lg border p-2.5"
                        style={{ borderColor: day.isToday ? 'rgba(192,145,30,0.2)' : 'rgba(255,255,255,0.04)', background: day.isToday ? 'rgba(192,145,30,0.05)' : 'rgba(255,255,255,0.015)' }}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: day.isToday ? GOLD : 'rgba(255,255,255,0.5)' }}>
                            {day.label} — {dateLabel}
                          </span>
                        </div>
                        {/* Bookings */}
                        {dayBookings.length > 0 && (
                          <div className="space-y-1">
                            {dayBookings.map(b => (
                              <div key={b.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                                style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}>
                                <Clock size={11} className="shrink-0 text-white/30" />
                                <span className="text-[10px] font-semibold text-white/70">{b.time}</span>
                                <span className="text-[10px] text-white/50">— {b.title}</span>
                                <span className="ml-auto text-[9px] text-white/30">{b.client_name}</span>
                                {b.status === 'pending' && <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'rgba(192,145,30,0.15)', color: GOLD }}>Pending</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Availability */}
                        {avail && (
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
                            <span className="text-[10px] text-white/40">Available {avail}</span>
                          </div>
                        )}
                        {!avail && dayBookings.length === 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                            <span className="text-[10px] text-white/25">Unavailable</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Dock button */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[200] flex flex-col items-end gap-2">
        {state.open && state.minimized && (
          <button
            onClick={() => { actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Restore schedule"
          >
            <CalendarDays className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Schedule</span>
          </button>
        )}
        {!state.open && (
          <button
            onClick={() => { actions.setOpen(true); actions.setMinimized(false); actions.bringToFront(); }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all hover:scale-105"
            style={{ background: 'rgba(8,7,6,0.85)', borderColor: GOLD_BORDER, backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)' }}
            title="Open schedule"
          >
            <CalendarDays className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-semibold tracking-wide text-white/85">Open Schedule</span>
          </button>
        )}
      </div>
    </>
  );
}

const BORDER_LIGHT = 'rgba(255,255,255,0.08)';

function EditMode({ entries, setEntries, accountId }: {
  entries: ScheduleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
  accountId: string | null;
}) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    for (const entry of entries) {
      if (entry.id) {
        await supabase.from('creator_availability').update({
          day_of_week: entry.day_of_week, start_time: entry.start_time, end_time: entry.end_time,
          is_available: entry.is_available, updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
      } else {
        const { data } = await supabase.from('creator_availability').insert({
          account_id: accountId, entry_type: entry.entry_type, day_of_week: entry.day_of_week,
          start_time: entry.start_time, end_time: entry.end_time, is_available: entry.is_available,
        }).select('*').maybeSingle();
        if (data) entry.id = (data as ScheduleEntry).id;
      }
    }
    setSaving(false);
  };

  const addSlot = (dow: number) => {
    setEntries(prev => [...prev, {
      entry_type: 'weekly', day_of_week: dow, specific_date: null,
      start_time: '09:00', end_time: '17:00', is_available: true, label: '',
    }]);
  };

  const removeSlot = (idx: number) => {
    const entry = entries[idx];
    if (entry.id) void supabase.from('creator_availability').delete().eq('id', entry.id);
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {DAYS.map((day, dow) => {
        const dayEntries = entries.filter(e => e.entry_type === 'weekly' && e.day_of_week === dow);
        return (
          <div key={day} className="rounded-lg border p-2" style={{ borderColor: BORDER_LIGHT, background: 'rgba(255,255,255,0.015)' }}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{day}</span>
              <button onClick={() => addSlot(dow)} className="text-white/30 hover:text-white/60"><Plus size={12} /></button>
            </div>
            {dayEntries.length === 0 ? (
              <div className="flex items-center gap-1.5 px-1 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                <span className="text-[10px] text-white/25">Unavailable</span>
              </div>
            ) : (
              <div className="space-y-1">
                {dayEntries.map((entry) => {
                  const realIdx = entries.indexOf(entry);
                  return (
                    <div key={realIdx} className="flex items-center gap-1.5 rounded-md border px-1.5 py-1" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <input type="time" value={entry.start_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, start_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1 py-0.5 text-[10px] text-white/70 outline-none" />
                      <span className="text-[10px] text-white/30">–</span>
                      <input type="time" value={entry.end_time ?? ''} onChange={(e) => setEntries(prev => prev.map((en, i) => i === realIdx ? { ...en, end_time: e.target.value } : en))} className="rounded border border-white/[0.06] bg-black/30 px-1 py-0.5 text-[10px] text-white/70 outline-none" />
                      <button onClick={() => removeSlot(realIdx)} className="ml-auto text-white/20 hover:text-red-400"><X size={11} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={save} disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02] disabled:opacity-50"
        style={{ borderColor: 'rgba(192,145,30,0.3)', color: GOLD, background: 'rgba(192,145,30,0.08)' }}>
        {saving ? 'Saving...' : 'Save Availability'}
      </button>
    </div>
  );
}
