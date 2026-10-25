/*
# Jobs Bulletin Board — Candidates and Job Postings

1. New Tables
- `job_candidates` — Candidate listings from users looking for work in the poker/gambling industry
  - id, user_id, name, avatar_url, location, open_to_remote, poker_background,
    other_background, skills (text[]), interested_roles (text[]), employment_preference,
    availability, introduction, resume_url, transition_support (text[]),
    is_published, is_hidden, created_at, updated_at
- `job_postings` — Job listings from companies hiring in the poker/gambling industry
  - id, user_id, company, company_logo, job_title, job_description, location,
    work_type, employment_type, salary_range, required_experience, preferred_experience,
    skills (text[]), application_deadline, contact_person, status, created_at, updated_at

2. Security
- Both tables have RLS enabled
- Owner-scoped CRUD via auth.uid() = user_id
- Published candidates and active jobs are readable by all authenticated users
- Hidden/closed items only visible to their owner

3. Future Matching Architecture
- Skills, interested_roles, transition_support, and required_experience stored as structured text arrays
- This allows future matching queries without schema changes
*/

-- Job Candidates
CREATE TABLE IF NOT EXISTS job_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  open_to_remote boolean NOT NULL DEFAULT true,
  poker_background text NOT NULL DEFAULT '',
  other_background text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  interested_roles text[] NOT NULL DEFAULT '{}',
  employment_preference text NOT NULL DEFAULT 'full-time',
  availability text NOT NULL DEFAULT '',
  introduction text NOT NULL DEFAULT '',
  resume_url text NOT NULL DEFAULT '',
  transition_support text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE job_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_job_candidates" ON job_candidates;
CREATE POLICY "select_job_candidates" ON job_candidates FOR SELECT TO authenticated
  USING (is_published = true AND is_hidden = false OR auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_job_candidates" ON job_candidates;
CREATE POLICY "insert_own_job_candidates" ON job_candidates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_job_candidates" ON job_candidates;
CREATE POLICY "update_own_job_candidates" ON job_candidates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_job_candidates" ON job_candidates;
CREATE POLICY "delete_own_job_candidates" ON job_candidates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Job Postings
CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  company_logo text NOT NULL DEFAULT '',
  job_title text NOT NULL,
  job_description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  work_type text NOT NULL DEFAULT 'remote',
  employment_type text NOT NULL DEFAULT 'full-time',
  salary_range text NOT NULL DEFAULT '',
  required_experience text NOT NULL DEFAULT '',
  preferred_experience text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  application_deadline date,
  contact_person text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_job_postings" ON job_postings;
CREATE POLICY "select_job_postings" ON job_postings FOR SELECT TO authenticated
  USING (status = 'active' OR auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_job_postings" ON job_postings;
CREATE POLICY "insert_own_job_postings" ON job_postings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_job_postings" ON job_postings;
CREATE POLICY "update_own_job_postings" ON job_postings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_job_postings" ON job_postings;
CREATE POLICY "delete_own_job_postings" ON job_postings FOR DELETE TO authenticated USING (auth.uid() = user_id);
