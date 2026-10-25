import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MySpotsView } from '@/components/player/MySpotsView';
import { MyLibraryView } from '@/components/player/MyLibraryView';
import { PublicLibraryView } from '@/components/player/PublicLibraryView';
import { HandAnalysisView } from '@/components/player/HandAnalysisView';
import { AnalyticsView } from '@/components/player/AnalyticsView';
import { ContentLabView } from '@/components/player/ContentLabView';
import { StudentCenter } from '@/components/player/StudentCenter';
import { ProfileSettingsHub, type HubTab } from '@/components/player/ProfileSettingsHub';
import { Store } from '@/components/Store';
import { SolverHub } from '@/components/solver/SolverHub';
import type { SpotVaultAccount } from '@/types';

export interface SharedPlayerViewProps {
  view: string;
  account: SpotVaultAccount | null;
  onNavigate?: (view: string) => void;
  profileInitialTab?: HubTab;
  onPlayHand?: (handId: string) => void;
}

export function renderSharedPlayerView({ view, account, onNavigate, profileInitialTab = 'profile', onPlayHand }: SharedPlayerViewProps) {
  switch (view) {
    case 'my-spots':
      return <MySpotsView />;
    case 'my-library':
      return <MyLibraryView />;
    case 'public-library':
      return <PublicLibraryView />;
    case 'hand-analysis':
      return (
        <ErrorBoundary variant="widget">
          <HandAnalysisView userId={account?.id} />
        </ErrorBoundary>
      );
    case 'hh-workspace':
      return (
        <ErrorBoundary variant="widget">
          <HandAnalysisView userId={account?.id} />
        </ErrorBoundary>
      );
    case 'analytics':
      return (
        <ErrorBoundary variant="widget">
          <AnalyticsView userId={account?.id} account={account} onPlayHand={onPlayHand} />
        </ErrorBoundary>
      );
    case 'content-lab':
      return account ? (
        <ErrorBoundary variant="widget">
          <ContentLabView account={account} onOpenLibrary={() => onNavigate?.('my-library')} />
        </ErrorBoundary>
      ) : null;
    case 'solver':
      return account ? (
        <ErrorBoundary variant="widget">
          <SolverHub account={account} isSuperUser={false} />
        </ErrorBoundary>
      ) : null;
    case 'market-store':
    case 'spot-store':
    case 'multispot-store':
    case 'stakekings-action':
    case 'marketplace':
      return <Store account={account} />;
    case 'profile':
      return account ? (
        <ProfileSettingsHub
          account={account}
          onBack={() => onNavigate?.('home')}
          initialTab={profileInitialTab}
        />
      ) : null;
    default:
      return null;
  }
}
