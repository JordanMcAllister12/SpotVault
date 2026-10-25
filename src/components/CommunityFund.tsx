import { useState, useMemo } from 'react';
import {
  ArrowLeft, ArrowRight, Trophy, GraduationCap, HeartPulse, Building2,
  Briefcase, Camera, TrendingUp, Users, Calendar, ExternalLink, Lock,
  type LucideIcon,
} from 'lucide-react';
import {
  FUND_CATEGORIES, FEATURED_INITIATIVE, PAST_INITIATIVES, FUND_STATS,
  type FundInitiative, type FundCategory,
} from '@/data/communityFund';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

interface Props {
  onBack: () => void;
}

export function CommunityFund({ onBack }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<FundCategory | null>(null);

  const filteredPast = useMemo(() => {
    if (!selectedCategory) return PAST_INITIATIVES;
    return PAST_INITIATIVES.filter((i) => i.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050608]">
      {/* Ambient background — warm poker-felt gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0805] via-[#070605] to-[#050608]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,165,44,0.08), transparent 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col overflow-y-auto">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-white/60 uppercase transition-all hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Community
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
            <span className="text-[10px] font-mono tracking-[0.25em] text-[#c0911e]/70 uppercase">
              SpotVault Community Fund
            </span>
          </div>
        </header>

        {/* Hero */}
        <section className="shrink-0 px-6 pt-4 pb-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[10px] font-mono tracking-[0.3em] text-white/40 uppercase">
              Returned to Poker
            </p>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span
                className="text-6xl font-bold tracking-tight sm:text-7xl"
                style={{
                  color: GOLD_SOFT,
                  textShadow: '0 0 40px rgba(212,165,44,0.3)',
                }}
              >
                ${FUND_STATS.totalReturnedToPoker.toLocaleString()}
              </span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/45">
              Funding players, opportunities, wellness, education and the future of poker.
              As SpotVault grows, we want poker to grow with us.
            </p>
          </div>
        </section>

        {/* Transparency stats */}
        <section className="shrink-0 px-6 pb-8">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Total Returned"
              value={`$${(FUND_STATS.totalReturnedToPoker / 1000).toFixed(0)}K`}
            />
            <StatCard
              icon={Trophy}
              label="Initiatives"
              value={String(FUND_STATS.totalInitiatives)}
            />
            <StatCard
              icon={Users}
              label="Players Supported"
              value={FUND_STATS.playersSupported.toLocaleString()}
            />
            <StatCard
              icon={Calendar}
              label="Current"
              value={String(FUND_STATS.currentInitiatives)}
            />
          </div>
        </section>

        {/* Featured initiative */}
        <section className="shrink-0 px-6 pb-8">
          <div className="mx-auto max-w-4xl">
            <SectionLabel>Featured Initiative</SectionLabel>
            <FeaturedCard initiative={FEATURED_INITIATIVE} />
          </div>
        </section>

        {/* Where the money goes */}
        <section className="shrink-0 px-6 pb-8">
          <div className="mx-auto max-w-4xl">
            <SectionLabel>Where the Money Goes</SectionLabel>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {FUND_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  }
                  className="group flex items-start gap-3 rounded-xl border p-4 text-left transition-all"
                  style={{
                    borderColor:
                      selectedCategory === cat.id ? `${cat.accent}40` : 'rgba(255,255,255,0.06)',
                    background:
                      selectedCategory === cat.id ? `${cat.accent}0d` : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `${cat.accent}12`,
                      border: `1px solid ${cat.accent}25`,
                    }}
                  >
                    <cat.icon className="h-4 w-4" strokeWidth={1.5} style={{ color: cat.accent }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{cat.label}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-white/40">
                      {cat.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* History */}
        <section className="shrink-0 px-6 pb-10">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between">
              <SectionLabel>
                Community Fund History
                {selectedCategory && (
                  <span className="ml-2 text-[9px] font-mono tracking-widest text-[#c0911e]/60 uppercase">
                    — {FUND_CATEGORIES.find((c) => c.id === selectedCategory)?.shortLabel}
                  </span>
                )}
              </SectionLabel>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-[9px] font-mono tracking-widest text-white/30 uppercase transition-colors hover:text-white/60"
                >
                  Show All
                </button>
              )}
            </div>
            <div className="space-y-2">
              {filteredPast.map((init) => (
                <HistoryRow key={init.id} initiative={init} />
              ))}
              {filteredPast.length === 0 && (
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] py-8 text-center">
                  <p className="text-[11px] text-white/30">No initiatives in this category yet.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="shrink-0 px-6 pb-10">
          <div className="mx-auto max-w-4xl rounded-xl border border-white/[0.04] bg-white/[0.01] px-5 py-4">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20" strokeWidth={1.5} />
              <p className="text-[10px] leading-relaxed text-white/30">
                The SpotVault Community Fund is a discretionary community reinvestment program.
                It is not equity, ownership, dividends, or profit sharing. Funding amounts are
                admin-controlled and not automatically calculated as a percentage of company profits.
                When SpotVault wins, poker wins.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ===== SUB-COMPONENTS =====

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
      style={{ boxShadow: '0 4px 24px -12px rgba(0,0,0,0.4)' }}
    >
      <Icon className="mx-auto h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
      <div className="mt-2 text-lg font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[8px] font-mono tracking-[0.2em] text-white/30 uppercase">
        {label}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[10px] font-mono tracking-[0.25em] text-white/40 uppercase">
      {children}
    </div>
  );
}

function FeaturedCard({ initiative }: { initiative: FundInitiative }) {
  const cat = FUND_CATEGORIES.find((c) => c.id === initiative.category)!;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{
        borderColor: `${cat.accent}30`,
        background: `linear-gradient(135deg, ${cat.accent}10, rgba(0,0,0,0.3))`,
        boxShadow: `0 12px 48px -16px ${cat.accent}20`,
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
              style={{ borderColor: `${cat.accent}40`, color: cat.accent }}
            >
              Featured
            </span>
            <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">
              {cat.label}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white">{initiative.title}</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/50">
            {initiative.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Prize Pool</div>
              <div className="text-lg font-bold" style={{ color: GOLD_SOFT }}>
                ${initiative.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Players</div>
              <div className="text-lg font-bold text-white">
                {initiative.playersSupported.toLocaleString()}
              </div>
            </div>
            {initiative.partner && (
              <div>
                <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">
                  Hosted With
                </div>
                <div className="text-sm font-semibold text-white/70">{initiative.partner}</div>
              </div>
            )}
          </div>
        </div>
        {initiative.externalLink && (
          <a
            href={initiative.externalLink}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-5 py-3 text-[10px] font-bold tracking-[0.15em] uppercase transition-all hover:bg-white/5"
            style={{ borderColor: `${cat.accent}50`, color: cat.accent }}
          >
            Learn More <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ initiative }: { initiative: FundInitiative }) {
  const cat = FUND_CATEGORIES.find((c) => c.id === initiative.category)!;
  return (
    <button
      className="group flex w-full items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3.5 text-left transition-all hover:border-white/10 hover:bg-white/[0.03]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${cat.accent}10`, border: `1px solid ${cat.accent}20` }}
      >
        <cat.icon className="h-4 w-4" strokeWidth={1.5} style={{ color: cat.accent }} />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              ${initiative.amount.toLocaleString()}
            </span>
            <span className="text-xs text-white/50">— {initiative.title}</span>
          </div>
          <div className="mt-0.5 text-[9px] font-mono tracking-widest text-white/25 uppercase">
            {cat.shortLabel}
            {initiative.playersSupported > 0 &&
              ` · ${initiative.playersSupported} players`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[7px] font-bold tracking-widest uppercase"
            style={{
              borderColor:
                initiative.status === 'completed' ? 'rgba(255,255,255,0.08)' : `${cat.accent}30`,
              color: initiative.status === 'completed' ? 'rgba(255,255,255,0.3)' : cat.accent,
            }}
          >
            {initiative.status}
          </span>
          <ExternalLink className="h-3 w-3 text-white/15 transition-colors group-hover:text-white/40" strokeWidth={1.5} />
        </div>
      </div>
    </button>
  );
}
