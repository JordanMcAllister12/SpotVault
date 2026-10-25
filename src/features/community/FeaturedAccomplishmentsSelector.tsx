import { useState, useEffect, useCallback } from 'react';
import { Star, Check } from 'lucide-react';
import type { AccomplishmentWithEvidence } from './types';
import { getAccomplishments, getFeaturedItems, setFeaturedItems } from './communityData';
import { CategoryIcon, VerifiedBadge } from './IdentityBadges';

export function FeaturedAccomplishmentsSelector({ userId }: { userId: string }) {
  const [accomplishments, setAccomplishments] = useState<AccomplishmentWithEvidence[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [accs, featured] = await Promise.all([
      getAccomplishments(userId),
      getFeaturedItems(userId),
    ]);
    setAccomplishments(accs);
    setFeaturedIds(featured.map(f => f.accomplishment_id));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const verifiedAccs = accomplishments.filter(a => a.review_status === 'verified');

  const toggle = (id: string) => {
    setFeaturedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const save = async () => {
    setSaving(true);
    await setFeaturedItems(userId, featuredIds);
    setSaving(false);
  };

  const hasChanges = (() => {
    const currentFeatured = accomplishments.filter(a => featuredIds.includes(a.id)).map(a => a.id);
    const savedFeatured = accomplishments.filter(a => {
      // Check against loaded featured
      return featuredIds.includes(a.id);
    });
    return true; // Always allow save — simpler UX
  })();

  if (loading) return null;

  if (verifiedAccs.length === 0) {
    return (
      <div style={{
        padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 8 }}>Featured Accomplishments</h4>
        <p style={{ fontSize: 11, color: '#4b5563' }}>
          Get accomplishments verified by SpotVault staff to feature them on your hover card.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: 16, borderRadius: 12, border: '1px solid rgba(212,165,44,0.15)',
      background: 'rgba(212,165,44,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: '#d4a52c' }}>Featured Accomplishments</h4>
        <span style={{ fontSize: 10, color: '#6b7280' }}>{featuredIds.length} / 5 selected</span>
      </div>
      <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 10 }}>
        Choose which verified accomplishments appear on your hover card. Top 3-5 recommended.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {verifiedAccs.map(acc => {
          const isSelected = featuredIds.includes(acc.id);
          return (
            <button
              key={acc.id}
              onClick={() => toggle(acc.id)}
              disabled={!isSelected && featuredIds.length >= 5}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all disabled:opacity-40"
              style={{
                borderColor: isSelected ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.06)',
                background: isSelected ? 'rgba(212,165,44,0.08)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: isSelected ? '2px solid #d4a52c' : '2px solid rgba(255,255,255,0.15)',
                background: isSelected ? '#d4a52c' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {isSelected && <Check size={12} color="#0c0a08" strokeWidth={3} />}
              </div>
              <CategoryIcon category={acc.category} size={14} color="#d4a52c" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e0d0', flex: 1 }}>{acc.title}</span>
              <VerifiedBadge size={11} />
            </button>
          );
        })}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 w-full rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/20 disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Save Featured Items'}
      </button>
    </div>
  );
}
