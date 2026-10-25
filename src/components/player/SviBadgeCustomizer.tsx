import { useState, useEffect, useCallback } from 'react';
import { Shield, Palette, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchSviUserRank,
  fetchSviHonors,
  sviRank,
  sviDivision,
  SVI_DIVISIONS,
  SVI_RANKS,
  type SviUserRank,
  type SviHonor,
} from '@/lib/sviStore';
import {
  setSviBadgePrefs,
  type SviBadgePrefs,
} from '@/lib/staffMetadataStore';
import { useStaffBadge } from '@/hooks/useStaffBadge';
import { RankInsignia, rankKeyToLabel, rankKeyToColor, divisionLabel, divisionColor } from '@/components/player/SviRankBadge';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

const BADGE_STYLES = [
  { id: 0, label: 'Solid', bg: '#1a1208', border: 'rgba(212,165,44,0.3)' },
  { id: 1, label: 'Gold Gradient', bg: 'linear-gradient(135deg, #4D3715, #B78B37)', border: 'rgba(215,180,95,0.4)' },
  { id: 2, label: 'Charcoal', bg: '#0c0a08', border: 'rgba(255,255,255,0.12)' },
  { id: 3, label: 'Division Color', bg: '', border: '' },
];

const COLOR_PRESETS = [
  '#1a1208', '#0c0a08', '#1a1a2e', '#0f52ba', '#50c878',
  '#cd7f32', '#c0c0c0', '#ffd700', '#e0115f', '#b9f2ff',
  '#4D3715', '#80601F', '#B78B37', '#D7B45F', '#d4a52c',
];

const TEXT_COLOR_PRESETS = [
  '#f5e6b0', '#ffffff', '#D7B45F', '#d4a52c', '#0a0908',
  '#1a1200', '#bbf7d0', '#c5d8f7', '#fbbf24', '#9ca3af',
];

interface Props {
  userId: string;
}

