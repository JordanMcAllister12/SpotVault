import { useCallback, useState } from 'react';
import type { HubId } from '@/types';

export type AuthState = 'CHECKING' | 'LOGGED_OUT' | 'LOGGED_IN';
export type NavDestination = 'ACCESS' | 'PLAYER_HUB' | 'COMMUNITY' | 'MESSAGING' | 'PLAYER_UPSTAIRS' | 'INVESTOR_UPSTAIRS' | 'BUSINESS_SECOND_FLOOR' | 'MEDIA_SECOND_FLOOR' | 'CREATOR_SECOND_FLOOR' | 'STABLE_SECOND_FLOOR' | 'AFFILIATE_PARTNER_SECOND_FLOOR' | 'COACH_SECOND_FLOOR' | 'STAFF_SECOND_FLOOR';
export type NavDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
export type NavPortal = HubId;

export type CanonicalScreen =
  | 'LOGIN'
  | 'PLAYER_ROOM'
  | 'PLAYER_COMMUNITY'
  | 'PLAYER_CHAT'
  | 'PLAYER_MESSAGING'
  | 'INVESTOR_COMMUNITY'
  | 'INVESTOR_CHAT'
  | 'INVESTOR_ROOM'
  | 'MEDIA_ROOM'
  | 'MEDIA_SECOND_FLOOR'
  | 'BUSINESS_ROOM'
  | 'BUSINESS_SECOND_FLOOR'
  | 'CREATOR_ROOM'
  | 'CREATOR_SECOND_FLOOR'
  | 'STABLE_ROOM'
  | 'STABLE_SECOND_FLOOR'
  | 'AFFILIATE_PARTNER_ROOM'
  | 'AFFILIATE_PARTNER_SECOND_FLOOR'
  | 'STAFF_ROOM'
  | 'STAFF_SECOND_FLOOR'
  | 'COACH_ROOM'
  | 'COACH_SECOND_FLOOR'
  | 'STAKEKINGS_PLAYER_ROOM'
  | 'UNKNOWN';

export interface NavState {
  authState: AuthState;
  currentPortal: NavPortal;
  currentDestination: NavDestination;
  lastNavigation: string;
  lastTrigger: string;
}

export const INITIAL_NAV_STATE: NavState = {
  authState: 'CHECKING',
  currentPortal: 'PLAYER',
  currentDestination: 'ACCESS',
  lastNavigation: 'INIT',
  lastTrigger: 'MOUNT',
};

export function getCurrentScreen(nav: NavState): CanonicalScreen {
  if (nav.authState === 'CHECKING') return 'UNKNOWN';
  if (nav.authState === 'LOGGED_OUT' || nav.currentDestination === 'ACCESS') return 'LOGIN';

  if (nav.authState === 'LOGGED_IN') {
    if (nav.currentPortal === 'PLAYER') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'PLAYER_ROOM';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
      if (nav.currentDestination === 'PLAYER_UPSTAIRS') return 'PLAYER_CHAT';
      if (nav.currentDestination === 'MESSAGING') return 'PLAYER_MESSAGING';
    }
    if (nav.currentPortal === 'INVESTOR') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'INVESTOR_ROOM';
      if (nav.currentDestination === 'COMMUNITY') return 'INVESTOR_COMMUNITY';
      if (nav.currentDestination === 'INVESTOR_UPSTAIRS') return 'INVESTOR_CHAT';
    }
    if (nav.currentPortal === 'MEDIA') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'MEDIA_ROOM';
      if (nav.currentDestination === 'MEDIA_SECOND_FLOOR') return 'MEDIA_SECOND_FLOOR';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
    }
    if (nav.currentPortal === 'BUSINESS') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'BUSINESS_ROOM';
      if (nav.currentDestination === 'BUSINESS_SECOND_FLOOR') return 'BUSINESS_SECOND_FLOOR';
    }
    if (nav.currentPortal === 'CREATOR') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'CREATOR_ROOM';
      if (nav.currentDestination === 'CREATOR_SECOND_FLOOR') return 'CREATOR_SECOND_FLOOR';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
    }
    if (nav.currentPortal === 'STABLE') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'STABLE_ROOM';
      if (nav.currentDestination === 'STABLE_SECOND_FLOOR') return 'STABLE_SECOND_FLOOR';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
    }
    if (nav.currentPortal === 'AFFILIATE_PARTNER') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'AFFILIATE_PARTNER_ROOM';
      if (nav.currentDestination === 'AFFILIATE_PARTNER_SECOND_FLOOR') return 'AFFILIATE_PARTNER_SECOND_FLOOR';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
    }
    if (nav.currentPortal === 'STAFF') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'STAFF_ROOM';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
      if (nav.currentDestination === 'STAFF_SECOND_FLOOR') return 'STAFF_SECOND_FLOOR';
    }
    if (nav.currentPortal === 'COACH') {
      if (nav.currentDestination === 'PLAYER_HUB') return 'COACH_ROOM';
      if (nav.currentDestination === 'COMMUNITY') return 'PLAYER_COMMUNITY';
      if (nav.currentDestination === 'COACH_SECOND_FLOOR') return 'COACH_SECOND_FLOOR';
    }
    if (nav.currentPortal === 'STAKEKINGS_PLAYER' && nav.currentDestination === 'PLAYER_HUB') return 'STAKEKINGS_PLAYER_ROOM';
  }

  return 'UNKNOWN';
}

