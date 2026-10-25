/*
# Canonical Batch System — Phase 2

## Purpose
Upgrade the existing sv_review_sets / sv_review_hands tables into a canonical
batch system that supports: personal study, coaching submissions, creator products,
multi-spot analysis, and HH bundles. Add candidate/selected workflow, per-hand
batch notes, and a seller-permissions table for granular marketplace approval.

## Changes

### 1. sv_review_sets — add batch_type column
- New column `batch_type` (text, NOT NULL, default 'personal')
  Values: personal | coaching_submission | coaching_material | creator_product | hh_bundle
- This lets one batch table serve all workflows without separate tables.

### 2. sv_review_hands — add selection_status, added_by, batch_note
- New column `selection_status` (text, NOT NULL, default 'candidate')
  Values: candidate | selected
  Candidates = collected for possible inclusion; Selected = intentionally chosen for output.
- New column `added_by` (uuid, references auth.users, default auth.uid())
  Tracks who added the hand to the batch (may differ from batch owner in coaching flows).
- New column `batch_note` (text, nullable)
  Per-batch hand note (distinct from the global sv_review_hand_notes which are per-author).

### 3. sv_review_hands — add DELETE policy
- The existing RLS had no DELETE policy, meaning removeHandFromBatch() would fail.
- Added sv_review_hands_delete_own policy.

### 4. sv_seller_permissions — new table
- Granular seller approval for marketplace publishing.
- Columns: user_id, spots, video, multi_spot_analysis, hh_bundles, approved_at, approved_by
- RLS: users can read their own permissions; staff/admin can read all; only service role can insert/update (enforced via RPC).

### 5. sv_batch_events — new table
- Notification events for batch lifecycle (submitted, returned, etc.)
- Columns: id, batch_id, event_type, actor_id, recipient_id, payload, created_at, read_at
- RLS: actor and recipient can read; only authenticated can insert for themselves.

### 6. Indexes
- Index on sv_review_hands(review_set_id, selection_status) for candidate/selected filtering
- Index on sv_seller_permissions(user_id) for permission lookups
- Index on sv_batch_events(recipient_id, read_at) for inbox queries

## Security
- All new tables have RLS enabled.
- sv_seller_permissions: only owner can SELECT; INSERT/UPDATE via SECURITY DEFINER RPC only (not direct table access).
- sv_batch_events: actor and recipient can SELECT; INSERT via RPC or direct with auth.uid() check.
- sv_review_hands DELETE policy added (was missing — bug fix).
*/