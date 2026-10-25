// Demo data for universal network destinations (Jobs, Advertising/Services, Store).
// Display only — never persisted or mixed with real records.

export interface JobListing {
  id: string;
  company: string;
  logo: string;
  title: string;
  location: string;
  workType: 'Remote' | 'Hybrid' | 'On-site';
  employmentType: 'Full-time' | 'Part-time' | 'Contract';
  compensation?: string;
  description: string;
  posted: string;
  tags: string[];
  featured?: boolean;
}

export const JOB_LISTINGS: JobListing[] = [];

export interface ServiceListing {
  id: string;
  provider: string;
  category: string;
  title: string;
  description: string;
  price?: string;
  tags: string[];
  featured?: boolean;
  hasProducts?: boolean;
}

export const SERVICE_LISTINGS: ServiceListing[] = [];

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  price: string;
  description: string;
  badge?: string;
}

export const STORE_PRODUCTS: StoreProduct[] = [];
