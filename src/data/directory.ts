export type DirectoryCategory =
  | 'ALL' | 'PLAYERS' | 'FOUNDERS' | 'INVESTORS' | 'CREATORS' | 'STREAMERS'
  | 'MEDIA' | 'BUSINESS_EXECUTIVES' | 'COACHES' | 'STABLE_OPERATORS'
  | 'POKER_SITE_STAFF' | 'TOURNAMENT_STAFF' | 'AFFILIATES' | 'VENDORS' | 'OTHER_INDUSTRY';

export type ContactState =
  | 'NOT_CONNECTED' | 'CONNECTION_REQUESTED' | 'CONNECTED'
  | 'INVITE_AVAILABLE' | 'PAID_ACCESS' | 'DIRECT_MESSAGE_ALLOWED' | 'FILTERED';

export type ContactSetting = 'ALLOW' | 'ALLOW_REQUESTS' | 'FILTER' | 'OPTIONAL' | 'AVAILABLE';

export interface AvailabilitySlot {
  title: string;
  priceCredits: number;
  type: 'paid' | 'request';
}

export interface HubMembership {
  hub: string;
  access: 'Permanent' | 'Verified' | 'Guest Eligible' | 'Request';
}

export interface DirectoryProfile {
  id: string;
  name: string;
  verified: boolean;
  role: string;
  organization: string;
  homeHub: string;
  location: string;
  bio: string;
  category: DirectoryCategory;
  mutualConnections: number;
  contactState: ContactState;
  online: boolean;
  availableForMeetings: boolean;
  paidAccessAvailable: boolean;
  contactSettings: {
    connections: ContactSetting;
    verifiedIndustry: ContactSetting;
    investors: ContactSetting;
    generalPublic: ContactSetting;
    paidConsultations: ContactSetting;
    priorityMessages: ContactSetting;
  };
  availability: AvailabilitySlot[];
  hubMemberships: HubMembership[];
  organizations: string[];
  isDemo?: boolean;
}

export const DIRECTORY_PROFILES: DirectoryProfile[] = [];

export const FILTER_CHIPS: { label: string; value: DirectoryCategory }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Players', value: 'PLAYERS' },
  { label: 'Creators', value: 'CREATORS' },
  { label: 'Founders', value: 'FOUNDERS' },
  { label: 'Investors', value: 'INVESTORS' },
  { label: 'Media', value: 'MEDIA' },
  { label: 'Business', value: 'BUSINESS_EXECUTIVES' },
  { label: 'Coaches', value: 'COACHES' },
  { label: 'Stables', value: 'STABLE_OPERATORS' },
  { label: 'Industry', value: 'OTHER_INDUSTRY' },
];

export const DIRECTORY_CATEGORIES: { label: string; value: DirectoryCategory }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Players', value: 'PLAYERS' },
  { label: 'Founders', value: 'FOUNDERS' },
  { label: 'Investors', value: 'INVESTORS' },
  { label: 'Creators', value: 'CREATORS' },
  { label: 'Streamers', value: 'STREAMERS' },
  { label: 'Media', value: 'MEDIA' },
  { label: 'Business Executives', value: 'BUSINESS_EXECUTIVES' },
  { label: 'Coaches', value: 'COACHES' },
  { label: 'Stable Operators', value: 'STABLE_OPERATORS' },
  { label: 'Poker Site Staff', value: 'POKER_SITE_STAFF' },
  { label: 'Tournament Staff', value: 'TOURNAMENT_STAFF' },
  { label: 'Affiliates / Partners', value: 'AFFILIATES' },
  { label: 'Vendors', value: 'VENDORS' },
  { label: 'Other Industry', value: 'OTHER_INDUSTRY' },
];
