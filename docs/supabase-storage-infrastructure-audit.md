# SpotVault — Supabase & Storage Infrastructure Audit

**Audit Type:** READ-ONLY (no code or database changes made)
**Date:** October 2026
**Project:** SpotVault (Supabase project: `hfmrepdeyakvfqqyvofv.supabase.co`)
**Video Project:** Separate Supabase project (`huososarkrngtpkpzsws.supabase.co`)

---

## Executive Summary

SpotVault's database is a mature, heavily-schema'd Postgres instance with 270 tables, 361 migrations, 490 functions, 717 indexes, and 867 RLS policies. The application is primarily a no-auth poker training platform — 269 of 270 tables have RLS enabled, and policies are scoped to `anon, authenticated` rather than `authenticated` only. The database is 66 MB total, dominated by 7,027 parsed poker hand records (31 MB).

File storage is underutilized: only 10 files across all 5 buckets (15 MB total). The primary storage concern is the `user-uploads` bucket, which is fully public with no MIME restrictions, no size limits, and anon-open CRUD — a significant security vulnerability. Spot images are stored as base64 data URLs in a `text[]` column rather than in Storage, though current rows have no images populated. Hand histories store raw text inline (up to ~2.3 KB per hand).

The architecture has two Supabase projects: the app database and a separate project hosting the intro video. This split is workable but creates operational complexity.

---

## PART 1 — Current Database Architecture

### 1.1 Scale Overview

| Metric | Value |
|--------|-------|
| Total tables | 270 |
| Total migrations | 361 |
| Total functions | 490 |
| SECURITY DEFINER functions | 278 (57%) |
| SECURITY INVOKER functions | 212 (43%) |
| Total indexes | 717 |
| Total foreign keys | 232 |
| RLS-enabled tables | 269 / 270 (99.6%) |
| Total RLS policies | 867 |
| Database size | 66 MB |
| Installed extensions | 6 (btree_gist, pg_stat_statements, pgcrypto, supabase_vault, uuid-ossp, plpgsql) |

### 1.2 Tables with Data (47 of 270 tables populated)

| Table | Rows | Size | Purpose |
|-------|------|------|---------|
| `poker_hand_records` | 7,027 | 31 MB | Parsed poker hand histories (largest table) |
| `sv_review_hands` | 557 | 1.2 MB | Staff hand review records |
| `page_views` | 352 | 184 KB | Analytics page view tracking |
| `sv_auth_events` | 39 | — | Authentication event log |
| `spotvault_environment_assets` | 26 | — | Environment/lounge asset catalog |
| `sv_roles` | 22 | — | User role assignments (staff/admin/owner) |
| `sv_review_sets` | 21 | — | Hand review set groupings |
| `sv_portal_access` | 17 | — | Portal access grants |
| `user_profiles` | 17 | 120 KB | User profile data |
| `sv_svi_weights` | 10 | — | SPR scoring weight configurations |
| `network_chat_messages` | 8 | 96 KB | Network chat messages |
| `poker_lounge_messages` | 8 | — | Poker lounge messages |
| `sv_staff_tags` | 7 | — | Staff tag assignments |
| `sv_spr_competition_pools` | 7 | — | SPR competition pool definitions |
| `user_preferences` | 6 | 432 KB | User UI preferences (JSONB) |
| `sv_entitlements` | 6 | — | User content entitlements |
| `content_spots` | 6 | 304 KB | Educational content spots |
| `sv_manual_hand_records` | 5 | — | Manually entered hand records |
| `stripe_checkout_sessions` | 5 | — | Stripe checkout session records |
| `sv_spr_weights` | 5 | — | SPR scoring weight presets |
| `membership_overrides` | 4 | — | Membership tier overrides |
| `membership_tiers` | 4 | — | Membership tier definitions |
| `lounge_memberships` | 4 | — | Lounge membership assignments |
| `spot_evidence` | 3 | — | Spot evidence attachments |
| `sv_staff_metadata` | 3 | — | Staff metadata records |
| `app_settings` | 3 | — | Application settings |
| `sv_access_audit_log` | 3 | — | Access audit log entries |
| `custom_portal_memberships` | 3 | — | Custom portal memberships |
| `main_feed_posts` | 3 | 112 KB | Main feed posts |
| `lounge_configs` | 2 | — | Lounge configurations |
| `custom_portals` | 2 | — | Custom portal definitions |
| `user_inbox_conversations` | 2 | — | User inbox conversations |
| `poker_import_batches` | 2 | — | Hand history import batches |
| `poker_analytics_snapshots` | 2 | 576 KB | Analytics snapshot data |
| `sv_relationships` | 2 | — | User relationship records |
| `sv_svi_eligibility` | 2 | — | SVI eligibility records |
| `coach_listings` | 2 | — | Coach directory listings |
| `system_messages` | 2 | 112 KB | System messages |
| `sv_svi_honors` | 1 | — | SVI honor records |
| `password_recovery_credentials` | 1 | — | Password recovery data |
| `stripe_customers` | 1 | — | Stripe customer records |
| `sv_review_hand_notes` | 1 | — | Hand review notes |
| `user_memberships` | 1 | — | User membership assignments |
| `sv_deals` | 1 | — | Deal records |
| `stripe_webhook_events` | 1 | — | Stripe webhook event log |
| `sv_acquisition_codes` | 1 | — | Acquisition code tracking |
| `spot_comments` | 1 | — | Spot comment records |
| `community_entitlements` | 1 | — | Community entitlement grants |
| `sv_saved_tournaments` | 1 | 144 KB | Saved tournament records |

