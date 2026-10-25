import { Activity, Brain, Target, Zap, Calendar, DollarSign, ChevronRight, Star } from 'lucide-react';

const GOLD = '#d4a52c';
const BORDER = 'rgba(212, 165, 44, 0.18)';

const COACHES = [
  { name: 'Dr. Jared Tendler', specialty: 'Mental Game Coach', rating: 4.9, sessions: 340, price: 1500, focus: 'Tilt control, mental game foundations, performance psychology' },
  { name: 'Elliot Roe', specialty: 'Mindset & Hypnotherapist', rating: 5.0, sessions: 280, price: 2000, focus: 'Confidence, focus, performance anxiety, pre-session routines' },
  { name: 'Barry Carter', specialty: 'Poker Psychology', rating: 4.8, sessions: 195, price: 1000, focus: 'Decision-making under pressure, emotional regulation, game psychology' },
  { name: 'Alex Fitzgerald', specialty: 'Tournament Strategy Coach', rating: 4.9, sessions: 410, price: 1200, focus: 'MTT strategy, ICM, final table play, preparation routines' },
  { name: 'Landon Tice', specialty: 'Cash Game Coach', rating: 4.7, sessions: 165, price: 800, focus: 'Cash game fundamentals, range analysis, GTO application' },
  { name: 'Kara Scott', specialty: 'Performance & Mindset', rating: 4.8, sessions: 120, price: 900, focus: 'Live tournament preparation, mindset, on-camera performance' },
];

const FOCUS_AREAS = [
  { icon: Brain, label: 'Mental Game', desc: 'Tilt control, emotional regulation, mental resilience' },
  { icon: Target, label: 'Strategy Coaching', desc: 'MTT, cash, GTO, ICM, final table preparation' },
  { icon: Zap, label: 'Performance Training', desc: 'Focus routines, preparation, productivity systems' },
  { icon: Calendar, label: 'Book Sessions', desc: '1-on-1 coaching, group sessions, video reviews' },
];

export function PerformanceCenter() {
  return (
    <div className="network-page-content py-6 lg:py-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Performance Center</h1>
          <p className="mt-1 text-[13px] text-white/40">Poker performance coaching and mental game resources.</p>
        </div>
        <span className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[8px] font-mono font-bold tracking-widest text-amber-400/70 uppercase">
          Demo
        </span>
      </div>

      {/* Focus areas */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FOCUS_AREAS.map((area) => (
          <div key={area.label} className="metal-panel rounded-xl p-4 transition-all hover:border-[#38424e]">
            <area.icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
            <h3 className="mt-2 text-xs font-semibold text-white">{area.label}</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-[#7A7D7F]">{area.desc}</p>
          </div>
        ))}
      </div>

      {/* Coaches */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wide text-white">Browse Performance Coaches</h2>
        <span className="text-[10px] text-[#5f6e7c]">{COACHES.length} coaches available</span>
      </div>
      <div className="space-y-3">
        {COACHES.map((coach) => (
          <CoachCard key={coach.name} coach={coach} />
        ))}
      </div>
    </div>
  );
}

function CoachCard({ coach }: { coach: typeof COACHES[number] }) {
  return (
    <div className="metal-panel group rounded-xl p-5 transition-all hover:border-[#38424e]">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-sm font-bold"
          style={{ borderColor: BORDER, background: GOLD + '12', color: GOLD }}
        >
          {coach.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{coach.name}</h3>
            <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: GOLD }}>
              <Star className="h-3 w-3 fill-current" /> {coach.rating}
            </span>
            <span className="text-[10px] text-[#5f6e7c]">({coach.sessions} sessions)</span>
          </div>
          <p className="mt-0.5 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{coach.specialty}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#7A7D7F]">{coach.focus}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-white">
            <DollarSign className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
            {coach.price.toLocaleString()}
            <span className="text-[9px] font-normal text-[#5f6e7c]">credits</span>
          </div>
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/20"
            style={{ minHeight: 44 }}
          >
            Book Session <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