export function SviBadgeCustomizer({ userId }: Props) {
  const [rankData, setRankData] = useState<SviUserRank | null>(null);
  const [honors, setHonors] = useState<SviHonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const meta = useStaffBadge(userId);

  const [prefs, setPrefs] = useState<SviBadgePrefs>({
    selectedDisplay: 'badge',
    badgeBg: '#1a1208',
    badgeText: '#f5e6b0',
    badgeStyle: 0,
  });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [rank, hon] = await Promise.all([
        fetchSviUserRank(userId),
        fetchSviHonors(userId),
      ]);
      if (!mounted) return;
      setRankData(rank);
      setHonors(hon);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (meta?.svi_badge_prefs) {
      setPrefs({
        selectedDisplay: meta.svi_badge_prefs.selectedDisplay ?? 'badge',
        badgeBg: meta.svi_badge_prefs.badgeBg ?? '#1a1208',
        badgeText: meta.svi_badge_prefs.badgeText ?? '#f5e6b0',
        badgeStyle: meta.svi_badge_prefs.badgeStyle ?? 0,
      });
    }
  }, [meta?.svi_badge_prefs]);

  const rank = rankData ? sviRank(rankData.division_rank, rankData.total_in_division) : null;
  const div = rankData ? sviDivision(rankData.svi_score) : null;
  const rankColor = rank ? rankKeyToColor(rank.key) : '#9ca3af';
  const divColor = div ? divisionColor(rankData!.division) : '#9ca3af';

  const handleSave = useCallback(async () => {
    setSaving(true);
    const result = await setSviBadgePrefs(userId, prefs);
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [userId, prefs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border border-white/20 border-t-[#d4a52c]" />
      </div>
    );
  }

  if (!rankData) {
    return (
      <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(8,10,12,0.5)' }}>
        <Shield className="mx-auto mb-2 h-7 w-7 text-white/15" strokeWidth={1.5} />
        <p className="text-xs text-white/30">Opt in to SVI and earn a division rank to customize your military badge.</p>
      </div>
    );
  }

  const badgeBg = prefs.badgeStyle === 3
    ? divColor
    : BADGE_STYLES[prefs.badgeStyle ?? 0].bg || '#1a1208';
  const badgeBorder = prefs.badgeStyle === 3
    ? `${divColor}66`
    : BADGE_STYLES[prefs.badgeStyle ?? 0].border;

  const displayOptions: { key: SviBadgePrefs['selectedDisplay']; label: string; render: () => React.ReactNode }[] = [
    {
      key: 'badge',
      label: 'Class/Rank Badge',
      render: () => (
        <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
          style={{ color: prefs.badgeText, background: badgeBg, borderColor: badgeBorder }}>
          <RankInsignia rankKey={rank?.key ?? 'lieutenant'} size={14} color={rankColor} />
          {rank ? rank.label : 'Lieutenant'}
        </span>
      ),
    },
    {
      key: 'rank',
      label: 'Military Rank',
      render: () => (
        <span className="inline-flex items-center gap-1 text-[8px] font-bold tracking-widest uppercase"
          style={{ color: rankColor }}>
          <RankInsignia rankKey={rank?.key ?? 'lieutenant'} size={14} color={rankColor} />
          {rank?.label ?? 'Lieutenant'}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Division Title',
      render: () => (
        <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase"
          style={{ color: divColor, borderColor: `${divColor}44`, background: `${divColor}12` }}>
          {div ? divisionLabel(rankData!.division) : 'Recruit'}
        </span>
      ),
    },
    {
      key: 'player',
      label: 'Player (No Badge)',
      render: () => <span className="text-[8px] text-white/30">No badge displayed</span>,
    },
  ];

  const cycleStyle = (dir: number) => {
    setPrefs(p => ({
      ...p,
      badgeStyle: ((p.badgeStyle ?? 0) + dir + BADGE_STYLES.length) % BADGE_STYLES.length,
    }));
  };

  return (
    <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: 'rgba(212,165,44,0.10)', background: 'rgba(8,10,12,0.75)', backdropFilter: 'blur(8px)' }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-1.5">
        <Shield className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h3 className="text-[11px] font-bold tracking-widest text-white/50 uppercase">Military Badge Customization</h3>
      </div>

      {/* Rank info summary */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'rgba(212,165,44,0.08)', background: 'rgba(5,7,9,0.5)' }}>
        <RankInsignia rankKey={rank?.key ?? 'lieutenant'} size={40} color={rankColor} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold" style={{ color: rankColor }}>{rank?.label ?? 'Lieutenant'}</div>
          <div className="text-[10px] text-white/40">
            {div ? divisionLabel(rankData!.division) : 'Recruit'} Division · #{rankData!.division_rank}/{rankData!.total_in_division}
          </div>
        </div>
      </div>

      {/* Display option selector */}
      <div className="mb-4">
        <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Display Beside Username</div>
        <div className="grid grid-cols-2 gap-2">
          {displayOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPrefs(p => ({ ...p, selectedDisplay: opt.key }))}
              className="flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all"
              style={{
                borderColor: prefs.selectedDisplay === opt.key ? GOLD : 'rgba(255,255,255,0.06)',
                background: prefs.selectedDisplay === opt.key ? 'rgba(212,165,44,0.08)' : 'rgba(5,7,9,0.4)',
              }}
            >
              <div className="flex items-center gap-2">
                {opt.render()}
                <span className="text-[10px] font-semibold text-white/60">{opt.label}</span>
              </div>
              {prefs.selectedDisplay === opt.key && <Check className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={2} />}
            </button>
          ))}
        </div>
      </div>

      {/* Badge style cycling — only relevant when badge display is selected */}
      {prefs.selectedDisplay === 'badge' && (
        <div className="mb-4">
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">Badge Style</div>
          <div className="flex items-center gap-2">
            <button onClick={() => cycleStyle(-1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="flex flex-1 items-center justify-center rounded-lg border py-2.5" style={{ borderColor: badgeBorder, background: badgeBg }}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase" style={{ color: prefs.badgeText }}>
                <RankInsignia rankKey={rank?.key ?? 'lieutenant'} size={18} color={rankColor} />
                {rank?.label ?? 'Lieutenant'}
                {div && <span className="opacity-60">· {divisionLabel(rankData!.division)}</span>}
              </span>
            </div>
            <button onClick={() => cycleStyle(1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white">
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="mt-1 text-center text-[9px] text-white/30">{BADGE_STYLES[prefs.badgeStyle ?? 0].label}</div>
        </div>
      )}

      {/* Color customization — only when badge display is selected */}
      {prefs.selectedDisplay === 'badge' && (
        <div className="mb-4 space-y-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">
              <Palette className="h-3 w-3" strokeWidth={1.5} /> Badge Background
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setPrefs(p => ({ ...p, badgeBg: c }))}
                  className="h-6 w-6 rounded-md border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: prefs.badgeBg === c ? GOLD : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-white/40 uppercase">
              <Palette className="h-3 w-3" strokeWidth={1.5} /> Text Color
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setPrefs(p => ({ ...p, badgeText: c }))}
                  className="h-6 w-6 rounded-md border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: prefs.badgeText === c ? GOLD : 'rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Honors display */}
      {honors.length > 0 && (
        <div className="mb-4 border-t border-white/[0.06] pt-3">
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">Earned Honors</div>
          <div className="flex flex-wrap gap-3">
            {honors.map(h => (
              <div key={h.honor_key} className="flex items-center gap-1.5">
                <RankInsignia rankKey={rank?.key ?? 'lieutenant'} size={20} color={GOLD} />
                <span className="text-[9px] font-semibold text-white/50">{h.honor_key.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-50"
        style={{ borderColor: `${GOLD}40`, background: `${GOLD}15`, color: GOLD_SOFT, minHeight: 40 }}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : saved ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />}
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Badge Preferences'}
      </button>
    </div>
  );
}