/**
 * Returns the set of valid navigation directions for the current nav state.
 * Used by the mobile swipe layer to know which gestures are available.
 */
export function getValidDirections(nav: NavState): Set<NavDirection> {
  const valid = new Set<NavDirection>();
  if (nav.authState !== 'LOGGED_IN') return valid;

  const table: Partial<Record<NavDestination, Partial<Record<NavDirection, NavDestination>>>> = {
    ACCESS: { RIGHT: 'PLAYER_HUB' },
    PLAYER_HUB: { RIGHT: 'COMMUNITY', UP: 'PLAYER_UPSTAIRS' },
    COMMUNITY: { LEFT: 'PLAYER_HUB' },
    MESSAGING: { LEFT: 'PLAYER_HUB', DOWN: 'PLAYER_HUB' },
    PLAYER_UPSTAIRS: { DOWN: 'PLAYER_HUB' },
    INVESTOR_UPSTAIRS: { DOWN: 'PLAYER_HUB' },
    BUSINESS_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
    MEDIA_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
    CREATOR_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
    STABLE_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
    AFFILIATE_PARTNER_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
  };

  if (nav.currentPortal === 'INVESTOR') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'INVESTOR_UPSTAIRS' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'BUSINESS') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'BUSINESS_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'MEDIA') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'MEDIA_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'CREATOR') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'CREATOR_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'STABLE') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'STABLE_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'AFFILIATE_PARTNER') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'AFFILIATE_PARTNER_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'COACH') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'COACH_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
    table.COACH_SECOND_FLOOR = { DOWN: 'PLAYER_HUB' };
  }
  if (nav.currentPortal === 'STAFF') {
    table.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'STAFF_SECOND_FLOOR' };
    table.COMMUNITY = { LEFT: 'PLAYER_HUB' };
    table.STAFF_SECOND_FLOOR = { DOWN: 'PLAYER_HUB' };
  }

  const dirs = table[nav.currentDestination];
  if (dirs) {
    (['LEFT', 'RIGHT', 'UP', 'DOWN'] as NavDirection[]).forEach((d) => {
      if (dirs[d]) valid.add(d);
    });
  }
  return valid;
}

