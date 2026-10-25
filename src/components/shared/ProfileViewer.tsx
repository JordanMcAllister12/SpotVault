import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProfilePage } from '@/components/ProfilePage';

export interface ProfileViewerProps {
  targetUserId: string;
  fallbackName?: string;
  isOwn?: boolean;
  initialTab?: 'about' | 'network' | 'accolades' | 'activity';
  onBack: () => void;
  onMessage?: (accountId: string) => void;
  /** Scroll position to restore when returning to feed */
  savedScrollTop?: number;
  onRestoreScroll?: (top: number) => void;
}

export function ProfileViewer({
  targetUserId,
  fallbackName,
  isOwn = false,
  initialTab,
  onBack,
  onMessage,
}: ProfileViewerProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [animState, setAnimState] = useState<'entering' | 'settled'>('entering');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimState('settled'), 450);
    return () => clearTimeout(timer);
  }, []);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  if (prefersReducedMotion) {
    return (
      <div
        className="absolute inset-0 z-30"
        style={{
          animation: 'profile-fade-in 250ms ease-out forwards',
        }}
      >
        <ProfilePage
          accountId={targetUserId}
          fallbackName={fallbackName}
          isOwn={isOwn}
          initialTab={initialTab}
          onBack={handleBack}
          onMessage={onMessage}
          embedded
        />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 z-30"
        style={{
          animation: 'profile-slide-in 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      >
        <ProfilePage
          accountId={targetUserId}
          fallbackName={fallbackName}
          isOwn={isOwn}
          initialTab={initialTab}
          onBack={handleBack}
          onMessage={onMessage}
          embedded
        />
      </div>
    );
  }

  // Desktop: 180-degree vertical-axis card flip
  const isEntering = animState === 'entering';
  const frontRotate = isEntering ? 0 : -180;
  const backRotate = isEntering ? 180 : 0;

  return (
    <div className="absolute inset-0 z-30" style={{ perspective: '1800px' }}>
      {/* Front (feed) — rotates out */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${frontRotate}deg)`,
          transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
          backfaceVisibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
      {/* Back (profile) — rotates in */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${backRotate}deg)`,
          transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
          backfaceVisibility: 'hidden',
        }}
      >
        <ProfilePage
          accountId={targetUserId}
          fallbackName={fallbackName}
          isOwn={isOwn}
          initialTab={initialTab}
          onBack={handleBack}
          onMessage={onMessage}
          embedded
        />
      </div>
    </div>
  );
}
