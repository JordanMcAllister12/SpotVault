// StakeKings branding constants — isolated from SpotVault's own theme.
// The logo path points to the dedicated StakeKings logo asset.
// All StakeKings non-community surfaces use the dedicated portal artwork.

export const STAKEKINGS_OWNER_TEST_USER_ID = '17ca0743-ccdb-4d43-ab24-f84aa2821170';

export const STAKEKINGS_BRANDING = {
  logo: '/stakekings_logo.webp',
  playerBackground: '/assets/stakekings/image.webp',
  loungeBackground: '/assets/stakekings/image.webp',
  managerBackground: '/assets/stakekings/image.webp',
} as const;

export function getStakeKingsBackground(kind: 'player' | 'manager'): string | null {
  return kind === 'player'
    ? STAKEKINGS_BRANDING.playerBackground
    : STAKEKINGS_BRANDING.managerBackground;
}
