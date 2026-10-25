import { useEffect, useState } from 'react';
import { Activity, Users, Clock, CheckCircle, XCircle, Loader, Database, Layers } from 'lucide-react';
import type { SolverJob } from '@/lib/solver/types';
import { ReferenceDataImport } from './ReferenceDataImport';
import { ReferenceRangeAdmin } from './ReferenceRangeAdmin';

interface SolverAdminProps {
  jobs: SolverJob[];
  onLoadJobs: () => Promise<void>;
}

export function SolverAdmin({ jobs, onLoadJobs }: SolverAdminProps) {
  useEffect(() => {
    onLoadJobs();
  }, [onLoadJobs]);

  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'jobs' | 'import'>('jobs');
  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

  const stats = {
    total: jobs.length,
    complete: jobs.filter((j) => j.status === 'complete').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    mockProvider: jobs.filter((j) => j.provider === 'mock').length,
    realProvider: jobs.filter((j) => j.provider !== 'mock').length,
  };

  const avgProcessingTime = (() => {
    const completed = jobs.filter((j) => j.status === 'complete' && j.started_at && j.completed_at);
    if (completed.length === 0) return 0;
    const totalMs = completed.reduce((sum, j) => {
      return sum + (new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());
    }, 0);
    return totalMs / completed.length / 1000;
  })();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-bold text-white">Solver Admin</h1>
        <div className="ml-4 flex gap-1.5">
          <button
            onClick={() => setView('jobs')}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${
              view === 'jobs'
                ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Activity className="mr-1 inline h-3 w-3" /> Jobs
          </button>
          <button
            onClick={() => setView('import')}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${
              view === 'import'
                ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Database className="h-3 w-3" /> Reference Data
          </button>
          <button
            onClick={() => setView('library')}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition-all ${
              view === 'library'
                ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Layers className="h-3 w-3" /> Range Library
          </button>
        </div>
      </div>

      {view === 'import' ? (
        <ReferenceDataImport />
      ) : view === 'library' ? (
        <ReferenceRangeAdmin />
      ) : (
        <>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard icon={Activity} label="Total Solves" value={stats.total} color="#d4a52c" />
        <StatCard icon={CheckCircle} label="Complete" value={stats.complete} color="#4ade80" />
        <StatCard icon={Loader} label="Processing" value={stats.processing} color="#3b82f6" />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} color="#ef4444" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard icon={Users} label="Mock Provider" value={stats.mockProvider} color="#a855f7" />
        <StatCard icon={Clock} label="Avg Processing" value={`${avgProcessingTime.toFixed(1)}s`} color="#d4a52c" />
        <StatCard icon={Activity} label="Real Provider" value={stats.realProvider} color="#4ade80" />
      </div>

      {/* Filter */}
      <div className="mb-3 flex gap-1.5">
        {['all', 'complete', 'processing', 'failed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold capitalize transition-all ${
              filter === f
                ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/20">
        <table className="w-full text-left text-[10px]">
          <thead className="border-b border-white/[0.06] text-[9px] font-mono tracking-widest text-white/30 uppercase">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Positions</th>
              <th className="px-3 py-2">Stack</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-white/30">No jobs found</td>
              </tr>
            ) : (
              filtered.map((job) => {
                const duration = job.started_at && job.completed_at
                  ? ((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1) + 's'
                  : '—';
                return (
                  <tr key={job.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-white/50 font-mono">{job.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        job.provider === 'mock'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-green-500/15 text-green-300'
                      }`}>
                        {job.provider}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white/60">{job.hero_position} vs {job.villain_position}</td>
                    <td className="px-3 py-2 text-white/50">{job.effective_stack_bb}BB</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-2 text-white/40">{new Date(job.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-white/40">{duration}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    complete: { color: 'text-green-300', bg: 'bg-green-500/15' },
    processing: { color: 'text-blue-300', bg: 'bg-blue-500/15' },
    failed: { color: 'text-red-300', bg: 'bg-red-500/15' },
    draft: { color: 'text-white/50', bg: 'bg-white/5' },
  };
  const c = config[status] ?? config.draft;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${c.bg} ${c.color}`}>
      {status}
    </span>
  );
}
