import { useState } from 'react';
import { Users, GraduationCap, Film, BookOpen, Megaphone, Settings, ArrowLeft, type LucideIcon } from 'lucide-react';
import { getStakeKingsBackground, STAKEKINGS_BRANDING } from '@/lib/stakekingsBranding';

interface ManagementModule {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const MODULES: ManagementModule[] = [
  { id: 'players', label: 'Players', description: 'Manage StakeKings players', icon: Users },
  { id: 'coaching', label: 'Coaching', description: 'Manage coaching resources and coaches', icon: GraduationCap },
  { id: 'media', label: 'Media', description: 'Manage StakeKings media/content', icon: Film },
  { id: 'content', label: 'Content', description: 'Manage Player Development material', icon: BookOpen },
  { id: 'announcements', label: 'Announcements', description: 'Publish information to StakeKings players', icon: Megaphone },
  { id: 'settings', label: 'Portal Settings', description: 'Manage StakeKings portal configuration', icon: Settings },
];

interface StakeKingsManagementHubProps {
  onBack: () => void;
  accountName?: string;
}

export function StakeKingsManagementHub({ onBack, accountName }: StakeKingsManagementHubProps) {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const background = getStakeKingsBackground('manager');

  const module = MODULES.find((m) => m.id === activeModule);

  return (
    <div
      className="h-full w-full overflow-auto bg-[#080a0c]"
      style={background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-emerald-500/15 bg-[#0a0c0e]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-white/40 uppercase transition-colors hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Exit
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-14 items-center justify-center overflow-hidden rounded-md border border-emerald-500/30 bg-black/30 px-1">
                <img src={STAKEKINGS_BRANDING.logo} alt="StakeKings" className="max-h-full max-w-full object-contain" />
              </div>
              <div>
                <div className="text-[13px] font-bold tracking-wide text-emerald-300">STAKEKINGS</div>
                <div className="text-[9px] tracking-[0.2em] text-emerald-400/50 uppercase">Player Development</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono tracking-widest text-emerald-400/60 uppercase">Management Hub</div>
            {accountName && <div className="text-[10px] text-white/40">{accountName}</div>}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {module ? (
          /* Module detail view (placeholder) */
          <div>
            <button
              onClick={() => setActiveModule(null)}
              className="mb-4 flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-white/40 uppercase transition-colors hover:text-white/70"
            >
              <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
              Back to Modules
            </button>
            <div className="rounded-xl border border-emerald-500/15 bg-[#0a0c0e] p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <module.icon className="h-6 w-6 text-emerald-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-wide text-white">{module.label}</h2>
                  <p className="text-[11px] text-white/40">{module.description}</p>
                </div>
              </div>
              <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-16">
                <module.icon className="h-8 w-8 text-white/15" strokeWidth={1} />
                <p className="mt-3 text-[12px] text-white/30">This module is not yet available.</p>
                <p className="mt-1 text-[10px] text-white/20">Functionality will be added here in a future update.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Module grid */
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold tracking-wide text-white sm:text-2xl">Management Hub</h1>
              <p className="mt-1 text-[11px] text-white/40">Manage your StakeKings Player Development ecosystem</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-emerald-500/15 bg-[#0a0c0e] p-5 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-950/20"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 transition-colors group-hover:border-emerald-500/40 group-hover:bg-emerald-500/15">
                    <m.icon className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold tracking-wide text-white">{m.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-white/40">{m.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
