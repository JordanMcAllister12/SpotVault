/*
# Create creator_public_profiles table

1. Purpose
   - Stores the public-facing profile for creators/pros/service providers.
   - This is the SINGLE SOURCE OF TRUTH for the People directory, public profile pages,
     booking interface, and paid messaging interface.
   - When a creator updates their profile here, it automatically propagates everywhere.

2. New Tables
   - `creator_public_profiles`
     - `id` (uuid, primary key)
     - `account_id` (uuid, not null, references auth.users, unique — one profile per account)
     - `display_name` (text)
     - `profile_photo_url` (text)
     - `banner_url` (text)
     - `tagline` (text)
     - `bio` (text)
     - `location` (text)
     - `role` (text — poker_pro, coach, creator, performance, industry_pro)
     - `specialties` (text[])
     - `social_links` (jsonb — twitter, instagram, youtube, twitch, discord, website)
     - `accept_paid_messages` (boolean, default false)
     - `paid_message_price` (integer, default 50)
     - `paid_message_description` (text)
     - `accept_bookings` (boolean, default false)
     - `booking_services` (jsonb — array of {name, description, price, duration})
     - `show_in_directory` (boolean, default true)
     - `directory_categories` (text[])
     - `show_social_links` (boolean, default true)
     - `allow_follows` (boolean, default true)
     - `show_courses` (boolean, default false)
     - `show_services` (boolean, default true)
     - `show_reviews` (boolean, default true)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

3. Security
   - Enable RLS on `creator_public_profiles`.
   - Owner-scoped CRUD: each authenticated user can only access their own profile row.
   - SELECT is open to anon+authenticated so the People directory can read public profiles.
   - INSERT/UPDATE/DELETE are owner-scoped (authenticated only, account_id = auth.uid()).
*/

CREATE TABLE IF NOT EXISTS creator_public_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text DEFAULT '',
  profile_photo_url text DEFAULT '',
  banner_url text DEFAULT '',
  tagline text DEFAULT '',
  bio text DEFAULT '',
  location text DEFAULT '',
  role text DEFAULT 'poker_pro',
  specialties text[] DEFAULT '{}',
  social_links jsonb DEFAULT '{}',
  accept_paid_messages boolean DEFAULT false,
  paid_message_price integer DEFAULT 50,
  paid_message_description text DEFAULT '',
  accept_bookings boolean DEFAULT false,
  booking_services jsonb DEFAULT '[]',
  show_in_directory boolean DEFAULT true,
  directory_categories text[] DEFAULT '{}',
  show_social_links boolean DEFAULT true,
  allow_follows boolean DEFAULT true,
  show_courses boolean DEFAULT false,
  show_services boolean DEFAULT true,
  show_reviews boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE creator_public_profiles ENABLE ROW LEVEL SECURITY;

-- Public SELECT so the People directory can read profiles
DROP POLICY IF EXISTS "public_select_creator_profiles" ON creator_public_profiles;
CREATE POLICY "public_select_creator_profiles"
ON creator_public_profiles FOR SELECT
TO anon, authenticated USING (true);

-- Owner can insert their own profile
DROP POLICY IF EXISTS "insert_own_creator_profile" ON creator_public_profiles;
CREATE POLICY "insert_own_creator_profile"
ON creator_public_profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = account_id);

-- Owner can update their own profile
DROP POLICY IF EXISTS "update_own_creator_profile" ON creator_public_profiles;
CREATE POLICY "update_own_creator_profile"
ON creator_public_profiles FOR UPDATE
TO authenticated USING (auth.uid() = account_id) WITH CHECK (auth.uid() = account_id);

-- Owner can delete their own profile
DROP POLICY IF EXISTS "delete_own_creator_profile" ON creator_public_profiles;
CREATE POLICY "delete_own_creator_profile"
ON creator_public_profiles FOR DELETE
TO authenticated USING (auth.uid() = account_id);
