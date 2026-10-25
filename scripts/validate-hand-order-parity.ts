/**
 * Standalone validation script: verifies that the frontend and edge function
 * copies of the canonical 1326 hand-order mapping are entry-for-entry identical.
 *
 * Run: npx tsx scripts/validate-hand-order-parity.ts
 * Or:  npm run build (this runs as part of the build via the prebuild step)
 *
 * Exits with code 1 and a clear message if the copies diverge or are invalid.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ===== Load frontend copy (raw text file) =====
const frontendPath = resolve(projectRoot, 'src/lib/solver/solver_hand_order.txt');
const frontendRaw = readFileSync(frontendPath, 'utf-8');
const frontendCombos = frontendRaw
  .trim()
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

// ===== Load edge function copy (embedded array in handOrder.ts) =====
const edgePath = resolve(projectRoot, 'supabase/functions/deepsolver-solve/handOrder.ts');
const edgeSource = readFileSync(edgePath, 'utf-8');
const edgeMatch = edgeSource.match(/export const CANONICAL_COMBOS[^=]*=\s*\[([\s\S]*?)\];/s);
if (!edgeMatch) {
  console.error('FAIL: Could not extract CANONICAL_COMBOS array from edge function handOrder.ts');
  process.exit(1);
}
const edgeCombos = edgeMatch[1]
  .split(',')
  .map((s) => s.trim().replace(/["']/g, ''))
  .filter((s) => s.length > 0);

// ===== Validation =====
let errors = 0;

function fail(msg: string) {
  console.error(`FAIL: ${msg}`);
  errors++;
}

// 1. Both must have exactly 1326 entries
if (frontendCombos.length !== 1326) {
  fail(`Frontend copy has ${frontendCombos.length} entries, expected 1326`);
}
if (edgeCombos.length !== 1326) {
  fail(`Edge function copy has ${edgeCombos.length} entries, expected 1326`);
}

// 2. Both must have no duplicates
function checkDuplicates(label: string, combos: string[]) {
  const seen = new Set<string>();
  for (let i = 0; i < combos.length; i++) {
    if (seen.has(combos[i])) {
      fail(`${label} has duplicate combo "${combos[i]}" at index ${i}`);
    }
    seen.add(combos[i]);
  }
}
checkDuplicates('Frontend', frontendCombos);
checkDuplicates('Edge function', edgeCombos);

// 3. Every entry must be a valid two-card Hold'em combination
const validRanks = new Set(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const validSuits = new Set(['h', 'd', 'c', 's']);
function checkValidity(label: string, combos: string[]) {
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    if (c.length !== 4) {
      fail(`${label} entry ${i} has length ${c.length}, expected 4: "${c}"`);
      continue;
    }
    if (!validRanks.has(c[0]) || !validRanks.has(c[2])) {
      fail(`${label} entry ${i} has invalid rank: "${c}"`);
    }
    if (!validSuits.has(c[1]) || !validSuits.has(c[3])) {
      fail(`${label} entry ${i} has invalid suit: "${c}"`);
    }
    if (c[0] === c[2] && c[1] === c[3]) {
      fail(`${label} entry ${i} is the same card twice: "${c}"`);
    }
  }
}
checkValidity('Frontend', frontendCombos);
checkValidity('Edge function', edgeCombos);

// 4. Frontend and edge function must be entry-for-entry identical
const minLen = Math.min(frontendCombos.length, edgeCombos.length);
for (let i = 0; i < minLen; i++) {
  if (frontendCombos[i] !== edgeCombos[i]) {
    fail(
      `Mismatch at index ${i}:\n` +
      `  Frontend:      "${frontendCombos[i]}"\n` +
      `  Edge function: "${edgeCombos[i]}"`
    );
  }
}

// ===== Result =====
if (errors > 0) {
  console.error(`\nHand-order parity validation FAILED with ${errors} error(s).`);
  console.error('The frontend and edge function canonical hand-order copies have diverged.');
  console.error('Fix by syncing supabase/functions/deepsolver-solve/handOrder.ts with');
  console.error('src/lib/solver/solver_hand_order.txt.');
  process.exit(1);
}

console.log('OK: Canonical hand-order parity validated — 1326 entries match in frontend and edge function.');
