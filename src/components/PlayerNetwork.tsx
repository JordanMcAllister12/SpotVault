import { useCallback } from 'react';
import { UniversalLounge } from '@/components/lounge/UniversalLounge';
import { SPOTVAULT_DEFAULT_LOUNGE, type LoungeConfig } from '@/lib/loungeFramework';
import { getManitobaLoungeData } from '@/lib/manitobaLoungeData';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { SpotVaultAccount } from '@/types';

export function resolveLoungeSlug(activeCustomPortal: CustomPortalMembership | null): string {
  if (activeCustomPortal?.portal_slug) return activeCustomPortal.portal_slug;
  return 'spotvault';
}

export function resolveLoungeConfigOverride(
  slug: string,
): Partial<LoungeConfig> | undefined {
  if (slug === 'manitoba-poker') {
    return {
      name: 'Manitoba Poker',
      type: 'geographic',
      defaultBackground: '/assets/lounge/image%20copy%205.webp',
      defaultBackgroundFit: 'cover',
      defaultBackgroundPosition: 'center',
      defaultOverlay: 'medium',
      feedSettings: { placeholder: "What's happening in Manitoba?", showComposer: true },
      chatSettings: { groupChannels: ['general'], enableDirect: true },
    };
  }
  if (slug.startsWith('stakekings')) {
    return {
      name: 'StakeKings Lounge',
      type: 'branded',
      defaultBackground: '/player-portal-high-roller-lounge.webp',
      defaultBackgroundFit: 'cover',
      defaultBackgroundPosition: 'center',
      defaultOverlay: 'medium',
      feedSettings: { placeholder: 'Share a strategy question or study update…', showComposer: true },
      chatSettings: { groupChannels: ['community'], enableDirect: true },
      theme: 'stakekings',
    };
  }
  return undefined;
}

export function resolveLoungeData(slug: string) {
  if (slug === 'manitoba-poker') return getManitobaLoungeData();
  if (slug === 'spotvault') return { ...getManitobaLoungeData(), region: undefined };
  return undefined;
}

interface Props {
  onClose: () => void;
  account?: SpotVaultAccount | null;
  activeCustomPortal?: CustomPortalMembership | null;
}

export function PlayerNetwork({ onClose, account, activeCustomPortal }: Props) {
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  const slug = resolveLoungeSlug(activeCustomPortal ?? null);
  const configOverride = resolveLoungeConfigOverride(slug) ?? SPOTVAULT_DEFAULT_LOUNGE;
  const data = resolveLoungeData(slug);

  return (
    <div className="fixed inset-0 z-[150]">
      <UniversalLounge
        slug={slug}
        account={account ?? null}
        onBack={handleBack}
        configOverride={configOverride}
        data={data}
      />
    </div>
  );
}
