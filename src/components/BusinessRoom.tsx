import { BriefcaseBusiness } from 'lucide-react';
import { PortalRoomShell, PortalSecondFloor } from '@/components/PortalRoomShell';
import { BUSINESS_NAV } from '@/data/portalConfigs';
import { BusinessDesk } from '@/components/BusinessDesk';
import type { Demo } from '@/useDemo';
import type { HubId } from '@/types';
import type { UniversalView } from '@/components/UniversalRail';

interface BusinessRoomProps {
  demo: Demo;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onBack: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}

export function BusinessRoom(props: BusinessRoomProps) {
  return (
    <PortalRoomShell
      demo={props.demo}
      icon={BriefcaseBusiness}
      portalLabel="Business"
      roomLabel="Business Room"
      navItems={BUSINESS_NAV}
      activeNav="home"
      onNavigate={() => {}}
      onSwitchPortal={props.onSwitchPortal}
      portalSwitchOpen={props.portalSwitchOpen}
      onTogglePortalSwitch={props.onTogglePortalSwitch}
      onClosePortalSwitch={props.onClosePortalSwitch}
      onBack={props.onBack}
      onOpenUniversalView={props.onOpenUniversalView}
    >
      <div className="h-full overflow-auto p-6 lg:p-8">
        <BusinessDesk accent="#d4a52c" />
      </div>
    </PortalRoomShell>
  );
}

export function BusinessSecondFloor({ demo }: { demo: Demo }) {
  return <PortalSecondFloor demo={demo} label="Business Second Floor" />;
}
