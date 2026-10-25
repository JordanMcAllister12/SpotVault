import { CoachChat } from '@/components/coach/CoachChat';

export function CoachDashboardWorkspace({ coachId, demoMode }: { coachId: string; demoMode: boolean }) {
  return (
    <div className="h-full w-full p-4">
      <CoachChat coachId={coachId} demoMode={demoMode} />
    </div>
  );
}
