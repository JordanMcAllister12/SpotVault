/*
# Canonical Batch System — Phase 2

## Purpose
Upgrade existing sv_review_sets / sv_review_hands into a canonical batch system
supporting personal study, coaching submissions, creator products, multi-spot
analysis, and HH bundles. Adds candidate/selected workflow, per-hand batch notes,
seller permissions, and batch event notifications.

## Changes
1. sv_review_sets: add batch_type column (personal|coaching_submission|coaching_material|creator_product|hh_bundle)
2. sv_review_hands: add selection_status (candidate|selected), added_by, batch_note columns
3. sv_review_hands: add missing DELETE RLS policy (bug fix)
4. sv_seller_permissions: new table for granular marketplace seller approval
5. sv_batch_events: new table for batch lifecycle notification events
6. Indexes for performance
*/