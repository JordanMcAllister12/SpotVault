import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import { getStakeKingsBackground } from '@/lib/stakekingsBranding';

export function getCustomPortalBackground(
  portal: CustomPortalMembership | null,
  kind: 'player' | 'manager' = 'player',
): string | null {
  if (!portal) return null;

  const fromConfig = portal.config?.backgrounds?.lounge ?? null;
  if (fromConfig) return fromConfig;

  const slug = portal.portal_slug ?? '';
  if (slug.startsWith('stakekings')) {
    return getStakeKingsBackground(kind);
  }
  return null;
}