**223 tables (83%) have zero rows** — these are schema-defined but not yet in active use (booking marketplace, business CRM, coaching sessions, coach lab, community fund, etc.).

### 1.3 RLS & Policy Architecture

- **RLS enabled on 269 of 270 tables** (99.6%)
- **1 table without RLS:** `sv_spr_competition_pools` (7 rows) — this is a configuration/lookup table but still represents a gap
- **867 total policies** broken down:
  - SELECT: 295 policies
  - INSERT: 220 policies
  - UPDATE: 185 policies
  - DELETE: 150 policies
- **241 policies use `USING (true)`** (27.8% of all policies) — these are open/permissive, appropriate for a no-auth app where data is shared publicly, but should be reviewed for tables containing sensitive data
- **145 policies use `WITH CHECK (true)`** (16.7%) — open write checks, meaning any user can insert/update with no row-level restriction

The policy model is consistent with a no-auth application: policies are scoped to `TO anon, authenticated` rather than `TO authenticated` only, and many use `true` predicates for shared/public data.

### 1.4 SECURITY DEFINER Functions

278 of 490 functions (57%) are SECURITY DEFINER, meaning they execute with the function owner's privileges rather than the caller's. This is a significant security surface:

- Functions like `sv_admin_delete_user`, `sv_admin_grant_role`, `sv_admin_update_user_status`, `sv_add_credits`, `sv_cancel_subscription`, `sv_block_user` are SECURITY DEFINER — these are privileged operations that bypass RLS
- The function names suggest proper authorization checks are implemented inside each function (e.g., `sv_check_staff_access`, `sv_check_permission`)
- **Risk:** If any SECURITY DEFINER function lacks an internal authorization check, any client can invoke it and perform privileged operations. Each of the 278 functions should be audited for internal auth guards

### 1.5 Key Table Deep Dives

#### `poker_hand_records` (7,027 rows, 31 MB — largest table)
- 54 columns including parsed hand data (positions, cards, board, actions) and analytics columns (flop texture, all-in EV, barrel flags)
- `raw_hand_text` column stores the original hand history text inline (up to ~2,331 chars per hand)
- `action_sequence` is JSONB — structured action data
- Indexed by user_id, hand_hash, import_batch_id

#### `content_spots` (6 rows, 304 KB)
- 31 columns including `image_urls` (`text[]` — array of text strings)
- Current rows have `image_urls_text_length = 2` (empty array `{}`), meaning no spot images are currently stored
- The `image_urls` column is designed to hold URLs or base64 data URLs — the array type is `text[]` which accepts any text, including multi-megabyte base64 strings
- `content_html`, `content_blocks` (JSONB), `quiz` (JSONB) store rich content inline
- `video_url` and `audio_url` are separate text columns for media references

#### `user_profiles` (17 rows, 120 KB)
- Stores user identity, social links, and profile metadata
- Referenced by `sv_roles` for role-based access control

#### `sv_roles` (22 rows)
- Role assignments: staff, superuser, admin, owner
- Used by storage policies for `media-manager` bucket access control
- `status` column (active/inactive) gates access

### 1.6 Extensions

Only 6 extensions are installed:
- `plpgsql` — standard PL/pgSQL language
- `pgcrypto` — cryptographic functions (used for `gen_random_uuid()`)
- `uuid-ossp` — UUID generation
- `btree_gist` — GiST indexing for common types
- `pg_stat_statements` — query performance tracking
- `supabase_vault` — secret storage

Notable available-but-not-installed extensions: `vector` (pgvector for AI embeddings), `pg_graphql` (GraphQL support), `pg_repack` (table bloat removal).

---

