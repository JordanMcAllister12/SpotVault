/**
 * DEMO / PREVIEW DATA — Jobs & Candidates marketplace
 *
 * Clearly-marked demo data for visual testing of the Jobs & Candidates area.
 * None of this is written to the database. Isolated here for easy removal.
 */

export interface DemoJobPosting {
  id: string;
  company: string;
  companyAvatar: string;
  title: string;
  location: string;
  workType: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
  compensation: string;
  description: string;
  skills: string[];
  postedAgo: string;
}

export interface DemoCandidate {
  id: string;
  avatar: string;
  username: string;
  displayName: string;
  primaryRole: string;
  bio: string;
  location: string;
  availability: string;
  workType: string;
  expectedComp: string;
  experience: string;
  accomplishments: string[];
  skills: string[];
}

export const DEMO_JOB_POSTINGS: DemoJobPosting[] = [];

export const DEMO_CANDIDATES: DemoCandidate[] = [];
