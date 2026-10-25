import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { resolveDemoProfile, type DemoCommunityProfile } from '@/data/demoCommunityProfiles';
import { UserIdentityCard } from '@/components/community/UserIdentityCard';
import { dispatchOpenProfile, dispatchMessageUser } from '@/lib/profileEvents';
import { supabase } from '@/lib/supabase';

export interface UserIdentityHoverCardProps {
  userId: string;
  /** Fallback display name shown if no demo profile exists */
  fallbackName?: string;
  /** Fallback role shown if no demo profile exists */
  fallbackRole?: string;
  /** The trigger element (name, avatar, etc.) */
  children: ReactNode;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onBook?: (userId: string) => void;
}

/**
 * Wrapper that adds hover/tap profile card behavior to any trigger element.
 *
 * Desktop: hover with ~200ms delay, card stays open when cursor moves into it,
 * closes when cursor leaves both trigger and card. No flicker.
 *
 * Mobile: tap opens compact profile card as a fixed overlay (bottom-sheet style).
 * Close by X, tapping outside, or the backdrop.
 *
 * If no demo profile data exists for the userId, the card shows a minimal fallback.
 */
export function UserIdentityHoverCard({
  userId,
  fallbackName,
  fallbackRole,
  children,
  onViewProfile,
  onMessage,
  onBook,
}: UserIdentityHoverCardProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active && user) setCurrentUserId(user.id);
    })();
    return () => { active = false; };
  }, []);

  const profile = resolveDemoProfile(userId);
  const isSelf = currentUserId === userId;

  const openCard = useCallback((rect: DOMRect) => {
    setAnchorRect(rect);
    setOpen(true);
  }, []);

  const closeCard = useCallback(() => {
    setOpen(false);
  }, []);

  // Desktop hover handlers
  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      if (triggerRef.current) {
        openCard(triggerRef.current.getBoundingClientRect());
      }
    }, 200);
  }, [isMobile, openCard]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      closeCard();
    }, 150);
  }, [isMobile, closeCard]);

  // When cursor enters the card area, cancel any pending close
  const handleCardMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, [isMobile]);

  // When cursor leaves the card area, close
  const handleCardMouseLeave = useCallback(() => {
    if (isMobile) return;
    hoverTimer.current = setTimeout(() => {
      closeCard();
    }, 150);
  }, [isMobile, closeCard]);

  // Mobile tap handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isMobile) {
      e.stopPropagation();
      e.preventDefault();
      if (triggerRef.current) {
        openCard(triggerRef.current.getBoundingClientRect());
      }
    }
  }, [isMobile, openCard]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  // Build a fallback profile if no demo data exists
  const effectiveProfile: DemoCommunityProfile | null = profile ?? (fallbackName ? {
    userId,
    displayName: fallbackName,
    role: fallbackRole ?? 'MEMBER',
    headline: '',
    featuredResultLabel: '',
    featuredResultValue: '',
    featuredResultIsDemo: true,
    spotVaultLevel: 0,
    specialty: '',
    onlineStatus: 'offline' as const,
    bookingEnabled: false,
    isSpotVaultMember: false,
  } : null);

  return (
    <>
      <span
        ref={triggerRef as React.RefObject<HTMLSpanElement>}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
      >
        {children}
      </span>

      {open && effectiveProfile && (
        <div onMouseEnter={handleCardMouseEnter} onMouseLeave={handleCardMouseLeave}>
          <UserIdentityCard
            profile={effectiveProfile}
            onClose={closeCard}
            onViewProfile={(uid) => dispatchOpenProfile(uid, false)}
            onMessage={isSelf ? undefined : (uid) => dispatchMessageUser(uid)}
            onBook={onBook}
            anchorRect={anchorRect}
          />
        </div>
      )}
    </>
  );
}