## PART 2 — Current File Storage

### 2.1 Storage Buckets Overview

| Bucket | Public | Size Limit | MIME Types | Files | Total Size | Access Pattern |
|--------|--------|-----------|------------|-------|------------|----------------|
| `user-uploads` | Yes | None | None | 9 | 13 MB | **anon-open CRUD** (CRITICAL) |
| `spotvault-assets` | Yes | 10 MB | images only | 1 | 2.2 MB | anon-open CRUD |
| `media-manager` | Yes | None | None | 0 | 0 | public read, staff write |
| `main-feed` | Yes | 10 MB | images only | 0 | 0 | public read, staff write |
| `presentation-media` | No (private) | 50 MB | audio + images | 0 | 0 | owner-scoped (auth.uid folder) |

**Total: 10 files, ~15 MB across all buckets**

### 2.2 Storage Policy Analysis

#### `user-uploads` bucket — CRITICAL SECURITY ISSUE
- **Public bucket** with **no size limit** and **no MIME type restrictions**
- Storage policies grant full CRUD to `anon, authenticated` with no ownership checks:
  - `Public upload user-uploads` — INSERT with `WITH CHECK (bucket_id = 'user-uploads')` (no folder/user check)
  - `Public read user-uploads` — SELECT with `USING (bucket_id = 'user-uploads')`
  - `Public update user-uploads` — UPDATE with `USING (bucket_id = 'user-uploads')`
  - `Public delete user-uploads` — DELETE with `USING (bucket_id = 'user-uploads')`
- **Additional policies** for `issues/` folder: `issue_uploads_insert` and `issue_uploads_select_owner` — these require `authenticated` and check folder path starts with `issues`, but still don't verify user ownership
- **Impact:** Any anonymous user can upload, read, modify, or delete any file in this bucket with no restrictions. This is an abuse vector for unauthorized file hosting, malware distribution, and data tampering.
- **Current usage:** 9 files, 13 MB — all in this bucket

#### `spotvault-assets` bucket — OPEN BUT RESTRICTED
- Public, 10 MB limit, images only (jpeg/png/webp/gif)
- Same open CRUD pattern as user-uploads (anon, authenticated, no ownership checks)
- Lower risk due to MIME and size restrictions, but still allows anon users to upload/delete

#### `media-manager` bucket — PROPERLY CONFIGURED
- Public read, staff-only write (uses `sv_roles` table to check `staff/superuser/admin/owner` role with `active` status)
- No size limit or MIME restriction (intended for video files)
- Currently empty (0 files) — media assignments reference YouTube videos and external URLs

#### `main-feed` bucket — PROPERLY CONFIGURED
- Public read, staff-only write (uses `sv_is_staff_or_admin()` helper function)
- 10 MB limit, images only
- Currently empty

#### `presentation-media` bucket — PROPERLY CONFIGURED
- Private bucket (not public — requires signed URLs)
- 50 MB limit, audio + image MIME types
- Owner-scoped: policies check `auth.uid() = (storage.foldername(name))[1]` — files must be in a folder named with the user's UUID
- SELECT policy also allows reading files for published guided presentations
- Currently empty

### 2.3 Non-Storage Data Patterns

#### Spot Images — Base64 in Database
- `content_spots.image_urls` is a `text[]` column designed to hold image URLs or base64 data URLs
- Currently no spots have images (all arrays are empty), but the column accepts base64 strings with no size constraint
- **Risk:** If base64 images are stored here, they inflate the database, can't be CDN-cached, and bloat query results. A single 1 MB image becomes ~1.3 MB of base64 text in the database.
- **Recommendation:** Migrate to Storage bucket references when images are needed

#### Hand History Raw Text — Inline in Database
- `poker_hand_records.raw_hand_text` stores the original hand history text
- Current max length: ~2,331 characters per hand
- With 7,027 hands, this is ~16 MB of text data — manageable inline
- Parsed fields (54 columns) are the primary query path; raw text is rarely accessed
- **Assessment:** Acceptable for current scale. If hand volume grows 10x+, consider moving raw text to cold storage or a separate table with TOAST optimization

### 2.4 Cross-Project Storage

The intro video ("SpotVault: The Return") is hosted on a **separate Supabase project** (`huososarkrngtpkpzsws.supabase.co`) in a bucket called `Intro-Video`. This is accessed via a public URL, not through the app's Supabase client. This split means:
- The video is not governed by the app's storage policies
- No access control or analytics from the app's Supabase project
- Operational complexity: two projects to manage

---

## PART 3 — Supabase Storage Opportunities

### 3.1 Migrate Spot Images to Storage

