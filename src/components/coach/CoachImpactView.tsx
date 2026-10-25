import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, BarChart3, Target, Award, Activity } from 'lucide-react';
import { COACH_STUDENTS, type AnalyticsSnapshot } from '@/data/coach';
import { supabase } from '@/lib/supabase';
import { FEATURE_FLAGS } from '@/lib/entitlements';

interface Props {
  account: { id: string; name: string };
}

export function CoachImpactView({ account }: Props) {
  const [range, setRange] = useState<'30d' | '90d' | 'since' | 'all'>('since');
  const [snapshots, setSnapshots] = useState<{ date: string; active_students: number; avg_spi: number; avg_roi: number; avg_bb100: number; pct_improved: number; hours: number; revenue: number }[]>([]);

  const activeStudents = COACH_STUDENTS.filter((s) => s.status === 'active');

  // Calculate before/since coaching for each student
  const studentProgress = activeStudents.map((s) => {
    const baseline = s.journey[0]?.snapshot;
    const current = s.currentSnapshot;
    if (!baseline || !current) return null;
    return {
      name: s.name,
      initials: s.avatarInitials,
      baseline,
      current,
      spiDelta: current.spi - baseline.spi,
      roiDelta: current.roi - baseline.roi,
      bb100Delta: current.bb100 - baseline.bb100,
      profitDelta: current.profit - baseline.profit,
      improved: current.spi > baseline.spi,
    };
  }).filter(Boolean);

  const avgSpiImprovement = studentProgress.length > 0
    ? (studentProgress.reduce((sum, p) => sum + (p?.spiDelta ?? 0), 0) / studentProgress.length).toFixed(1)
    : '0.0';
  const avgRoiImprovement = studentProgress.length > 0
    ? (studentProgress.reduce((sum, p) => sum + (p?.roiDelta ?? 0), 0) / studentProgress.length).toFixed(1)
    : '0.0';
  const avgBb100Improvement = studentProgress.length > 0
    ? (studentProgress.reduce((sum, p) => sum + (p?.bb100Delta ?? 0), 0) / studentProgress.length).toFixed(1)
    : '0.0';
  const pctImproved = studentProgress.length > 0
    ? Math.round((studentProgress.filter((p) => p?.improved).length / studentProgress.length) * 100)
    : 0;

  const totalHours = COACH_STUDENTS.flatMap((s) => s.sessions.filter((sess) => sess.status === 'completed'))
    .reduce((sum, s) => sum + s.durationMinutes, 0) / 60;
  const monthlyRevenue = COACH_STUDENTS.flatMap((s) => s.sessions.filter((sess) => sess.status === 'completed')).length * 150;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Coaching Impact</h2>
            <p className="text-[10px] text-[#5f6e7c]">Measurable evidence of your coaching results</p>
          </div>
        </div>

        {/* Range Selector */}
        <div className="flex gap-2">
          {([['30d', 'Last 30 Days'], ['90d', 'Last 90 Days'], ['since', 'Since Coaching Started'], ['all', 'All Time']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setRange(id)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${range === id ? 'border border-[#c0911e]/40 bg-[#c0911e]/10 text-[#d4a52c]' : 'border border-[#232a32] bg-[#161b21] text-[#5f6e7c]'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Impact Summary Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <ImpactCard label="Active Students" value={`${activeStudents.length}`} icon={Users} />
          {FEATURE_FLAGS.spiEnabled && <ImpactCard label="Avg SPI Improvement" value={`+${avgSpiImprovement}`} icon={TrendingUp} green />}
          <ImpactCard label="Avg ROI Improvement" value={`+${avgRoiImprovement}%`} icon={BarChart3} green />
          <ImpactCard label="Avg BB/100 Improvement" value={`+${avgBb100Improvement}`} icon={Target} green />
          <ImpactCard label="Students Improved" value={`${pctImproved}%`} icon={Award} gold />
        </div>

        {/* Revenue & Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="metal-panel rounded-xl p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Total Hours Coached</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-white">{totalHours.toFixed(1)}</div>
          </div>
          <div className="metal-panel rounded-xl p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
              <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Monthly Coaching Revenue</span>
            </div>
            <div className="mt-2 text-3xl font-bold text-[#d4a52c]">${monthlyRevenue.toLocaleString()}</div>
          </div>
        </div>

        {/* Student-by-Student Before/After */}
        <div>
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Student Progress — Before vs Since Coaching</h3>
          <div className="space-y-3">
            {studentProgress.map((p) => p && (
              <div key={p.name} className="metal-panel rounded-xl p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xs font-bold text-[#d4a52c]">{p.initials}</div>
                  <div>
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="text-[10px] text-[#5f6e7c]">{p.improved ? 'Improved' : 'No improvement yet'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                  {FEATURE_FLAGS.spiEnabled && <BeforeAfter label="SPI" before={`${p.baseline.spi}`} after={`${p.current.spi}`} delta={p.spiDelta >= 0 ? `+${p.spiDelta}` : `${p.spiDelta}`} positive={p.spiDelta >= 0} />}
                  <BeforeAfter label="ROI" before={`${p.baseline.roi}%`} after={`${p.current.roi}%`} delta={p.roiDelta >= 0 ? `+${p.roiDelta.toFixed(1)}%` : `${p.roiDelta.toFixed(1)}%`} positive={p.roiDelta >= 0} />
                  <BeforeAfter label="BB/100" before={`+${p.baseline.bb100}`} after={`+${p.current.bb100}`} delta={p.bb100Delta >= 0 ? `+${p.bb100Delta.toFixed(1)}` : `${p.bb100Delta.toFixed(1)}`} positive={p.bb100Delta >= 0} />
                  <BeforeAfter label="Profit" before={`+$${p.baseline.profit.toLocaleString()}`} after={`+$${p.current.profit.toLocaleString()}`} delta={`+$${p.profitDelta.toLocaleString()}`} positive={p.profitDelta >= 0} />
                  <BeforeAfter label="ABI" before={`$${p.baseline.abi}`} after={`$${p.current.abi}`} delta={p.current.abi - p.baseline.abi >= 0 ? `+$${p.current.abi - p.baseline.abi}` : `-$${p.baseline.abi - p.current.abi}`} positive={p.current.abi >= p.baseline.abi} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/30 p-4 text-center">
          <p className="text-[10px] text-[#5f6e7c]">
            Statistics are calculated from students who have granted analytics access and have sufficient data.
            Improvement metrics compare baseline snapshots to current analytics.
          </p>
        </div>
      </div>
    </div>
  );
}

function ImpactCard({ label, value, icon: Icon, gold, green }: { label: string; value: string; icon: typeof Users; gold?: boolean; green?: boolean }) {
  return (
    <div className="rounded-xl border border-[#1a1f25] bg-[#11151a]/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</div>
        <Icon className="h-4 w-4 text-[#38424e]" strokeWidth={1.5} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${gold ? 'text-[#d4a52c]' : green ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function BeforeAfter({ label, before, after, delta, positive }: { label: string; before: string; after: string; delta: string; positive: boolean }) {
  return (
    <div className="rounded-lg border border-[#1a1f25] bg-[#0a0c0e]/40 p-3 text-center">
      <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{label}</div>
      <div className="mt-1 text-xs text-[#5f6e7c] line-through">{before}</div>
      <div className="text-sm font-bold text-white">{after}</div>
      <div className={`mt-1 text-[10px] font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{delta}</div>
    </div>
  );
}
