// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Regression tests for recurring breakages in Content Lab, coach profiles,
// and My Spots. These are source-level contract tests that verify invariants
// without mounting complex components with many dependencies.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8');
}

describe('ContentLabView: ImagePlus import regression', () => {
  it('ImagePlus is imported from lucide-react (regression: was undefined at line 1210)', () => {
    const source = readSrc('ContentLabView.tsx');
    // Find all lucide-react import blocks and verify at least one includes ImagePlus
    const importBlocks = source.match(/import\s*\{[^}]*?\}\s*from\s*['"]lucide-react['"]/gs) || [];
    const hasImagePlusImport = importBlocks.some((block) => /ImagePlus/.test(block));
    expect(hasImagePlusImport).toBe(true);
  });

  it('ImagePlus is actually used in the component (Visuals & Evidence accordion)', () => {
    const source = readSrc('ContentLabView.tsx');
    expect(source).toMatch(/icon=\{ImagePlus\}/);
  });
});

describe('ContentLabView: PlayCircle import regression', () => {
  it('PlayCircle is imported from lucide-react (regression: was undefined at line 1225)', () => {
    const source = readSrc('ContentLabView.tsx');
    const importBlocks = source.match(/import\s*\{[^}]*?\}\s*from\s*['"]lucide-react['"]/gs) || [];
    const hasPlayCircleImport = importBlocks.some((block) => /PlayCircle/.test(block));
    expect(hasPlayCircleImport).toBe(true);
  });

  it('PlayCircle is actually used in the component (Hand History accordion + preview)', () => {
    const source = readSrc('ContentLabView.tsx');
    expect(source).toMatch(/icon=\{PlayCircle\}/);
  });
});

describe('ContentLabView: complete icon import audit', () => {
  it('every icon used as icon={X} is imported from lucide-react', () => {
    const source = readSrc('ContentLabView.tsx');
    // Extract all icon={X} references
    const iconRefs = [...source.matchAll(/icon=\{(\w+)\}/g)].map((m) => m[1]);
    expect(iconRefs.length).toBeGreaterThan(0);
    // Extract all imported names from lucide-react
    const importBlocks = source.match(/import\s*\{[^}]*?\}\s*from\s*['"]lucide-react['"]/gs) || [];
    const allImports = importBlocks.join('\n');
    // Check each icon={X} reference is imported (either directly or as an alias)
    const missing = iconRefs.filter((name) => {
      // Check if name appears in imports (directly or as `Something as name`)
      const re = new RegExp(`\\b${name}\\b`);
      return !re.test(allImports);
    });
    expect(missing).toEqual([]);
  });
});

describe('PeopleDirectory: React hooks ordering regression', () => {
  // The bug: useMemo (filtered) and useState (showFilters) were placed AFTER
  // conditional early returns for selectedListingId/selectedCoachId. When a
  // coach profile was opened, those hooks were skipped, causing
  // "Rendered fewer hooks than expected" crash.
  it('all hooks (useState, useMemo, useCallback, useEffect) are declared before any early return', () => {
    const source = readSrc('../people/PeopleDirectory.tsx');
    const lines = source.split('\n');

    // Find the first early return (if (selectedListingId) { return ...)
    let firstEarlyReturnLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/if\s*\(selectedListingId\)/.test(lines[i])) {
        firstEarlyReturnLine = i;
        break;
      }
    }
    expect(firstEarlyReturnLine).toBeGreaterThan(-1);

    // Check that no useState/useMemo/useCallback/useEffect calls appear AFTER
    // the first early return and before the final return statement of the
    // PeopleDirectory function body.
    const hooksAfterReturn: string[] = [];
    let braceDepth = 0;
    let inFunction = false;
    let foundEarlyReturn = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track when we enter the PeopleDirectory function
      if (/export function PeopleDirectory/.test(line)) {
        inFunction = true;
        braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        continue;
      }
      if (!inFunction) continue;
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      if (/if\s*\(selectedListingId\)/.test(line)) {
        foundEarlyReturn = true;
      }

      if (foundEarlyReturn && braceDepth > 0) {
        // Check for hook calls after the early return
        if (/^\s*(const\s+\w+\s*=\s*)(useState|useMemo|useCallback|useEffect)\s*\(/.test(line)) {
          hooksAfterReturn.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(hooksAfterReturn).toEqual([]);
  });
});

describe('MyLibraryView: flicker prevention regression', () => {
  // The bug: loadSpots always set loadingSpots=true at the start, even when
  // data already existed. This caused the list to disappear briefly during
  // background refreshes. Fix: only set loadingSpots=true when mySpots is empty.
  it('loadSpots does not set loadingSpots=true when mySpots already has data', () => {
    const source = readSrc('MyLibraryView.tsx');

    // Extract the loadSpots function
    const loadSpotsMatch = source.match(
      /const\s+loadSpots\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*\[[^\]]*\]\)/
    );
    expect(loadSpotsMatch).not.toBeNull();
    const loadSpotsBlock = loadSpotsMatch![0];

    // Must conditionally set loadingSpots only when mySpots.length === 0
    expect(loadSpotsBlock).toMatch(/mySpots\.length\s*===\s*0/);
    // Must NOT unconditionally set loadingSpots(true)
    expect(loadSpotsBlock).not.toMatch(/^\s*setLoadingSpots\(true\);$/m);
  });
});

describe('CoachProfileView: hooks before early returns', () => {
  // Ensure all hooks in CoachProfileView are called before any conditional
  // return to prevent "Rendered fewer hooks than expected" when navigating
  // to a coach profile.
  it('all hooks are declared before the first early return (editing/loading/error)', () => {
    const source = readSrc('../coach/CoachProfileView.tsx');

    // Find the first conditional return (if (editing && isOwner) return ...)
    const lines = source.split('\n');
    let firstEarlyReturn = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*if\s*\(editing\s*&&\s*isOwner\)/.test(lines[i])) {
        firstEarlyReturn = i;
        break;
      }
    }
    expect(firstEarlyReturn).toBeGreaterThan(-1);

    // Check that no hook calls appear after the first early return
    // within the CoachProfileView function body
    let inFunction = false;
    let foundEarlyReturn = false;
    const hooksAfterReturn: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/export function CoachProfileView/.test(line)) {
        inFunction = true;
        continue;
      }
      if (!inFunction) continue;

      // Stop at the next top-level function definition (SectionHeader or DetailRow)
      if (/^function\s+(SectionHeader|DetailRow)/.test(line)) break;

      if (/^\s*if\s*\(editing\s*&&\s*isOwner\)/.test(line)) {
        foundEarlyReturn = true;
      }

      if (foundEarlyReturn) {
        if (/^\s*(const\s+\w+\s*=\s*)(useState|useMemo|useCallback|useEffect|useRef)\s*\(/.test(line)) {
          hooksAfterReturn.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(hooksAfterReturn).toEqual([]);
  });
});
