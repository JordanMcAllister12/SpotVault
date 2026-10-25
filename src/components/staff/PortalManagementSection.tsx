import { useState, useEffect } from 'react';
import { Crown, Users, KeyRound, Loader2, Check, X, Calendar } from 'lucide-react';
import { getAllCustomPortals, getAllAccessCodes, getPortalMembers } from '@/lib/portalAccessStore';

interface PortalInfo {
  id: string;
  slug: string;
  name: string;
  base_portal: string;
  active: boolean;
  config: {
    backgrounds?: { lounge?: string; community?: string };
    logo?: string;
    communityId?: string;
  };
}

interface CodeInfo {
  id: string;
  portal_id: string;
  code: string;
  active: boolean;
  redemption_count: number;
  redemption_limit: number | null;
  access_duration_months: number;
  membership_tier: string;
  new_users_only: boolean;
}

export function PortalManagementSection() {
  const [portals, setPortals] = useState<PortalInfo[]>([]);
  const [codes, setCodes] = useState<CodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPortal, setExpandedPortal] = useState<string | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([getAllCustomPortals(), getAllAccessCodes()]);
    setPortals(p as PortalInfo[]);
    setCodes(c as CodeInfo[]);

    // Load member counts for each portal
    const counts: Record<string, number> = {};
    for (const portal of p) {
      const members = await getPortalMembers(portal.id);
      counts[portal.id] = members.length;
    }
    setMemberCounts(counts);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#d4a52c]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
        <h2 className="text-sm font-bold tracking-[0.2em] text-white uppercase">Portals & Access Codes</h2>
      </div>

      {portals.length === 0 && (
        <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/50 px-4 py-8 text-center">
          <p className="text-xs text-white/40">No custom portals configured.</p>
        </div>
      )}

      {portals.map((portal) => {
        const portalCodes = codes.filter((c) => c.portal_id === portal.id);
        const isExpanded = expandedPortal === portal.id;
        return (
          <div key={portal.id} className="rounded-xl border border-[#1a1f25] bg-[#11151a]/60 overflow-hidden">
            {/* Portal header */}
            <button
              type="button"
              onClick={() => setExpandedPortal(isExpanded ? null : portal.id)}
              className="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-[#11151a]/80"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10">
                  <Crown className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{portal.name}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                    <span>{portal.slug}</span>
                    <span className="text-[#2a323b]">·</span>
                    <span>Base: {portal.base_portal}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${portal.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                  {portal.active ? 'Active' : 'Inactive'}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#84929f]">
                  <Users className="h-3 w-3" strokeWidth={1.5} />
                  {memberCounts[portal.id] ?? 0}
                </span>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-[#1a1f25] px-4 py-4">
                {/* Access codes */}
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] text-[#5f6e7c] uppercase">
                    <KeyRound className="h-3 w-3" strokeWidth={1.5} />
                    Access Codes
                  </div>
                  {portalCodes.length === 0 ? (
                    <p className="text-[11px] text-white/30">No codes configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {portalCodes.map((code) => (
                        <div key={code.id} className="flex items-center justify-between rounded-lg border border-[#1a1f25] bg-[#0a0c0e]/50 px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <code className="text-[12px] font-mono font-bold text-[#d4a52c]">{code.code}</code>
                            <span className={`flex items-center gap-1 text-[9px] font-mono tracking-widest uppercase ${code.active ? 'text-emerald-400' : 'text-red-400'}`}>
                              {code.active ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                              {code.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-[#84929f]">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" strokeWidth={1.5} />
                              {code.access_duration_months}mo
                            </span>
                            <span>
                              {code.redemption_count}
                              {code.redemption_limit ? ` / ${code.redemption_limit}` : ''}
                            </span>
                            <span className="font-mono tracking-widest uppercase">{code.membership_tier}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Config */}
                <div>
                  <div className="mb-2 text-[10px] font-mono tracking-[0.2em] text-[#5f6e7c] uppercase">Configuration</div>
                  <div className="rounded-lg border border-[#1a1f25] bg-[#0a0c0e]/50 px-3 py-2.5 text-[11px] text-[#84929f]">
                    {portal.config?.backgrounds?.lounge && (
                      <div className="mb-1"><span className="text-[#5f6e7c]">Lounge BG:</span> {portal.config.backgrounds.lounge}</div>
                    )}
                    {portal.config?.backgrounds?.community && (
                      <div className="mb-1"><span className="text-[#5f6e7c]">Community BG:</span> {portal.config.backgrounds.community}</div>
                    )}
                    {portal.config?.communityId && (
                      <div><span className="text-[#5f6e7c]">Community ID:</span> {portal.config.communityId}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
