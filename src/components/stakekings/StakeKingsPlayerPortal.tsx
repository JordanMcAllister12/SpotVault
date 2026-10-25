import { useState } from 'react';
import { PlayerHub } from '@/components/PlayerHub';
import { CommunityHub } from '@/components/CommunityHub';
import { getStakeKingsBackground, STAKEKINGS_BRANDING } from '@/lib/stakekingsBranding';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { getPortalTheme } from '@/lib/portalTheme';
import type { Demo } from '@/useDemo';
import type { UniversalView } from '@/components/UniversalRail';
import type { HubId } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';

interface StakeKingsPlayerPortalProps {
  demo: Demo;
  onExitHub: () => void;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  onOpenCredits: () => void;
  onNetworkDirectory: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateRight?: () => void;
  onOpenMessaging?: () => void;
  onLogout?: () => void;
  initialView?: string;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onReturnToDefault?: () => void;
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  activePortalSlug?: string | null;
}

export function StakeKingsPlayerPortal({
  demo,
  onExitHub,
  onSwitchPortal,
  portalSwitchOpen,
  onTogglePortalSwitch,
  onClosePortalSwitch,
  onOpenUniversalView,
  onOpenCredits,
  onNetworkDirectory,
  onNavigateUp,
  onNavigateDown,
  onNavigateRight,
  onOpenMessaging,
  onLogout,
  initialView,
  onOpenCustomPortals,
  customPortalLabel,
  activePortalId,
  customPortals,
  onReturnToDefault,
  onEnterCustomPortal,
  activePortalSlug,
}: StakeKingsPlayerPortalProps) {
  const background = getStakeKingsBackground('player');
  const [overlay, setOverlay] = useState<'community' | null>(null);
  const prefs = useUserPreferences(demo.state.currentAccount?.id);
  const theme = getPortalTheme(prefs.prefs.stakekingsTheme);

  if (overlay === 'community') {
    return (
      <CommunityHub
        onBackToHub={() => setOverlay(null)}
        account={demo.state.currentAccount}
        onOpenUniversalView={onOpenUniversalView}
        onNavigateToPortal={() => {}}
        originPortalName="StakeKings Portal"
        onReturnToPortal={() => setOverlay(null)}
      />
    );
  }

  return (
    <PlayerHub
      demo={demo}
      onExitHub={onExitHub}
      onNetworkDirectory={onNetworkDirectory}
      onOpenCredits={onOpenCredits}
      onSwitchPortal={onSwitchPortal}
      portalSwitchOpen={portalSwitchOpen}
      onTogglePortalSwitch={onTogglePortalSwitch}
      onClosePortalSwitch={onClosePortalSwitch}
      onOpenUniversalView={onOpenUniversalView}
      onNavigateUp={onNavigateUp}
      onNavigateDown={onNavigateDown}
      onNavigateRight={onNavigateRight}
      onOpenCommunity={() => setOverlay('community')}
      onOpenMessaging={onOpenMessaging}
      portalChatActive={false}
      onPortalChatActiveChange={() => {}}
      portalLogoOverride={STAKEKINGS_BRANDING.logo}
      backgroundOverride={background}
      portalLabelOverride="StakeKings"
      roomLabelOverride="StakeKings Player Development"
      portalContext="stakekings"
      accentOverride={theme.accent}
      onLogout={onLogout}
      initialView={initialView}
      onOpenCustomPortals={onOpenCustomPortals}
      customPortalLabel={customPortalLabel}
      activePortalId={activePortalId}
      customPortals={customPortals}
      onReturnToDefault={onReturnToDefault}
      onEnterCustomPortal={onEnterCustomPortal}
      activePortalSlug={activePortalSlug}
    />
  );
}