**Current state:** `content_spots.image_urls` is `text[]` — no images stored yet, but the column accepts base64 data URLs.

**Opportunity:** Before spot images are populated, migrate the pattern to use Storage:
- Create a `spot-images` bucket (public read, authenticated write with ownership check)
- Store image paths in `image_urls` (e.g., `spots/{spot_id}/img-1.jpg`)
- Generate public URLs via `supabase.storage.from('spot-images').getPublicUrl(path)`
- Benefits: CDN delivery, image transformations via Supabase Image API, no database bloat, size limits enforced at bucket level

### 3.2 User Avatar/Profile Image Storage

**Current state:** `user_profiles` likely stores avatar URLs as external links or base64.

**Opportunity:** Create a `profile-images` bucket:
- Private or public with owner-scoped policies (like `presentation-media`)
- 2 MB size limit, images only
- Store path in `user_profiles.avatar_url`
- Benefits: consistent delivery, no external dependency, access control

### 3.3 Coach/Listing Media Storage

**Current state:** `coach_listings` (2 rows) and professional listings may reference external media.

**Opportunity:** Create a `listing-media` bucket for coach/business promotional images:
- Public read, authenticated write with ownership check
- 5 MB limit, images only
- Store paths in listing tables

### 3.4 Hand History File Archive

**Current state:** Raw hand text stored inline in `poker_hand_records.raw_hand_text` (up to ~2.3 KB/hand, 16 MB total).

**Opportunity:** For large-scale operations, archive raw hand text files to a private `hand-archives` bucket:
- Private, owner-scoped
- Store path reference in `raw_hand_text_path` column
- Benefits: Reduces `poker_hand_records` table size (currently 31 MB), faster queries on parsed columns
- **Caveat:** Only worthwhile if hand volume grows significantly. At current scale (7K hands, 16 MB text), inline storage is fine.

### 3.5 Consolidate Video Hosting

**Current state:** The intro video is on a separate Supabase project. `media-manager` bucket exists but is empty.

**Opportunity:** Consolidate all video assets into the app's `media-manager` bucket:
- Upload the intro video to `media-manager/intro/spotvault-return.mp4`
- Update the `INTRO_VIDEO_URL` constant to point to the app project's public URL
- Benefits: Single project management, consistent access control, unified analytics
- **Caveat:** Requires uploading the video file to the app project's storage

### 3.6 Supabase Image Transformations

Supabase Storage supports on-the-fly image transformations (resize, crop, format conversion). If spot images or profile images are moved to Storage:
- Request resized variants: `?width=400&height=300&resize=cover`
- Serve WebP for modern browsers, JPEG fallback
- Generate thumbnails programmatically without storing multiple copies

### 3.7 Storage CDN & Caching

Public buckets are served through Supabase's global CDN. For data currently stored as base64 in the database (spot images, if populated), moving to Storage would automatically benefit from:
- Edge caching at CDN nodes
- `Cache-Control` headers for browser caching
- Reduced database load (images served from CDN, not Postgres)

---

## PART 4 — Additional Recommendations

### 4.1 Critical: Fix `user-uploads` Bucket Security

**Priority: HIGH**

The `user-uploads` bucket allows anonymous users to upload, read, update, and delete any file with no restrictions. This is the most significant security issue found in this audit.

**Recommended actions:**
1. Restrict INSERT to `authenticated` only with folder ownership check (like `presentation-media`): `WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = auth.uid()::text)`
2. Restrict UPDATE/DELETE to file owners only
3. Add MIME type restrictions (at minimum: images, PDFs, common document types)
4. Add file size limit (e.g., 10 MB)
5. If anonymous uploads are intentionally needed (e.g., for a public form), create a separate restricted bucket for that purpose with tight limits

### 4.2 Fix `spotvault-assets` Bucket Security

**Priority: MEDIUM**

Same open CRUD pattern as `user-uploads` but with MIME and size restrictions. Still allows anon users to delete any file.

**Recommended actions:**
1. Restrict INSERT/UPDATE/DELETE to `authenticated` with ownership or staff role check
2. Keep SELECT open for public read (this is a public assets bucket)

### 4.3 Enable RLS on `sv_spr_competition_pools`

**Priority: LOW**

This is the only table without RLS enabled. While it contains only 7 rows of configuration data, it should have RLS enabled with a SELECT policy (public read is fine for config data) to maintain consistency.

### 4.4 Audit SECURITY DEFINER Functions

**Priority: MEDIUM**

