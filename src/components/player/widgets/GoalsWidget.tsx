import { useState } from 'react';
import { Plus, Trash2, Target, Check } from 'lucide-react';
import { usePersistentState } from '@/hooks/usePersistentState';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Goal {
  id: string;
  title: string;
  category: string;
  targetDate: string;
  progress: number;
  completed: boolean;
}

export function GoalsWidget() {
  const [goals, setGoals] = usePersistentState<Goal[]>('player-goals', []);
  const [showForm, setShowForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', category: 'Study', targetDate: '' });

  const addGoal = () => {
    if (!newGoal.title.trim()) return;
    setGoals([{ id: crypto.randomUUID(), title: newGoal.title, category: newGoal.category, targetDate: newGoal.targetDate, progress: 0, completed: false }, ...goals]);
    setNewGoal({ title: '', category: 'Study', targetDate: '' });
    setShowForm(false);
  };

  const toggleComplete = (id: string) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, completed: !g.completed, progress: g.completed ? g.progress : 100 } : g)));
  };

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const categories = ['Study', 'Volume', 'Tournament', 'Bankroll', 'Skill', 'Custom'];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-white/50 uppercase">Goals</span>
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
            value={newGoal.title}
            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
            placeholder="Goal title..."
            className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
            onKeyDown={(e) => { if (e.key === 'Enter') addGoal(); }}
          />
          <div className="flex gap-2">
            <select
              value={newGoal.category}
              onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              value={newGoal.targetDate}
              onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
              className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none"
            />
            <button onClick={addGoal} className="rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: BORDER, color: GOLD }}>Add</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <Target className="h-5 w-5 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[11px] text-white/30">No goals yet.</p>
          <p className="text-[10px] text-white/20">Track study, volume, and bankroll targets.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {goals.map((goal) => (
            <div key={goal.id} className="mb-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleComplete(goal.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors"
                  style={{
                    borderColor: goal.completed ? GOLD : 'rgba(255,255,255,0.2)',
                    background: goal.completed ? 'rgba(212,165,44,0.15)' : 'transparent',
                  }}
                >
                  {goal.completed && <Check className="h-3 w-3" style={{ color: GOLD }} strokeWidth={2} />}
                </button>
                <span className={`flex-1 text-[11px] font-medium ${goal.completed ? 'text-white/40 line-through' : 'text-white/80'}`}>{goal.title}</span>
                <button onClick={() => deleteGoal(goal.id)} className="rounded p-1 text-white/25 transition-colors hover:text-red-400" aria-label="Delete goal">
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 pl-7">
                <span className="rounded px-1.5 py-0.5 text-[8px] font-medium" style={{ background: 'rgba(192,145,30,0.1)', color: GOLD, border: `1px solid ${BORDER}` }}>{goal.category}</span>
                {goal.targetDate && <span className="text-[9px] text-white/30">{goal.targetDate}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
