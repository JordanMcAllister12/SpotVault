import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProfilePage } from '@/components/ProfilePage';
import { markProfileHandled } from '@/lib/profileEvents';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface FeedFlipCardProps {
  /** Front face content — the social feed. Stays mounted to preserve state. */
  children: React.ReactNode;
  /** Currently logged-in account id, for message permissions. */
  currentUserId: string;
  /** Message callback passed through to ProfilePage. */
  onMessage: (accountId: string) => void;
  /** Back callback passed through to ProfilePage. */
  onBack: () => void;
}

/**
 * Two-sided card that shows the social feed on the front and a user profile
 * on the back. The feed stays mounted at all times so scroll position,
 * filters, and composer state are preserved when flipping back.
 *
 * Desktop: 180-degree Y-axis 3D card flip.
 * Mobile / reduced-motion: horizontal slide.
 */
export function FeedFlipCard({ children, currentUserId, onMessage, onBack }: FeedFlipCardProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // null = front (feed), string = viewing this accountId on the back
  const [profileAccountId, setProfileAccountId] = useState<string | null>(null);
  const [animState, setAnimState] = useState<'front' | 'flipping-to-back' | 'back' | 'flipping-to-front'>('front');
  const [isOwn, setIsOwn] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FLIP_MS = 380;

  // Listen for profile-open events. We call preventDefault so the App-level
  // fallback listener does NOT also open the full-page ProfileViewer overlay.
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.accountId) return;
      markProfileHandled();
      setIsOwn(!!detail.isOwn);
      setProfileAccountId(detail.accountId);
      setAnimState(prev => {
        // If already on the back (viewing a profile), stay on back — just swap content.
        if (prev === 'back' || prev === 'flipping-to-back') return 'back';
        return 'flipping-to-back';
      });
    };
    window.addEventListener('spotvault-open-profile', listener, true);
    return () => window.removeEventListener('spotvault-open-profile', listener, true);
  }, []);

  // Drive the animation state machine
  useEffect(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (animState === 'flipping-to-back') {
      animTimerRef.current = setTimeout(() => setAnimState('back'), FLIP_MS);
    } else if (animState === 'flipping-to-front') {
      animTimerRef.current = setTimeout(() => {
        setAnimState('front');
        setProfileAccountId(null);
      }, FLIP_MS);
    }
    return () => { if (animTimerRef.current) clearTimeout(animTimerRef.current); };
  }, [animState]);

  const handleBackToFeed = useCallback(() => {
    setAnimState('flipping-to-front');
    onBack();
  }, [onBack]);

  // --- Mobile / reduced motion: slide transition ---
  if (isMobile || prefersReducedMotion) {
    const showProfile = profileAccountId !== null && animState !== 'front';
    const slideDir = showProfile ? 'translate-x-0' : 'translate-x-full';
    const feedSlide = showProfile ? '-translate-x-full' : 'translate-x-0';
    return (
      <div className="relative h-full w-full overflow-hidden">
        {/* Feed — slides left, stays mounted */}
        <div
          className="absolute inset-0 transition-transform duration-300 ease-out"
          style={{ transform: showProfile ? 'translateX(-100%)' : 'translateX(0)' }}
        >
          {children}
        </div>
        {/* Profile — slides in from right */}
        {profileAccountId && (
          <div
            className="absolute inset-0 transition-transform duration-300 ease-out"
            style={{ transform: showProfile ? 'translateX(0)' : 'translateX(100%)' }}
          >
            <div className="flex h-full flex-col overflow-hidden">
              <button
                onClick={handleBackToFeed}
                className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors"
                style={{ color: GOLD_SOFT }}
              >
                <ArrowLeft className="h-4 w-4" />
                Feed
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ProfilePage
                  key={profileAccountId}
                  accountId={profileAccountId}
                  isOwn={isOwn}
                  embedded
                  onBack={handleBackToFeed}
                  onMessage={onMessage}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Desktop: 3D card flip ---
  const isFront = animState === 'front' || animState === 'flipping-to-front';
  const frontRotate = isFront ? 0 : -180;
  const backRotate = isFront ? 180 : 0;
  const showBackContent = animState === 'back' || animState === 'flipping-to-back';

  return (
    <div className="relative h-full w-full" style={{ perspective: '1800px' }}>
      {/* Front (feed) — rotates out */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${frontRotate}deg)`,
          transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          backfaceVisibility: 'hidden',
          pointerEvents: isFront ? 'auto' : 'none',
        }}
      >
        {children}
      </div>

      {/* Back (profile) — rotates in */}
      {profileAccountId && (
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${backRotate}deg)`,
            transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            backfaceVisibility: 'hidden',
          }}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(212,165,44,0.22)', background: 'rgba(8,7,6,0.92)' }}>
            <button
              onClick={handleBackToFeed}
              className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-4 py-3 text-[11px] font-bold tracking-widest uppercase transition-colors hover:bg-white/[0.03]"
              style={{ color: GOLD_SOFT }}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Back to Feed
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {showBackContent && (
                <ProfilePage
                  key={profileAccountId}
                  accountId={profileAccountId}
                  isOwn={isOwn}
                  embedded
                  onBack={handleBackToFeed}
                  onMessage={onMessage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