278 functions are SECURITY DEFINER. While many appear to have internal authorization checks (function names like `sv_check_staff_access`, `sv_check_permission`), each function should be audited to verify:
1. Internal auth guard exists and is called early in the function body
2. The function doesn't expose privileged operations to unauthenticated callers
3. `search_path` is explicitly set to prevent path injection attacks
4. EXECUTE privileges are granted only to necessary roles

### 4.5 Review Open RLS Policies

**Priority: MEDIUM**

241 policies use `USING (true)` and 145 use `WITH CHECK (true)`. While many are appropriate for a no-auth app with shared public data, tables containing user-specific data (profiles, preferences, entitlements, roles) should have ownership-scoped policies rather than open ones.

Tables with multiple `true` predicates that should be reviewed:
- `accomplishment_evidence` — 3 open USING, 2 open WITH CHECK
- `accomplishment_reviews` — open SELECT and INSERT
- `ai_assist_usage` — open SELECT and INSERT
- Many coaching/business/booking tables (currently empty but schema-defined)

### 4.6 Database Size Management

Current database is 66 MB — well within Supabase's free tier (500 MB). The largest table (`poker_hand_records`) at 31 MB is dominated by the `raw_hand_text` column and JSONB `action_sequence`. As hand volume grows:
- Monitor `poker_hand_records` growth rate
- Consider archiving raw text to Storage at ~50K+ hands
- Run `VACUUM ANALYZE` periodically (Supabase handles this automatically)
- `pg_repack` extension is available for bloat removal if needed

### 4.7 Index Optimization

717 indexes across 270 tables (2.65 indexes/table average). This is reasonable for the schema complexity. With 223 empty tables, many indexes are on tables with zero rows — these consume no storage but add overhead on writes when those tables become active. No immediate action needed, but monitor index usage via `pg_stat_user_indexes` once tables are populated.

### 4.8 Migration Hygiene

361 migrations spanning from August to October 2026. Migration filenames follow a consistent timestamp pattern. Some filenames contain doubled timestamps (e.g., `20260812060733_20260812101500_create_student_syncshare.sql.sql`) and `.sql.sql` extensions — cosmetic issues that don't affect functionality but indicate some migrations were created hastily. No action needed unless migrations need to be squashed for readability.

### 4.9 Two-Project Consolidation

The app uses two Supabase projects:
- `hfmrepdeyakvfqqyvofv.supabase.co` — app database, auth, storage
- `huososarkrngtpkpzsws.supabase.co` — intro video storage only

**Recommendation:** Consolidate the intro video into the app project's `media-manager` bucket to eliminate the second project. This reduces operational overhead, billing complexity, and ensures all assets are governed by one set of policies and analytics.

### 4.10 Backup & Recovery

No explicit backup strategy is visible from the audit. Supabase provides automatic daily backups on paid plans. The database is small (66 MB) and recoverable. For the storage layer (15 MB total), files are replicated across availability zones. No additional action needed at current scale, but as data grows, consider:
- Documenting the RPO/RTO expectations
- Verifying backup restore procedures quarterly
- Exporting critical configuration tables (app_settings, membership_tiers, sv_spr_weights) periodically

---

## Appendix A — Storage Bucket Policy Summary

| Bucket | SELECT | INSERT | UPDATE | DELETE | Security Model |
|--------|--------|--------|--------|--------|----------------|
| `user-uploads` | anon, auth (open) | anon, auth (open) | anon, auth (open) | anon, auth (open) | **No restrictions** |
| `spotvault-assets` | anon, auth (open) | anon, auth (open) | anon, auth (open) | anon, auth (open) | MIME + size only |
| `media-manager` | anon, auth (open) | auth (staff check) | auth (staff check) | auth (staff check) | Staff-gated writes |
| `main-feed` | anon, auth (open) | auth (staff check) | auth (staff check) | auth (staff check) | Staff-gated writes |
| `presentation-media` | auth (owner/published) | auth (owner folder) | auth (owner folder) | auth (owner folder) | Owner-scoped |

## Appendix B — Top Tables by Size

| Table | Size | Rows |
|-------|------|------|
| `poker_hand_records` | 31 MB | 7,027 |
| `sv_review_hands` | 1.2 MB | 557 |
| `poker_analytics_snapshots` | 576 KB | 2 |
| `user_preferences` | 432 KB | 6 |
| `content_spots` | 304 KB | 6 |
| `solver_jobs` | 232 KB | 0 |
| `page_views` | 184 KB | 352 |
| `preflop_reference_ranges` | 160 KB | 0 |
| `sv_saved_tournaments` | 144 KB | 1 |
| `network_chat_boosts` | 120 KB | 0 |

---

*End of audit report. No code or database changes were made. All findings are based on live database queries performed on the production Supabase project.*
