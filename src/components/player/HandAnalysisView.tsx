import { HHReplayerView } from '@/components/player/HHReplayerView';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface HandAnalysisViewProps {
  userId?: string;
  initialBatchId?: string | null;
  onBatchConsumed?: () => void;
  initialHandId?: string | null;
  onHandConsumed?: () => void;
}

export function HandAnalysisView({ userId, initialBatchId, onBatchConsumed, initialHandId, onHandConsumed }: HandAnalysisViewProps) {
  return (
    <ErrorBoundary variant="widget">
      <HHReplayerView
        userId={userId}
        initialBatchId={initialBatchId}
        onBatchConsumed={onBatchConsumed}
        initialHandId={initialHandId}
        onHandConsumed={onHandConsumed}
      />
    </ErrorBoundary>
  );
}
