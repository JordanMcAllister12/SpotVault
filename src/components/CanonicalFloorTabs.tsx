import type { NavDestination, NavDirection, NavPortal } from '@/lib/navigation';

interface Props {
  currentDestination: NavDestination;
  currentPortal: NavPortal;
  onNavigate: (direction: NavDirection) => void;
  isMobile?: boolean;
  disabled?: boolean;
}

export function CanonicalFloorTabs(_props: Props) {
  return null;
}
