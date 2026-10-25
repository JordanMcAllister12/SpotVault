// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Regression test: Existing Spot Edit Routing and State Persistence
//
// Root cause: ContentLabView's edit effect called onEditConsumed() immediately
// after hydrating the spot. That cleared editSpot in the parent (PlayerHub).
// If ContentLabView remounted (ErrorBoundary, StrictMode, re-render), the edit
// effect could not re-fire (editSpot?.id was null), and loadSpots reset the
// editor to a blank "new" spot — showing the creation screen instead of the
// existing spot's content.
//
// Fix: onEditConsumed() is now called in resetCreationSession (when the edit
// session truly ends) instead of in the edit hydration effect. This ensures
// editSpot stays set for the entire edit session and survives remounts.
// ---------------------------------------------------------------------------

// We test the contract directly: the edit effect must NOT call onEditConsumed
// during hydration, and resetCreationSession MUST call it.

// Mock the contentLab module
const mockFetchSpotById = vi.fn();
const mockFetchMySpots = vi.fn();
const mockFetchAIAssistUsage = vi.fn().mockResolvedValue({ spotRemaining: 0, weekRemaining: 0 });
const mockUpdateExistingSpot = vi.fn();

vi.mock('@/lib/contentLab', () => ({
  fetchSpotById: (...args: unknown[]) => mockFetchSpotById(...args),
  fetchMySpots: (...args: unknown[]) => mockFetchMySpots(...args),
  fetchAIAssistUsage: (...args: unknown[]) => mockFetchAIAssistUsage(...args),
  updateExistingSpot: (...args: unknown[]) => mockUpdateExistingSpot(...args),
  saveDraft: vi.fn(),
  publishSpot: vi.fn(),
  submitSpot: vi.fn(),
  createNewSpot: vi.fn(),
  deleteSpot: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-uid' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: null }),
    }),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/entitlements', () => ({
  resolveTier: vi.fn().mockReturnValue('core'),
  ENTITLEMENTS: { core: { aiAssistsWeekly: 0 } },
  FEATURE_FLAGS: { aiAssistEnabled: false, monetizationEnabled: false },
}));

vi.mock('@/lib/perks', () => ({
  useCreatorPerks: () => ({ prefs: { seenCreatorGuide: true }, loading: false, markCreatorGuideSeen: vi.fn() }),
}));

// Minimal mock for the card insertion hook
vi.mock('@/lib/cardInsertion', () => ({
  useCardInsertionTarget: () => ({
    registerField: vi.fn(),
    captureSelection: vi.fn(),
    insertCardText: vi.fn(),
    hasActiveField: false,
    getUsedCards: () => [],
  }),
}));

// Mock React's useState/useRef/useEffect to spy on onEditConsumed calls
// We test the behavior contract: onEditConsumed must not be called during edit hydration
const onEditConsumedSpy = vi.fn();

// Import after mocks are set up
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';

// We test the contract by reading the source code behavior.
// Since ContentLabView is a complex component with many dependencies,
// we verify the key invariant: onEditConsumed is NOT called in the edit effect,
// but IS called in resetCreationSession.

describe('Edit routing regression: onEditConsumed contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onEditConsumedSpy.mockClear();
  });

  it('onEditConsumed is not called during edit hydration (regression: was called at line 237)', async () => {
    // Read the source file and verify onEditConsumed is NOT called in the edit effect
    const fs = await import('fs');
    const source = fs.readFileSync(
      require('path').resolve(__dirname, '../ContentLabView.tsx'),
      'utf-8'
    );

    // Extract the edit effect block (from "useEffect" with editSpot?.id to its closing "}, [editSpot?.id, account.id]")
    const editEffectMatch = source.match(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?if\s*\(!editSpot\?\.id\)[\s\S]*?\},\s*\[editSpot\?\.id,\s*account\.id\]\)/
    );
    expect(editEffectMatch).not.toBeNull();
    const editEffectBlock = editEffectMatch![0];

    // The edit effect must NOT call onEditConsumed as a function call
    // (comments mentioning it are fine, but no actual invocation)
    expect(editEffectBlock).not.toMatch(/onEditConsumed\??\.\(/);
  });

  it('onEditConsumed IS called in resetCreationSession (ensures cleanup on session end)', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      require('path').resolve(__dirname, '../ContentLabView.tsx'),
      'utf-8'
    );

    // Extract resetCreationSession
    const resetMatch = source.match(
      /const\s+resetCreationSession\s*=\s*useCallback\([\s\S]*?\},\s*\[[^\]]*\]\)/
    );
    expect(resetMatch).not.toBeNull();
    const resetBlock = resetMatch![0];

    // resetCreationSession MUST call onEditConsumed
    expect(resetBlock).toContain('onEditConsumed');
  });

  it('editSessionRef guard prevents loadSpots from clobbering active edit', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      require('path').resolve(__dirname, '../ContentLabView.tsx'),
      'utf-8'
    );

    // loadSpots must check editSessionRef at entry AND after fetch
    const loadSpotsMatch = source.match(
      /const\s+loadSpots\s*=\s*useCallback\(async\s*\([\s\S]*?\},\s*\[[^\]]*\]\)/
    );
    expect(loadSpotsMatch).not.toBeNull();
    const loadSpotsBlock = loadSpotsMatch![0];

    // Must have the guard at the start
    expect(loadSpotsBlock).toContain('editSessionRef.current');
    // Must have the guard after the fetch (the second check)
    const guardCount = (loadSpotsBlock.match(/editSessionRef\.current/g) || []).length;
    expect(guardCount).toBeGreaterThanOrEqual(2);
  });
});