export function useNavState() {
  const [nav, setNav] = useState<NavState>(INITIAL_NAV_STATE);

  const login = useCallback((portal: NavPortal = 'PLAYER') => {
    setNav({
      authState: 'LOGGED_IN',
      currentPortal: portal,
      currentDestination: 'PLAYER_HUB',
      lastNavigation: 'ACCESS → PLAYER_HUB',
      lastTrigger: 'LOGIN',
    });
  }, []);

  const logout = useCallback(() => {
    setNav({
      authState: 'LOGGED_OUT',
      currentPortal: 'PLAYER',
      currentDestination: 'ACCESS',
      lastNavigation: 'PLAYER_HUB → ACCESS',
      lastTrigger: 'LOGOUT',
    });
  }, []);

  const navigateVertical = useCallback((direction: NavDirection, trigger = 'TAB') => {
    setNav((prev) => {
      if (prev.authState === 'LOGGED_OUT') return prev;

      if (prev.currentDestination === 'PLAYER_HUB' && direction === 'LEFT') {
        return {
          authState: 'LOGGED_OUT',
          currentPortal: 'PLAYER',
          currentDestination: 'ACCESS',
          lastNavigation: 'PLAYER_HUB → ACCESS',
          lastTrigger: trigger,
        };
      }

      const nextDestination: Partial<Record<NavDestination, Partial<Record<NavDirection, NavDestination>>>> = {
        ACCESS: { RIGHT: 'PLAYER_HUB' },
        PLAYER_HUB: { RIGHT: 'COMMUNITY', UP: 'PLAYER_UPSTAIRS' },
        COMMUNITY: { LEFT: 'PLAYER_HUB' },
        PLAYER_UPSTAIRS: { DOWN: 'PLAYER_HUB' },
        INVESTOR_UPSTAIRS: { DOWN: 'PLAYER_HUB' },
        BUSINESS_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
        MEDIA_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
        CREATOR_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
        STABLE_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
        AFFILIATE_PARTNER_SECOND_FLOOR: { DOWN: 'PLAYER_HUB' },
      };
      if (prev.currentPortal === 'INVESTOR') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'INVESTOR_UPSTAIRS' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'BUSINESS') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'BUSINESS_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'MEDIA') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'MEDIA_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'CREATOR') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'CREATOR_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'STABLE') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'STABLE_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'AFFILIATE_PARTNER') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'AFFILIATE_PARTNER_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'COACH') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'COACH_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
        nextDestination.COACH_SECOND_FLOOR = { DOWN: 'PLAYER_HUB' };
      }
      if (prev.currentPortal === 'STAFF') {
        nextDestination.PLAYER_HUB = { RIGHT: 'COMMUNITY', UP: 'STAFF_SECOND_FLOOR' };
        nextDestination.COMMUNITY = { LEFT: 'PLAYER_HUB' };
        nextDestination.STAFF_SECOND_FLOOR = { DOWN: 'PLAYER_HUB' };
      }
      const next = nextDestination[prev.currentDestination]?.[direction];
      if (!next) return prev;

      return {
        ...prev,
        currentDestination: next,
        lastNavigation: `${prev.currentDestination} → ${next}`,
        lastTrigger: trigger,
      };
    });
  }, []);

  const setPortal = useCallback((portal: NavPortal, destination: NavDestination = 'PLAYER_HUB') => {
    setNav((prev) => ({
      ...prev,
      currentPortal: portal,
      currentDestination: destination,
      lastNavigation: `PORTAL → ${portal} → ${destination}`,
      lastTrigger: 'PORTAL_SWITCH',
    }));
  }, []);

  const hardReset = useCallback(() => {
    setNav(INITIAL_NAV_STATE);
  }, []);

  const openMessaging = useCallback((trigger = 'MESSAGING') => {
    setNav((prev) => ({
      ...prev,
      currentDestination: 'MESSAGING',
      lastNavigation: `${prev.currentDestination} → MESSAGING`,
      lastTrigger: trigger,
    }));
  }, []);

  const closeMessaging = useCallback(() => {
    setNav((prev) => ({
      ...prev,
      currentDestination: 'PLAYER_HUB',
      lastNavigation: 'MESSAGING → PLAYER_HUB',
      lastTrigger: 'CLOSE_MESSAGING',
    }));
  }, []);

  return { nav, login, logout, navigateVertical, setPortal, hardReset, openMessaging, closeMessaging };
}
