/**
 * DEMO / PREVIEW DATA — SpotVault V2 Community Identity System
 *
 * This file contains clearly-marked demo profile data for visual testing of the
 * premium identity / hover card system. None of this data is written to the database
 * or to permanent user records. It is isolated here so it can be deleted in one place
 * when real profile data is wired up.
 */

export interface DemoCommunityProfile {
  /** Stable user id — must match the id used in feed/chat/messages */
  userId: string;
  displayName: string;
  /** Primary role label shown in the card and flag */
  role: string;
  /** Secondary role, if any (eg. "STREAMER / PRO") */
  roleSecondary?: string;
  /** One-line headline accolade / result */
  headline: string;
  /** Featured result label (e.g. "Biggest Score") */
  featuredResultLabel: string;
  /** Featured result value (e.g. "$250K+") */
  featuredResultValue: string;
  /** Always prefixed with [DEMO] in the UI to avoid implying verification */
  featuredResultIsDemo: true;
  /** SpotVault platform level (NOT a poker rating) */
  spotVaultLevel: number;
  /** Specialty / focus area */
  specialty: string;
  /** Short bio */
  bio?: string;
  /** Location */
  location?: string;
  /** Member since date string */
  memberSince?: string;
  /** Online status */
  onlineStatus: 'online' | 'offline';
  /** Whether this user has booking enabled */
  bookingEnabled: boolean;
  /** Whether the user is a SpotVault member (shows checkmark) */
  isSpotVaultMember: boolean;
}

/**
 * DEMO profile data — emptied so an empty database produces proper empty states.
 */
export const DEMO_COMMUNITY_PROFILES: DemoCommunityProfile[] = [];

/** Lookup a demo profile by user id. Returns null if no demo data exists. */
export function getDemoProfile(_userId: string): DemoCommunityProfile | null {
  return null;
}

/** Check if a user id has demo profile data available. */
export function hasDemoProfile(_userId: string): boolean {
  return false;
}

/**
 * Map various id schemes to demo profile ids.
 * Returns null when no demo data is available.
 */
export function resolveDemoProfile(_rawId: string): DemoCommunityProfile | null {
  return null;
}
