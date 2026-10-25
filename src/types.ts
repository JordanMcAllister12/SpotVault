export type HubId =
  | 'PLAYER'
  | 'MEDIA'
  | 'BUSINESS'
  | 'COACH'
  | 'STABLE'
  | 'JOBS'
  | 'CREATOR'
  | 'TOURNAMENTS'
  | 'MARKETPLACE'
  | 'INVESTOR'
  | 'EVENTS'
  | 'PARTNERSHIPS'
  | 'AFFILIATE_PARTNER'
  | 'EXPO'
  | 'PRO'
  | 'HELP'
  | 'STAFF'
  | 'STAKEKINGS_PLAYER'
  | 'STAKEKINGS_ADMIN';

export type HubView =
  | 'player' | 'media' | 'business' | 'marketplace' | 'expo'
  | 'coach' | 'stable' | 'jobs' | 'creator' | 'investor'
  | 'events' | 'partnerships' | 'pro' | 'help';

export type AccessLevel = 'permanent' | 'guest' | 'available' | 'locked';

export type ScreenId = 'access' | 'player' | 'media' | 'innercircle' | 'investor';

export type TumblerPhase = 'idle' | 'active';

export interface HubAccess {
  hub: HubId;
  label: string;
  access: AccessLevel;
  note: string;
}

export interface FeedComment {
  author: string;
  text: string;
  avatar?: string;
}

export interface FeedItem {
  id: string;
  hub: HubId;
  author: string;
  verified?: boolean;
  org?: boolean;
  kind: string;
  title: string;
  body?: string;
  cta: string;
  timestamp: string;
  published?: boolean;
  comments?: FeedComment[];
  likes?: number;
  reposts?: number;
  comments_count?: number;
  saves?: number;
  shares?: number;
}

export const HUB_LABELS: Record<HubId, string> = {
  PLAYER: 'Player Hub',
  MEDIA: 'Media Hub',
  BUSINESS: 'Business Hub',
  COACH: 'Coach Hub',
  STABLE: 'Stable Hub',
  JOBS: 'Jobs Hub',
  CREATOR: 'Creator Hub',
  TOURNAMENTS: 'Tournaments Hub',
  MARKETPLACE: 'Marketplace Hub',
  INVESTOR: 'Investor Hub',
  EVENTS: 'Events Hub',
  PARTNERSHIPS: 'Affiliate / Partner Portal',
  AFFILIATE_PARTNER: 'Affiliate / Partner Portal',
  EXPO: 'Expo Hub',
  HELP: 'Help Hub',
};

export const HUB_SHORT: Record<HubId, string> = {
  PLAYER: 'PLAYER',
  MEDIA: 'MEDIA',
  BUSINESS: 'BUSINESS',
  COACH: 'COACH',
  STABLE: 'STABLE',
  JOBS: 'JOBS',
  CREATOR: 'CREATOR',
 TOURNAMENTS: 'TOURNAMENTS',
  MARKETPLACE: 'MARKETPLACE',
  INVESTOR: 'INVESTOR',
  EVENTS: 'EVENTS',
  PARTNERSHIPS: 'PARTNERSHIPS',
  AFFILIATE_PARTNER: 'AFFILIATE_PARTNER',
  EXPO: 'EXPO',
  HELP: 'HELP',
};

// Tumbler ring labels — hubs around the rings
export const TUMBLER_HUBS: HubId[] = [
  'PLAYER',
  'INVESTOR',
  'MEDIA',
  'BUSINESS',
  'COACH',
  'STABLE',
  'JOBS',
  'CREATOR',
  'TOURNAMENTS',
  'PRO',
  'HELP',
];

export const ALL_HUBS: HubId[] = TUMBLER_HUBS;

export const INITIAL_ACCESS: HubAccess[] = [
  { hub: 'PLAYER', label: 'Player Hub', access: 'permanent', note: 'Permanent' },
  { hub: 'MEDIA', label: 'Media Hub', access: 'locked', note: 'Invite Required' },
  { hub: 'BUSINESS', label: 'Business Hub', access: 'locked', note: 'Invite Required' },
  { hub: 'COACH', label: 'Coach Hub', access: 'locked', note: 'Invite Required' },
  { hub: 'STABLE', label: 'Stable Hub', access: 'locked', note: 'Invite Required' },
  { hub: 'JOBS', label: 'Jobs Hub', access: 'available', note: 'Public Access' },
  { hub: 'CREATOR', label: 'Creator Hub', access: 'locked', note: 'Invite Required' },
  { hub: 'TOURNAMENTS', label: 'Tournaments Hub', access: 'locked', note: 'Invite Required' },
];

export const INITIAL_FEED: FeedItem[] = [
  {
    id: 'f-jeff-interview',
    hub: 'MEDIA',
    author: 'Jeff Platt',
    verified: true,
    kind: 'NEW INTERVIEW',
    title: 'Kevin Martin: The Future of Poker Content',
    body: 'A conversation about poker media, competition, studying and where the industry is heading.',
    cta: 'Read Interview',
    timestamp: '1h',
    likes: 142,
    reposts: 38,
    comments_count: 24,
    saves: 67,
    shares: 12,
    comments: [
      { author: 'Maria Ho', text: 'Great read. Kevin has been ahead of the curve on content for years.' },
      { author: 'Ryan DePaulo', text: 'The streaming section is spot on. Exactly what I have been saying.' },
      { author: 'Jamie Kerstetter', text: 'Bookmarking this. The part about content monetization is important.' },
    ],
  },
  {
    id: 'f-ggpoker-pm',
    hub: 'BUSINESS',
    author: 'GGPoker',
    verified: true,
    org: true,
    kind: "WE'RE HIRING",
    title: 'Product Manager',
    body: 'Remote • Full-Time. Lead product strategy for the fastest-growing poker platform.',
    cta: 'View Opportunity',
    timestamp: '3h',
    likes: 89,
    reposts: 51,
    comments_count: 17,
    saves: 134,
    shares: 28,
    comments: [
      { author: 'Alex T.', text: 'Great role — GG is hiring aggressively right now.' },
      { author: 'Sarah L.', text: 'Applied yesterday. Fingers crossed.' },
    ],
  },
  {
    id: 'f-wsop-schedule',
    hub: 'TOURNAMENTS',
    author: 'WSOP',
    verified: true,
    org: true,
    kind: 'SERIES UPDATE',
    title: '2027 Schedule Announcement',
    body: 'The World Series of Poker has released the official schedule for the 2027 festival. 99 bracelet events. New $100K Super High Roller. Returns to Horseshoe & Paris Las Vegas May 26 – July 15.',
    cta: 'View Announcement',
    timestamp: '5h',
    likes: 312,
    reposts: 147,
    comments_count: 89,
    saves: 256,
    shares: 64,
    comments: [
      { author: 'Darren R.', text: 'The $100K SHR is going to be wild.' },
      { author: 'Maria K.', text: 'Already booking my flight. See you in Vegas.' },
      { author: 'Phil N.', text: '99 bracelet events. This is the biggest series yet.' },
    ],
  },
  {
    id: 'f-stable-apps',
    hub: 'STABLE',
    author: 'MTT Stable',
    verified: true,
    org: true,
    kind: 'APPLICATIONS OPEN',
    title: 'Applications are now open for our upcoming cohort',
    body: 'Looking for profitable MTT players with verified results. Coaching, staking, and bankroll management included.',
    cta: 'View Stable',
    timestamp: '8h',
    likes: 67,
    reposts: 22,
    comments_count: 11,
    saves: 89,
    shares: 15,
    comments: [
      { author: 'Tom B.', text: 'Applied. Great program — have heard good things.' },
    ],
  },
  {
    id: 'f-player-question',
    hub: 'PLAYER',
    author: 'PokerDreamer',
    kind: 'DISCUSSION',
    title: 'I want to get involved in the poker industry. Where do I start?',
    body: 'I have been playing recreationally for 3 years and want to transition into the industry side. Content, coaching, staking — what is the best path?',
    cta: 'Join Discussion',
    timestamp: '12h',
    likes: 34,
    reposts: 8,
    comments_count: 43,
    saves: 12,
    shares: 3,
    comments: [
      { author: 'Jeff Platt', text: 'Start by creating content around hands you find interesting. Consistency matters more than quality at first.' },
      { author: 'Maria Ho', text: 'Coaching is a great entry point if you have strong fundamentals. Start with a few free sessions to build your name.' },
      { author: 'Spraggy', text: 'Streaming changed everything for me. If you enjoy being on camera, that is the fastest path.' },
      { author: 'Courtney Gee', text: 'Do not sleep on the stable side. Managing players and learning the business of poker is undervalued.' },
    ],
  },
  {
    id: 'f-cf-freeroll',
    hub: 'PLAYER',
    author: 'SpotVault',
    verified: true,
    org: true,
    kind: 'COMMUNITY FUND',
    title: 'SpotVault Community Fund has added $25,000 to this month\'s player freeroll.',
    body: 'As SpotVault grows, we want poker to grow with us. The Community Fund periodically reinvests in the poker ecosystem — funding players, opportunities, wellness, education and the future of poker.',
    cta: 'View Community Fund',
    timestamp: '2h',
    likes: 218,
    reposts: 94,
    comments_count: 31,
    saves: 142,
    shares: 47,
    comments: [
      { author: 'Maria Ho', text: 'This is what the industry needs. Reinvesting in the player base.' },
      { author: 'Kevin Martin', text: 'Love seeing this. The freeroll is going to be huge.' },
    ],
  },
  {
    id: 'f-cf-wellness',
    hub: 'PLAYER',
    author: 'SpotVault',
    verified: true,
    org: true,
    kind: 'COMMUNITY FUND',
    title: 'Community Fund supported 20 player wellness sessions this month.',
    body: 'Therapy assistance and mental-performance resources are part of how the Community Fund gives back. Individual support activity remains completely private.',
    cta: 'Learn More',
    timestamp: '1d',
    likes: 156,
    reposts: 62,
    comments_count: 18,
    saves: 88,
    shares: 24,
    comments: [
      { author: 'Jamie Kerstetter', text: 'Wellness support in poker is so important. Thank you SpotVault.' },
    ],
  },
  {
    id: 'f-cf-education',
    hub: 'PLAYER',
    author: 'SpotVault',
    verified: true,
    org: true,
    kind: 'COMMUNITY FUND',
    title: 'Applications are open for the next SpotVault education grant.',
    body: 'The Community Fund is accepting applications for poker education grants — training, scholarships, coaching initiatives and educational opportunities.',
    cta: 'Apply Now',
    timestamp: '3d',
    likes: 134,
    reposts: 71,
    comments_count: 22,
    saves: 203,
    shares: 38,
    comments: [
      { author: 'Bencb789', text: 'Great initiative. Education is the highest-leverage way to help the community.' },
    ],
  },
];

export const PLAYER_ACTIVITY = [
  { text: 'Jeff Platt invited you to Media Hub', time: '2m' },
  { text: 'Maria Ho commented on your post', time: '18m' },
  { text: 'GGPoker posted a new opportunity', time: '1h' },
  { text: 'Interview room scheduled', time: '2h' },
  { text: 'Spraggy connected with you', time: '4h' },
];

export const PLAYER_ROOMS = [
  { name: 'Strategy Session', with: 'w/ Spraggy', status: 'live' },
  { name: 'Interview Room 04', with: 'w/ Jeff Platt', status: 'scheduled' },
];

export const PLAYER_OPPORTUNITIES = [
  { title: 'Product Manager', org: 'GGPoker', detail: 'Full-Time · Remote' },
  { title: 'Content Creator', org: 'PokerOrg', detail: 'Part-Time · Remote' },
  { title: 'Coach / Trainer', org: 'Elite Poker Coaching', detail: 'Contract · Remote' },
];

export const PLAYER_NETWORK_AVATARS = [
  { name: 'Jeff Platt', hub: 'MEDIA' },
  { name: 'Maria Ho', hub: 'PLAYER' },
  { name: 'Spraggy', hub: 'COACH' },
  { name: 'Kevin Rabichow', hub: 'BUSINESS' },
  { name: 'Courtney Gee', hub: 'STABLE' },
];

export const PEOPLE_ONLINE = [
  { name: 'Jeff Platt', hub: 'MEDIA' },
  { name: 'Maria Ho', hub: 'PLAYER' },
  { name: 'Spraggy', hub: 'COACH' },
  { name: 'Kevin Rabichow', hub: 'BUSINESS' },
  { name: 'Courtney Gee', hub: 'STABLE' },
];

export const ONLINE_COUNT = 1284;

// ===== Inner Circle right-column data =====

export const TRENDING_TOPICS = [
  { tag: 'WSOP2027', posts: '12.4K posts' },
  { tag: 'GGPokerHiring', posts: '3.1K posts' },
  { tag: 'PokerContent', posts: '8.7K posts' },
  { tag: 'MTTStaking', posts: '2.3K posts' },
  { tag: 'ICMStrategy', posts: '1.9K posts' },
];

export const WHO_TO_FOLLOW = [
  { name: 'Darren Elias', handle: '@DarrenElias', hub: 'TOURNAMENTS' as HubId, verified: true },
  { name: 'Lex Veldhuis', handle: '@LexVeldhuis', hub: 'CREATOR' as HubId, verified: true },
  { name: 'Kristen Bicknell', handle: '@krissybicknell', hub: 'PLAYER' as HubId, verified: true },
];

export const UPCOMING_EVENTS = [
  { title: 'WSOP 2027 Day 1', date: 'May 26', location: 'Las Vegas' },
  { title: 'ICM Workshop Live', date: 'Thu 7PM ET', location: 'Online' },
  { title: 'GG Spring Festival', date: 'Apr 14', location: 'GGPoker' },
];

export const ACTIVE_ROOMS = [
  { name: 'High Stakes Strategy', count: 47, live: true },
  { name: 'Poker Content Lab', count: 23, live: true },
  { name: 'MTT Review Session', count: 31, live: true },
];

// ===== Inner Circle left nav =====

export const IC_NAV = [
  { label: 'Home', active: true },
  { label: 'Following' },
  { label: 'Trending' },
  { label: 'Industry Wire' },
  { label: 'Bookmarks' },
  { label: 'My Activity' },
];

// ===== NETWORK DIRECTORY (12 Hubs) =====

export interface DirectoryHub {
  id: string;
  name: string;
  tagline: string;
  description: string;
  examples: string[];
  status: 'home' | 'available' | 'guest' | 'request' | 'restricted' | 'coming';
  statusLabel: string;
  buttonLabel: string;
  iconName: string;
}

export const DIRECTORY_HUBS: DirectoryHub[] = [
  {
    id: 'player', name: 'Player Vault', tagline: 'Your personal poker operating system.',
    description: 'Library, Analytics, Hand Histories, Study, Results, Profile, Connections',
    examples: ['Library', 'Analytics', 'Hand Histories', 'Study', 'Results', 'Profile'],
    status: 'home', statusLabel: 'Home · Permanent Access', buttonLabel: 'Enter', iconName: 'ShieldCheck',
  },
  {
    id: 'pro', name: 'Pro / Talent Portal', tagline: 'Premium access marketplace for booking poker professionals.',
    description: 'Talent Profiles, Services Marketplace, Video Sessions, Private Chat, Bookings, Earnings, Reviews',
    examples: ['Talent Profiles', 'Services', 'Video Sessions', 'Private Chat', 'Bookings', 'Reviews'],
    status: 'request', statusLabel: 'Application / Approval Required', buttonLabel: 'Request Access', iconName: 'Trophy',
  },
  {
    id: 'marketplace', name: 'Marketplace Hub', tagline: 'The commerce layer of poker knowledge and expertise.',
    description: 'Spots, HH Bundles, Full Tournament HHs, Courses, Coaching, Services, Premium Analysis',
    examples: ['Spots', 'HH Bundles', 'Courses', 'Coaching', 'Services', 'Premium Analysis'],
    status: 'available', statusLabel: 'Available', buttonLabel: 'Enter Marketplace', iconName: 'ShoppingBag',
  },
  {
    id: 'media', name: 'Media Hub', tagline: 'Where poker media is created, coordinated and distributed.',
    description: 'Interviews, Articles, News, Press Releases, Podcasts, Media Rooms, Embargoed Releases',
    examples: ['Interviews', 'Articles', 'News', 'Podcasts', 'Media Rooms'],
    status: 'guest', statusLabel: 'Guest Access · By Invitation', buttonLabel: 'Request Access', iconName: 'Radio',
  },
  {
    id: 'business', name: 'Business Hub', tagline: 'The professional operating environment for poker companies.',
    description: 'Poker Operators, Software Companies, Startups, Service Providers, Industry Executives',
    examples: ['Operators', 'Software Companies', 'Startups', 'Service Providers', 'Executives'],
    status: 'request', statusLabel: 'Verified Business Access', buttonLabel: 'Request Access', iconName: 'Briefcase',
  },
  {
    id: 'coach', name: 'Coach Hub', tagline: 'Where poker coaches operate their businesses and work with students.',
    description: 'Coach Directory, Student Management, Bookings, Study Rooms, Resources, Private Sessions',
    examples: ['Coach Directory', 'Student Management', 'Bookings', 'Study Rooms', 'Private Sessions'],
    status: 'request', statusLabel: 'Professional Access', buttonLabel: 'Request Access', iconName: 'GraduationCap',
  },
  {
    id: 'stable', name: 'Stable Hub', tagline: 'Infrastructure for poker teams and staking organizations.',
    description: 'Recruiting, Applications, Rosters, Study Rooms, Player Management, Team Communications',
    examples: ['Recruiting', 'Applications', 'Rosters', 'Study Rooms', 'Player Management'],
    status: 'request', statusLabel: 'Organization Access', buttonLabel: 'Request Access', iconName: 'Users',
  },
  {
    id: 'jobs', name: 'Jobs & Industry Hub', tagline: 'Where poker careers begin and industry talent is discovered.',
    description: 'Job Listings, Recruiting, Career Profiles, Applications, Industry Opportunities',
    examples: ['Job Listings', 'Recruiting', 'Career Profiles', 'Applications', 'Talent Discovery'],
    status: 'available', statusLabel: 'Public Access', buttonLabel: 'Enter', iconName: 'Briefcase',
  },
  {
    id: 'creator', name: 'Creator Hub', tagline: 'The professional network for poker creators and streamers.',
    description: 'Streamers, YouTubers, Podcasters, Influencers, Collaborations, Brand Opportunities',
    examples: ['Streamers', 'YouTubers', 'Podcasters', 'Collaborations', 'Brand Opportunities'],
    status: 'request', statusLabel: 'Creator Access', buttonLabel: 'Request Access', iconName: 'Video',
  },
  {
    id: 'investor', name: 'Investor Hub', tagline: 'A controlled environment connecting poker businesses, founders and capital.',
    description: 'Startup Profiles, Pitch Submissions, Investor Directory, Pitch Rooms, Funding Opportunities',
    examples: ['Startup Profiles', 'Pitch Submissions', 'Investor Directory', 'Pitch Rooms', 'Funding'],
    status: 'restricted', statusLabel: 'Restricted · Verified Participants Only', buttonLabel: 'Request Access', iconName: 'TrendingUp',
  },
  {
    id: 'events', name: 'Events Hub', tagline: 'The operating layer for live and online poker events.',
    description: 'Tournament Series, Tours, Casinos, Schedules, Announcements, Media Access',
    examples: ['Tournament Series', 'Tours', 'Casinos', 'Schedules', 'Announcements'],
    status: 'available', statusLabel: 'Available', buttonLabel: 'Enter Events Hub', iconName: 'Calendar',
  },
  {
    id: 'partnerships', name: 'Partnerships Hub', tagline: 'Where commercial relationships across poker are created.',
    description: 'Sponsorships, Affiliates, Ambassadors, Brand Partnerships, Platform Integrations, B2B',
    examples: ['Sponsorships', 'Affiliates', 'Ambassadors', 'Brand Partnerships', 'B2B Opportunities'],
    status: 'available', statusLabel: 'Available', buttonLabel: 'Enter Partnerships Hub', iconName: 'Handshake',
  },
  {
    id: 'expo', name: 'Expo Hub', tagline: 'The permanent digital trade floor of the poker industry.',
    description: 'Poker Tables, Playing Cards, Chips, Apparel, Technology, Software, Streaming Equipment',
    examples: ['Poker Tables', 'Playing Cards', 'Chips', 'Apparel', 'Technology', 'Streaming Equipment'],
    status: 'available', statusLabel: 'Available · Open 365 Days a Year', buttonLabel: 'Enter Expo Hub', iconName: 'Store',
  },
  {
    id: 'help', name: 'Help Hub', tagline: 'Performance, mental wellness & responsible gambling for poker players.',
    description: 'Performance Coaching, Mental Wellness, Responsible Gambling, Get Help, Help Library, Professionals',
    examples: ['Performance', 'Mental Wellness', 'Responsible Gambling', 'Get Help', 'Help Library', 'Professionals'],
    status: 'available', statusLabel: 'Free · Available to All Members', buttonLabel: 'Enter Help Hub', iconName: 'HeartPulse',
  },
];

// ===== MARKETPLACE =====

export interface MarketplaceItem {
  id: string;
  title: string;
  seller: string;
  type: string;
  priceCredits: number;
  tag?: string;
  providerId?: string;
}

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [];

// ===== ORGANIZATIONS =====

export interface OrgLocation {
  hub: string;
  role: string;
}

export interface Organization {
  name: string;
  type: string;
  verified: boolean;
  locations: OrgLocation[];
}

export const ORGANIZATIONS: Organization[] = [
  {
    name: 'GGPoker', type: 'Official Organization', verified: true,
    locations: [
      { hub: 'Business Hub', role: 'Corporate Office' },
      { hub: 'Jobs Hub', role: 'Recruiting Office' },
      { hub: 'Creator Hub', role: 'Creator Partnerships' },
      { hub: 'Partnerships Hub', role: 'Commercial Partnerships' },
      { hub: 'Events Hub', role: 'Tournament Announcements' },
    ],
  },
  {
    name: 'PokerStars', type: 'Official Organization', verified: true,
    locations: [
      { hub: 'Business Hub', role: 'Corporate Office' },
      { hub: 'Jobs Hub', role: 'Recruiting Office' },
      { hub: 'Partnerships Hub', role: 'Commercial Partnerships' },
    ],
  },
  {
    name: 'WSOP', type: 'Official Organization', verified: true,
    locations: [
      { hub: 'Business Hub', role: 'Corporate Office' },
      { hub: 'Events Hub', role: 'Series Operations' },
      { hub: 'Media Hub', role: 'Press Office' },
    ],
  },
  {
    name: 'PokerOrg', type: 'Official Media Organization', verified: true,
    locations: [
      { hub: 'Media Hub', role: 'Newsroom' },
      { hub: 'Creator Hub', role: 'Content Partnerships' },
    ],
  },
];

// ===== EXPO =====

export const EXPO_CATEGORIES = [
  { name: 'Poker Software', boothCount: 12, iconName: 'Monitor' },
  { name: 'Poker Tables', boothCount: 8, iconName: 'Table' },
  { name: 'Playing Cards & Chips', boothCount: 15, iconName: 'Spade' },
  { name: 'Streaming Technology', boothCount: 9, iconName: 'Radio' },
  { name: 'Apparel', boothCount: 11, iconName: 'Shirt' },
  { name: 'Data & Analytics', boothCount: 7, iconName: 'BarChart' },
  { name: 'Content Production', boothCount: 6, iconName: 'Video' },
  { name: 'Other Services', boothCount: 14, iconName: 'Package' },
];

// ===== CREDITS =====

export const CREDITS_USAGE = [
  'Marketplace Purchases',
  'Book Professional Time',
  'Premium Submissions',
  'Industry Booths',
  'Services',
  'Premium Content',
];

// ===== PLAYER VAULT =====

export const PLAYER_VAULT_SHORTCUTS = [
  { label: 'My Spots', iconName: 'Library' },
  { label: 'Hand Histories', iconName: 'FileText' },
  { label: 'Analytics', iconName: 'BarChart' },
  { label: 'HH Replayer', iconName: 'Play' },
  { label: 'Purchased Content', iconName: 'ShoppingBag' },
  { label: 'Study', iconName: 'BookOpen' },
  { label: 'Results', iconName: 'Trophy' },
  { label: 'Profile', iconName: 'User' },
];

// ===== PROFESSIONAL AVAILABILITY =====

export interface AvailabilitySlot {
  title: string;
  priceCredits: number;
  type: 'paid' | 'request';
}

export const PROFESSIONAL_AVAILABILITY: AvailabilitySlot[] = [
  { title: '15 Minute Media Consultation', priceCredits: 500, type: 'paid' },
  { title: '30 Minute Industry Call', priceCredits: 1000, type: 'paid' },
  { title: 'Interview Request', priceCredits: 0, type: 'request' },
];

// ===== MESSAGE PRIVACY =====

export const MESSAGE_PRIVACY_SETTINGS = [
  { label: 'Connections', status: 'ON' },
  { label: 'Verified Industry', status: 'ON' },
  { label: 'General Public', status: 'FILTERED' },
  { label: 'Paid Priority', status: 'OPTIONAL' },
];

// ===== STARTING CREDITS =====

export const STARTING_CREDITS = 0;

// ===== PORTAL ENVIRONMENT THEMES =====

export type ThemeId =
  | 'clubhouse-lounge'
  | 'final-table'
  | 'high-roller-lounge'
  | 'vegas-night'
  | 'modern-poker-studio'
  | 'private-locker-room'
  | 'monte-carlo'
  | 'private-jet-lounge'
  | 'home-grind-setup'
  | 'wsop-arena';

export interface PortalTheme {
  id: ThemeId;
  name: string;
  subtitle: string;
  gradient: string;
  accent: string;
}

export const PLAYER_THEMES: PortalTheme[] = [
  { id: 'clubhouse-lounge', name: 'Clubhouse Lounge', subtitle: 'Dark walnut · leather · warm member-club light', gradient: 'radial-gradient(ellipse at 50% 24%, #6b4a2a 0%, #24170e 35%, #0d0906 72%, #030201 100%)', accent: '#d4a52c' },
  { id: 'final-table', name: 'Final Table', subtitle: 'Championship stage · feature table · arena lighting', gradient: 'radial-gradient(ellipse at 50% 34%, #4b3c2c 0%, #17151a 32%, #07080c 70%, #020204 100%)', accent: '#e2b84f' },
  { id: 'high-roller-lounge', name: 'High Roller Lounge', subtitle: 'Private casino room · black leather · gold detail', gradient: 'radial-gradient(ellipse at 72% 18%, #b78a3e 0%, #2c1d12 28%, #0e0a08 65%, #030202 100%)', accent: '#d4a52c' },
  { id: 'vegas-night', name: 'Vegas Night', subtitle: 'High-rise suite · city lights · night skyline', gradient: 'radial-gradient(ellipse at 58% 30%, #6a3850 0%, #1a1424 32%, #070910 70%, #010205 100%)', accent: '#e4b66a' },
  { id: 'modern-poker-studio', name: 'Modern Poker Studio', subtitle: 'Analysis desk · monitor wall · clean dark studio', gradient: 'radial-gradient(ellipse at 30% 28%, #3e5668 0%, #111a22 35%, #070b10 68%, #020304 100%)', accent: '#8db6c8' },
  { id: 'private-locker-room', name: 'Private Locker Room', subtitle: 'Personal lockers · trophies · warm indirect light', gradient: 'radial-gradient(ellipse at 35% 22%, #80532a 0%, #2b180d 34%, #100906 70%, #030201 100%)', accent: '#d4a52c' },
  { id: 'monte-carlo', name: 'Monte Carlo', subtitle: 'European casino · marble · quiet evening glamour', gradient: 'radial-gradient(ellipse at 50% 18%, #8c744e 0%, #2a241b 32%, #0c0b09 68%, #020202 100%)', accent: '#dbc383' },
  { id: 'private-jet-lounge', name: 'Private Jet Lounge', subtitle: 'High-stakes travel · leather · runway glow', gradient: 'radial-gradient(ellipse at 70% 24%, #6a7180 0%, #202632 34%, #090c12 70%, #020304 100%)', accent: '#c7d2dc' },
  { id: 'home-grind-setup', name: 'Home Grind Setup', subtitle: 'Premium office · multiple screens · focused study', gradient: 'radial-gradient(ellipse at 45% 26%, #36516a 0%, #101b27 34%, #060b12 70%, #010204 100%)', accent: '#8bb8d4' },
  { id: 'wsop-arena', name: 'Championship Arena', subtitle: 'Televised final table · dramatic stage · audience glow', gradient: 'radial-gradient(ellipse at 50% 42%, #6d4d2d 0%, #21191a 30%, #09090d 68%, #010103 100%)', accent: '#e5b85a' },
];

// ===== PORTAL WIRE (PRIVATE FEEDS) =====

export type CommunicationLevel = 'private' | 'portal' | 'community';

export interface WirePost {
  id: string;
  author: string;
  handle: string;
  portal: string;
  body: string;
  timestamp: string;
  likes: number;
  comments: number;
  saves: number;
  liked?: boolean;
  saved?: boolean;
  publishedToCommunity?: boolean;
}

export const PLAYER_WIRE_SEED: WirePost[] = [
  {
    id: 'pw-1',
    author: 'Maria Ho',
    handle: '@mariaho',
    portal: 'PLAYER',
    body: 'Anyone playing the Montreal series next week? Looking to swap some action in the Main.',
    timestamp: '12m',
    likes: 14,
    comments: 7,
    saves: 2,
  },
  {
    id: 'pw-2',
    author: 'Spraggy',
    handle: '@spraggy',
    portal: 'PLAYER',
    body: 'These structures need longer levels. 20-minute levels in a $1K is just a turbo with extra steps.',
    timestamp: '38m',
    likes: 31,
    comments: 12,
    saves: 5,
  },
  {
    id: 'pw-3',
    author: 'Kevin Rabichow',
    handle: '@krabichow',
    portal: 'PLAYER',
    body: 'Looking for someone to swap 5% in the Main. Have results in large fields, happy to share references.',
    timestamp: '1h',
    likes: 8,
    comments: 4,
    saves: 1,
  },
  {
    id: 'pw-4',
    author: 'Courtney Gee',
    handle: '@courtneygee',
    portal: 'PLAYER',
    body: 'Anyone have experience playing on this site from Canada? Withdrawal speeds have been inconsistent.',
    timestamp: '2h',
    likes: 19,
    comments: 22,
    saves: 3,
  },
  {
    id: 'pw-5',
    author: 'Jamie Kerstetter',
    handle: '@jamiekerstetter',
    portal: 'PLAYER',
    body: 'Looking for a study group for Sunday majors. Already run one with 3 players, looking to add 2-3 more.',
    timestamp: '3h',
    likes: 27,
    comments: 15,
    saves: 8,
  },
];

// ===== PLAYER CLUB: TV WALL =====

export interface TVScreen {
  id: string;
  label: string;
  category: 'live' | 'tournament' | 'news' | 'creator' | 'results' | 'trending';
  title: string;
  subtitle: string;
  meta: string;
  accent: string;
}

export const TV_WALL_SCREENS: TVScreen[] = [
  { id: 'tv1', label: 'Screen 01', category: 'live', title: 'WSOP Main Event', subtitle: 'Day 4 · Bubble Approaching', meta: 'LIVE', accent: '#ef4444' },
  { id: 'tv2', label: 'Screen 02', category: 'tournament', title: 'Montreal Series', subtitle: 'Day 2 · 89 Remain', meta: 'TRACKER', accent: '#d4a52c' },
  { id: 'tv3', label: 'Screen 03', category: 'news', title: 'PokerOrg Daily', subtitle: 'Industry Headlines', meta: 'NEWS', accent: '#3b82f6' },
  { id: 'tv4', label: 'Screen 04', category: 'creator', title: 'Lex Veldhuis', subtitle: 'Streaming Now · 14.2K', meta: 'STREAM', accent: '#a855f7' },
  { id: 'tv5', label: 'Screen 05', category: 'results', title: 'Leaderboard', subtitle: '2027 POY Race', meta: 'RESULTS', accent: '#10b981' },
  { id: 'tv6', label: 'Screen 06', category: 'trending', title: 'Trending Now', subtitle: 'Most Discussed', meta: 'TRENDING', accent: '#f59e0b' },
];

// ===== PLAYER CLUB: PRIVATE ROOMS =====

export interface PrivateRoom {
  id: string;
  name: string;
  members: number;
  lastActivity: string;
  unread: number;
  category: string;
}

export const PLAYER_PRIVATE_ROOMS: PrivateRoom[] = [
  { id: 'r1', name: 'Sunday Major Study', members: 8, lastActivity: '12m ago', unread: 3, category: 'Study' },
  { id: 'r2', name: 'Vegas Summer Crew', members: 14, lastActivity: '45m ago', unread: 0, category: 'Travel' },
  { id: 'r3', name: 'High Stakes MTT', members: 6, lastActivity: '2h ago', unread: 1, category: 'Staking' },
  { id: 'r4', name: 'Winnipeg Players', members: 11, lastActivity: '3h ago', unread: 0, category: 'Regional' },
  { id: 'r5', name: 'Final Table Review', members: 5, lastActivity: '5h ago', unread: 0, category: 'Study' },
  { id: 'r6', name: 'Montreal Series Trip', members: 9, lastActivity: '1d ago', unread: 0, category: 'Travel' },
];

// ===== PLAYER CLUB: OPPORTUNITIES BOARD =====

export interface BoardItem {
  id: string;
  title: string;
  category: 'Staking' | 'Swaps' | 'Study' | 'Travel' | 'Roommates' | 'Sponsorship' | 'Creator Collab' | 'Coaching' | 'Jobs';
  author: string;
  detail: string;
  posted: string;
}

export const PLAYER_BOARD_ITEMS: BoardItem[] = [
  { id: 'b1', title: 'Staking for WSOP Main', category: 'Staking', author: 'MTT Stable', detail: 'Looking to back 2-3 proven MTT players. Mark-up must be reasonable.', posted: '1h' },
  { id: 'b2', title: 'Swap 5% Main Event', category: 'Swaps', author: 'Kevin R.', detail: 'Have results in large fields. Happy to share references and HH.', posted: '2h' },
  { id: 'b3', title: 'Sunday Major Study Group', category: 'Study', author: 'Jamie K.', detail: 'Already running with 3 players. Looking to add 2-3 more.', posted: '3h' },
  { id: 'b4', title: 'Montreal Housing — Share Airbnb', category: 'Roommates', author: 'Courtney G.', detail: 'Have a 2BR near the venue. Looking for 1 roommate to split costs.', posted: '5h' },
  { id: 'b5', title: 'Sponsorship Opportunity', category: 'Sponsorship', author: 'StreamForge', detail: 'Looking for 3 MTT players for a 6-month content partnership.', posted: '8h' },
  { id: 'b6', title: 'Creator Collab — YouTube', category: 'Creator Collab', author: 'Alex R.', detail: 'Looking for a player to feature in a poker strategy video series.', posted: '12h' },
  { id: 'b7', title: 'Coaching — ICM Spots', category: 'Coaching', author: 'Bencb789', detail: 'Available for 1-on-1 ICM final table coaching. DM for rates.', posted: '1d' },
  { id: 'b8', title: 'Poker Site — Community Manager', category: 'Jobs', author: 'GGPoker', detail: 'Full-time remote. Managing community engagement and player feedback.', posted: '1d' },
];

// ===== PLAYER CLUB: MEMBERS ROLODEX =====

export interface PlayerMember {
  id: string;
  name: string;
  handle: string;
  specialty: string;
  online: boolean;
  connected: boolean;
  following: boolean;
  category: 'MTT' | 'Cash' | 'High Stakes' | 'Creator' | 'Coach';
}

export const PLAYER_MEMBERS: PlayerMember[] = [
  { id: 'm1', name: 'Maria Ho', handle: '@mariaho', specialty: 'MTT · Commentator', online: true, connected: true, following: true, category: 'MTT' },
  { id: 'm2', name: 'Kevin Martin', handle: '@kevinmartin', specialty: 'MTT · Creator', online: true, connected: true, following: true, category: 'Creator' },
  { id: 'm3', name: 'Kevin Rabichow', handle: '@krabichow', specialty: 'High Stakes MTT', online: false, connected: true, following: false, category: 'High Stakes' },
  { id: 'm4', name: 'Jamie Kerstetter', handle: '@jamiekerstetter', specialty: 'MTT · Coach', online: true, connected: false, following: true, category: 'Coach' },
  { id: 'm5', name: 'Courtney Gee', handle: '@courtneygee', specialty: 'MTT · Cash', online: true, connected: false, following: false, category: 'MTT' },
  { id: 'm6', name: 'Spraggy', handle: '@spraggy', specialty: 'Online MTT', online: true, connected: false, following: false, category: 'MTT' },
  { id: 'm7', name: 'Bencb789', handle: '@bencb789', specialty: 'Coach · MTT', online: false, connected: false, following: true, category: 'Coach' },
  { id: 'm8', name: 'Lex Veldhuis', handle: '@lexveldhuis', specialty: 'High Stakes · Creator', online: true, connected: false, following: true, category: 'Creator' },
  { id: 'm9', name: 'Ryan DePaulo', handle: '@ryandepaulo', specialty: 'MTT · Creator', online: false, connected: true, following: false, category: 'Creator' },
  { id: 'm10', name: 'Darren Elias', handle: '@darrenelias', specialty: 'High Stakes Cash', online: false, connected: false, following: false, category: 'Cash' },
  { id: 'm11', name: 'Kristen Bicknell', handle: '@kbicknell', specialty: 'High Stakes MTT', online: true, connected: false, following: true, category: 'High Stakes' },
  { id: 'm12', name: 'Justin Bonomo', handle: '@justinbonomo', specialty: 'High Stakes', online: false, connected: false, following: false, category: 'High Stakes' },
];

// ===== PLAYER CLUB: STUDY ROOM =====

export interface StudyItem {
  id: string;
  label: string;
  icon: string;
  count: string;
}

export const STUDY_ROOM_ITEMS: StudyItem[] = [
  { id: 's1', label: 'My Spots', icon: 'Library', count: '47 items' },
  { id: 's2', label: 'Analytics', icon: 'BarChart', count: '12 charts' },
  { id: 's3', label: 'Hand Histories', icon: 'FileText', count: '2,341 hands' },
  { id: 's4', label: 'HH Replayer', icon: 'Play', count: 'Open' },
  { id: 's5', label: 'Study Materials', icon: 'BookOpen', count: '23 decks' },
  { id: 's6', label: 'Purchased Content', icon: 'ShoppingBag', count: '8 courses' },
];

// ===== PLAYER CLUB: MY VAULT =====

export interface VaultSection {
  id: string;
  label: string;
  icon: string;
  count: string;
}

export const MY_VAULT_SECTIONS: VaultSection[] = [
  { id: 'v1', label: 'My Spots', icon: 'Library', count: '47' },
  { id: 'v2', label: 'Analytics', icon: 'BarChart', count: '12' },
  { id: 'v3', label: 'Hand Histories', icon: 'FileText', count: '2,341' },
  { id: 'v4', label: 'Results', icon: 'Trophy', count: '89' },
  { id: 'v5', label: 'Saved Content', icon: 'Bookmark', count: '134' },
  { id: 'v6', label: 'Purchases', icon: 'ShoppingBag', count: '8' },
  { id: 'v7', label: 'Notes', icon: 'StickyNote', count: '23' },
  { id: 'v8', label: 'Connections', icon: 'Users', count: '17' },
];

// ===== PLAYER CLUB: CONCIERGE =====

export const CLUB_DESK_ACTIONS = [
  { id: 'd1', label: 'Find a Player', icon: 'Search' },
  { id: 'd2', label: 'Buzz Someone', icon: 'Bell' },
  { id: 'd3', label: 'Create Room', icon: 'DoorOpen' },
  { id: 'd4', label: 'Find a Coach', icon: 'GraduationCap' },
  { id: 'd5', label: 'Open Marketplace', icon: 'ShoppingBag' },
  { id: 'd6', label: 'View Events', icon: 'Calendar' },
  { id: 'd7', label: 'View Jobs', icon: 'Briefcase' },
  { id: 'd8', label: 'Contact Support', icon: 'LifeBuoy' },
];

export const BUSINESS_WIRE_SEED: WirePost[] = [
  {
    id: 'bw-1',
    author: 'GGPoker',
    handle: '@ggpoker',
    portal: 'BUSINESS',
    body: 'Looking for affiliate partners for Q4. Competitive rev-share, dedicated account management. DM for details.',
    timestamp: '20m',
    likes: 12,
    comments: 5,
    saves: 9,
  },
  {
    id: 'bw-2',
    author: 'PokerOrg',
    handle: '@pokerorg',
    portal: 'BUSINESS',
    body: 'Seeking commentators for upcoming event series. Must have live broadcast experience. Remote OK.',
    timestamp: '1h',
    likes: 8,
    comments: 3,
    saves: 4,
  },
  {
    id: 'bw-3',
    author: 'StreamForge',
    handle: '@streamforge',
    portal: 'BUSINESS',
    body: 'New API partnership opportunity for poker data providers. Looking to integrate tournament results feeds.',
    timestamp: '3h',
    likes: 5,
    comments: 2,
    saves: 11,
  },
  {
    id: 'bw-4',
    author: 'PokerStars',
    handle: '@pokerstars',
    portal: 'BUSINESS',
    body: 'Looking for a creator campaign partner for our next series. Focus on MTT content, 6-8 week engagement.',
    timestamp: '5h',
    likes: 14,
    comments: 6,
    saves: 7,
  },
];

// ===== BUSINESS DESK DATA =====

export interface RolodexContact {
  id: string;
  name: string;
  role: string;
  org: string;
  homePortal: string;
  online: boolean;
  connected: boolean;
  relationship: 'connected' | 'pending' | 'none';
  accessType: 'message' | 'connect' | 'request' | 'book' | 'request-access';
  accessLabel: string;
}

export const ROLODEX_CONTACTS: RolodexContact[] = [
  { id: 'c1', name: 'Kevin Martin', role: 'Player / Creator', org: 'Independent', homePortal: 'Player Portal', online: true, connected: true, relationship: 'connected', accessType: 'message', accessLabel: 'Message' },
  { id: 'c2', name: 'Jeff Platt', role: 'Media Executive', org: 'PokerOrg', homePortal: 'Media Portal', online: true, connected: true, relationship: 'connected', accessType: 'message', accessLabel: 'Message' },
  { id: 'c3', name: 'Maria Ho', role: 'Player / Commentator', org: 'Independent', homePortal: 'Player Portal', online: false, connected: true, relationship: 'connected', accessType: 'message', accessLabel: 'Message' },
  { id: 'c4', name: 'Randy Kasper', role: 'Player', org: 'Independent', homePortal: 'Player Portal', online: true, connected: false, relationship: 'none', accessType: 'connect', accessLabel: 'Connect' },
  { id: 'c5', name: 'Bencb789', role: 'Coach', org: 'Raise Your Edge', homePortal: 'Coach Portal', online: true, connected: false, relationship: 'none', accessType: 'book', accessLabel: 'Book Time' },
  { id: 'c6', name: 'Lex Veldhuis', role: 'Creator / Streamer', org: 'Independent', homePortal: 'Creator Portal', online: false, connected: false, relationship: 'none', accessType: 'request-access', accessLabel: 'Request Access' },
  { id: 'c7', name: 'GGPoker', role: 'Organization', org: 'GGPoker', homePortal: 'Business Portal', online: true, connected: true, relationship: 'connected', accessType: 'message', accessLabel: 'Message' },
  { id: 'c8', name: 'MTT Stable', role: 'Staking Org', org: 'MTT Stable', homePortal: 'Stable Portal', online: true, connected: false, relationship: 'pending', accessType: 'request', accessLabel: 'Request Chat' },
];

export interface DeskNote {
  id: string;
  title: string;
  body: string;
  date: string;
}

export const DESK_NOTES_SEED: DeskNote[] = [
  { id: 'n1', title: 'Randy Kasper', body: 'Met Aug 10. Interested in infrastructure strategy. Follow up next week.', date: 'Aug 10' },
  { id: 'n2', title: 'Kevin Martin', body: 'Potential creator partnership. Send proposal.', date: 'Aug 8' },
  { id: 'n3', title: 'GGPoker Q4', body: 'Affiliate terms under review. Need to compare rev-share vs competitors.', date: 'Aug 5' },
];

export interface DeskMeeting {
  id: string;
  time: string;
  person: string;
  topic: string;
  when: 'today' | 'this-week' | 'requested';
}

export const DESK_MEETINGS: DeskMeeting[] = [
  { id: 'm1', time: '11:00 AM', person: 'Kevin Martin', topic: 'Creator Partnership', when: 'today' },
  { id: 'm2', time: '2:30 PM', person: 'Investor Room', topic: 'Pitch Review', when: 'today' },
  { id: 'm3', time: 'Thu 3:00 PM', person: 'GGPoker', topic: 'Affiliate Terms', when: 'this-week' },
  { id: 'm4', time: 'Fri 10:00 AM', person: 'MTT Stable', topic: 'Sponsorship Discussion', when: 'this-week' },
  { id: 'm5', time: 'Pending', person: 'Bencb789', topic: 'Coaching Collaboration', when: 'requested' },
];

export const PORTAL_FEED_LABELS: Record<string, { name: string; subtitle: string }> = {
  PLAYER: { name: 'Player Wire', subtitle: 'Players only' },
  BUSINESS: { name: 'Business Wire', subtitle: 'Industry operators only' },
  MEDIA: { name: 'Newsroom Wire', subtitle: 'Media professionals only' },
  CREATOR: { name: 'Creator Wire', subtitle: 'Creators only' },
  COACH: { name: 'Coach Network', subtitle: 'Coaches only' },
  STABLE: { name: 'Stable Network', subtitle: 'Stable operators only' },
  INVESTOR: { name: 'Investor Network', subtitle: 'Investors only' },
  JOBS: { name: 'Industry Opportunities', subtitle: 'Industry hiring only' },
  PARTNERSHIPS: { name: 'Partner Network', subtitle: 'Partners only' },
  AFFILIATE_PARTNER: { name: 'Partner Network', subtitle: 'Partners only' },
};

// ===== ACCOUNT ACCESS CONTROL MODEL =====

export type PortalAccessType =
  | 'open'
  | 'verification'
  | 'approval'
  | 'paid'
  | 'invite';

export type AccountStatus = 'active' | 'pending' | 'denied';

export type PortalGrantLevel = 'permanent' | 'guest' | 'none';

export type AccountRole = 'member' | 'superuser' | 'staff' | 'moderator' | 'universal_access' | 'developer_admin';

export interface PortalGrant {
  portal: HubId;
  level: PortalGrantLevel;
  label: string;
  isHome: boolean;
  accessType: PortalAccessType;
  accessTypeLabel: string;
  status: AccountStatus;
  hoursRemaining?: number;
}

export interface SpotVaultAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  homePortal: HubId;
  status: AccountStatus;
  role: AccountRole;
  grants: PortalGrant[];
  primaryRole?: string;
  solverAccess?: boolean;
  analyticsAccess?: boolean;
  passwordMigrated?: boolean;
  partnerAffiliation?: string;
  acquisitionSource?: string;
  partnerHubAccess?: Record<string, boolean>;
  isAuthUser?: boolean;
  defaultLoungeSlug?: string | null;
}

export function hasSolverAccess(account: SpotVaultAccount | null | undefined): boolean {
  if (!account) return false;
  if (account.solverAccess !== undefined) return account.solverAccess;
  return account.homePortal === 'PLAYER' || account.homePortal === 'COACH';
}

export function hasAnalyticsAccess(account: SpotVaultAccount | null | undefined): boolean {
  if (!account) return false;
  if (account.analyticsAccess !== undefined) return account.analyticsAccess;
  return account.homePortal === 'PLAYER' || account.homePortal === 'COACH';
}

export interface PortalDefinition {
  id: HubId;
  label: string;
  icon: string;
  forText: string;
  accessType: PortalAccessType;
  accessLabel: string;
}

export const PORTAL_DEFINITIONS: PortalDefinition[] = [
  { id: 'PLAYER', label: 'Player', icon: 'User', forText: 'Professional and active poker players', accessType: 'verification', accessLabel: 'Verification may be required' },
  { id: 'STAFF', label: 'Staff', icon: 'ShieldCheck', forText: 'SpotVault platform staff and administrators', accessType: 'invite', accessLabel: 'Staff authorization required' },
  { id: 'CREATOR', label: 'Creator / Pro', icon: 'Camera', forText: 'Creators, streamers, influencers, content producers', accessType: 'verification', accessLabel: 'Verification may be required' },
  { id: 'BUSINESS', label: 'Business', icon: 'Building2', forText: 'Poker companies, operators, investors, affiliates and industry professionals', accessType: 'approval', accessLabel: 'Business verification required' },
  { id: 'COACH', label: 'Coach', icon: 'GraduationCap', forText: 'Poker coaches and educators', accessType: 'paid', accessLabel: 'Verification / subscription may apply' },
  { id: 'STABLE', label: 'Stable', icon: 'Trophy', forText: 'Poker staking stables and player management', accessType: 'paid', accessLabel: 'Verification / subscription may apply' },
  { id: 'MEDIA', label: 'Media', icon: 'Radio', forText: 'Poker media professionals, journalists, broadcasters and content curators', accessType: 'verification', accessLabel: 'Verification may be required' },
  { id: 'STAKEKINGS_PLAYER', label: 'StakeKings Player Development', icon: 'Crown', forText: 'StakeKings Player Development environment', accessType: 'invite', accessLabel: 'StakeKings authorization required' },
  { id: 'STAKEKINGS_ADMIN', label: 'StakeKings Admin', icon: 'ShieldCheck', forText: 'StakeKings administrative environment', accessType: 'invite', accessLabel: 'StakeKings admin authorization required' },
];

export const ALL_PORTAL_IDS: HubId[] = [
  'PLAYER', 'COACH', 'STABLE', 'CREATOR', 'BUSINESS', 'MEDIA', 'STAFF',
  'STAKEKINGS_PLAYER', 'STAKEKINGS_ADMIN',
];

const LEGACY_PORTAL_DEFINITIONS: Record<string, Pick<PortalDefinition, 'label' | 'accessType'>> = {
  JOBS: { label: 'Jobs / Industry', accessType: 'open' },
  PRO: { label: 'Creator / Talent', accessType: 'approval' },
  INVESTOR: { label: 'Business', accessType: 'approval' },
  STABLE: { label: 'Stable', accessType: 'paid' },
  AFFILIATE_PARTNER: { label: 'Business', accessType: 'approval' },
  PARTNERSHIPS: { label: 'Business', accessType: 'approval' },
};

const ACCESS_TYPE_LABELS: Record<PortalAccessType, string> = {
  open: 'Standard',
  verification: 'Verification may be required',
  approval: 'Approval required',
  paid: 'Verification / subscription may apply',
  invite: 'Invite only',
};

export function buildGrants(
  homePortal: HubId,
  additionalPermanent: HubId[] = [],
  guestPortals: { portal: HubId; hours: number }[] = [],
): PortalGrant[] {
  return ALL_PORTAL_IDS.map((portal) => {
    const def = PORTAL_DEFINITIONS.find((p) => p.id === portal) ?? LEGACY_PORTAL_DEFINITIONS[portal]!;
    const isHome = portal === homePortal;
    const isAdditional = additionalPermanent.includes(portal);
    const guest = guestPortals.find((g) => g.portal === portal);

    if (isHome) {
      return {
        portal,
        level: 'permanent' as PortalGrantLevel,
        label: def.label,
        isHome: true,
        accessType: def.accessType,
        accessTypeLabel: ACCESS_TYPE_LABELS[def.accessType],
        status: 'active' as AccountStatus,
      };
    }
    if (isAdditional) {
      return {
        portal,
        level: 'permanent' as PortalGrantLevel,
        label: def.label,
        isHome: false,
        accessType: def.accessType,
        accessTypeLabel: ACCESS_TYPE_LABELS[def.accessType],
        status: 'active' as AccountStatus,
      };
    }
    if (guest) {
      return {
        portal,
        level: 'guest' as PortalGrantLevel,
        label: def.label,
        isHome: false,
        accessType: 'invite' as PortalAccessType,
        accessTypeLabel: 'Guest access',
        status: 'active' as AccountStatus,
        hoursRemaining: guest.hours,
      };
    }
    return {
      portal,
      level: 'none' as PortalGrantLevel,
      label: def.label,
      isHome: false,
      accessType: def.accessType,
      accessTypeLabel: ACCESS_TYPE_LABELS[def.accessType],
      status: 'active' as AccountStatus,
    };
  });
}

// ===== DEMO ACCOUNTS =====

const ACCOUNTS_STORAGE_KEY = 'spotvault-registered-accounts';

function loadRegisteredAccounts(): SpotVaultAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SpotVaultAccount[];
  } catch {
    return [];
  }
}

function saveRegisteredAccounts(accounts: SpotVaultAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage failures
  }
}

const BUILTIN_ACCOUNTS: SpotVaultAccount[] = [
  {
    id: 'acc-randy',
    name: 'Randy Kasper',
    username: 'RandyKasper',
    email: 'randy@spotvault.com',
    homePortal: 'BUSINESS',
    status: 'active',
    role: 'member',
    grants: buildGrants('BUSINESS'),
  },
  {
    id: 'acc-jordan',
    name: 'Jordan McAllister',
    username: 'jordanmcallister12',
    email: 'jordan@spotvault.com',
    homePortal: 'PLAYER',
    status: 'active',
    role: 'superuser',
    grants: buildGrants('PLAYER'),
    isAuthUser: true,
  },
  {
    id: 'acc-kevin',
    name: 'Kevin Martin',
    username: 'KevinMartin',
    email: 'kevin@spotvault.com',
    homePortal: 'PLAYER',
    status: 'active',
    role: 'member',
    grants: buildGrants('PLAYER', ['CREATOR']),
  },
  {
    id: 'acc-biz',
    name: 'Alex Rivera',
    username: 'AlexRivera',
    email: 'alex@spotvault.com',
    homePortal: 'BUSINESS',
    status: 'active',
    role: 'member',
    grants: buildGrants('BUSINESS'),
  },
  {
    id: 'acc-media',
    name: 'Sarah Chen',
    username: 'SarahChen',
    email: 'sarah@spotvault.com',
    homePortal: 'CREATOR',
    status: 'active',
    role: 'member',
    grants: buildGrants('CREATOR'),
  },
  {
    id: 'acc-test',
    name: 'Test Account',
    username: 'testaccount',
    email: 'testaccount@spotvault.com',
    homePortal: 'PLAYER',
    status: 'active',
    role: 'member',
    grants: buildGrants('PLAYER'),
    partnerHubAccess: { stakekings_hub_access: true },
    isAuthUser: true,
  },
  {
    id: 'acc-tyler',
    name: 'StakeKings Tyler',
    username: 'StakeKingsTyler',
    email: 'stakekingstyler@spotvault.com',
    homePortal: 'PLAYER',
    status: 'active',
    role: 'staff',
    grants: buildGrants('PLAYER', ['COACH', 'STABLE', 'BUSINESS', 'CREATOR', 'MEDIA', 'STAFF']),
    partnerHubAccess: { stakekings_hub_access: true, stakekings_admin_access: true },
    isAuthUser: true,
  },
];

let registeredAccounts: SpotVaultAccount[] = loadRegisteredAccounts();

export const DEMO_ACCOUNTS: SpotVaultAccount[] = [...BUILTIN_ACCOUNTS, ...registeredAccounts];

export function addRegisteredAccount(account: SpotVaultAccount): void {
  registeredAccounts = [...registeredAccounts, account];
  saveRegisteredAccounts(registeredAccounts);
  DEMO_ACCOUNTS.push(account);
}

// ===== PASSWORD CREDENTIAL STORE =====
// Single source of truth for account passwords. Keyed by account id.
// Passwords are at least 10 characters. Do not display or log these values.

const DEFAULT_ACCOUNT_PINS: Record<string, string> = {
  'acc-randy': '123456',
  'acc-jordan': '123456',
  'acc-kevin': '5819',
  'acc-biz': '7361',
  'acc-media': '2048',
  'acc-tyler': '123456',
  'acc-test': 'Testaccount1!',
};

const PIN_STORAGE_KEY = 'spotvault-account-pins';

function loadStoredPins(): Record<string, string> {
  if (typeof window === 'undefined') return { ...DEFAULT_ACCOUNT_PINS };
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACCOUNT_PINS };
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...DEFAULT_ACCOUNT_PINS, ...parsed };
  } catch {
    return { ...DEFAULT_ACCOUNT_PINS };
  }
}

let accountPins: Record<string, string> = loadStoredPins();

export function getAccountPin(accountId: string): string {
  return accountPins[accountId] ?? '';
}

export function setAccountPin(accountId: string, pin: string): void {
  accountPins = { ...accountPins, [accountId]: pin };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(accountPins));
    } catch {
      // ignore storage failures
    }
  }
}

export function isValidPinFormat(pin: string): boolean {
  return /^[0-9]{4,8}$/.test(pin);
}

export function isValidPasswordFormat(password: string): boolean {
  return password.length >= 10;
}

export function isLegacyPinCredential(credential: string): boolean {
  return /^[0-9]{4,8}$/.test(credential);
}

// ===== SECURITY UPGRADE PERSISTENCE =====
// Tracks whether a user has completed the password migration and/or 2FA setup.
// Persisted to localStorage so it survives logout, refresh, and browser restart.
// Works for BOTH builtin and registered accounts (keyed by account id).

const MIGRATION_KEY = 'spotvault-security-upgrade';

interface MigrationRecord {
  passwordMigrated: boolean;
  migration2faCompleted: boolean;
}

function loadMigrationRecords(): Record<string, MigrationRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MIGRATION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, MigrationRecord>;
  } catch {
    return {};
  }
}

function saveMigrationRecords(records: Record<string, MigrationRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify(records));
  } catch {
    // ignore storage failures
  }
}

export function isPasswordMigrated(accountId: string): boolean {
  const records = loadMigrationRecords();
  return records[accountId]?.passwordMigrated ?? false;
}

export function isMigration2faCompleted(accountId: string): boolean {
  const records = loadMigrationRecords();
  return records[accountId]?.migration2faCompleted ?? false;
}

export function markPasswordMigrated(accountId: string): void {
  const records = loadMigrationRecords();
  records[accountId] = {
    passwordMigrated: true,
    migration2faCompleted: records[accountId]?.migration2faCompleted ?? false,
  };
  saveMigrationRecords(records);
}

export function markMigration2faCompleted(accountId: string): void {
  const records = loadMigrationRecords();
  records[accountId] = {
    passwordMigrated: records[accountId]?.passwordMigrated ?? true,
    migration2faCompleted: true,
  };
  saveMigrationRecords(records);
}

export function verifyPin(accountId: string, enteredPin: string): boolean {
  const stored = getAccountPin(accountId);
  if (!stored || !enteredPin) return false;
  return stored === enteredPin;
}

export function verifyPassword(accountId: string, enteredPassword: string): boolean {
  const stored = getAccountPin(accountId);
  if (!stored || !enteredPassword) return false;
  return stored === enteredPassword;
}

export function findAccountByUsername(username: string): SpotVaultAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.username.toLowerCase() === username.toLowerCase());
}

export function findAccountByEmail(email: string): SpotVaultAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase());
}

export function isSuperUser(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && account.role === 'superuser';
}

export function isStaffOrAdmin(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && (account.role === 'superuser' || account.role === 'staff' || account.role === 'moderator' || account.role === 'developer_admin');
}

/**
 * Founder-level access: only the authorized Founder/Superuser account.
 * This gates the portal selector and other founder-only controls.
 * Staff, moderators, and all other roles are excluded.
 */
export function isFounderUser(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && (account.role === 'superuser' || account.role === 'developer_admin');
}

/**
 * Universal access bypasses all product-tier, subscription, and feature gates.
 * Superuser always has universal access. Accounts with the 'universal_access'
 * role also get it. This is the canonical frontend check — use this instead
 * of hardcoding emails.
 */
export function hasUniversalAccess(account: SpotVaultAccount | null | undefined): boolean {
  return !!account && (account.role === 'superuser' || account.role === 'universal_access');
}

// Launch: Coach Portal is Coming Soon (preserving existing authorized access).
// Partner portals (StakeKings etc.) are independently configurable.
export const COMING_SOON_PORTALS: HubId[] = ['COACH', 'STABLE', 'CREATOR', 'BUSINESS', 'MEDIA'];

export function getPortalStatus(portal: HubId): 'live' | 'coming_soon' {
  return COMING_SOON_PORTALS.includes(portal) ? 'coming_soon' : 'live';
}

export function canAccessPortal(account: SpotVaultAccount, portal: HubId): boolean {
  if (account.role === 'superuser' || account.role === 'universal_access' || account.role === 'developer_admin') return true;
  if (portal === 'STAFF') return account.role === 'staff' || account.role === 'developer_admin';
  // Staff can access all portals (same navigation surface as superuser)
  if (account.role === 'staff' || account.role === 'developer_admin') return true;
  // Private partner portals — require explicit partnerHubAccess flags
  if (portal === 'STAKEKINGS_PLAYER') {
    return account.partnerHubAccess?.['stakekings_hub_access'] === true;
  }
  if (portal === 'STAKEKINGS_ADMIN') {
    return account.partnerHubAccess?.['stakekings_admin_access'] === true;
  }
  // Launch: Coming Soon portals are not publicly accessible, but users with
  // an existing permanent or guest grant keep their access.
  if (getPortalStatus(portal) === 'coming_soon') {
    const existingGrant = account.grants.find((g) => g.portal === portal || (portal === 'CREATOR' && g.portal === 'PRO'));
    return existingGrant?.level === 'permanent' || existingGrant?.level === 'guest';
  }
  const grant = account.grants.find((g) => g.portal === portal || (portal === 'CREATOR' && g.portal === 'PRO'));
  if (!grant) return false;
  return grant.level === 'permanent' || grant.level === 'guest';
}

export function getGrant(account: SpotVaultAccount, portal: HubId): PortalGrant | undefined {
  if (account.role === 'superuser' || account.role === 'staff' || account.role === 'developer_admin' || account.role === 'universal_access') {
    const def = PORTAL_DEFINITIONS.find((p) => p.id === portal);
    return {
      portal,
      level: 'permanent',
      label: def?.label ?? '',
      isHome: portal === account.homePortal,
      accessType: def?.accessType ?? 'open',
      accessTypeLabel: account.role === 'superuser' ? 'Superuser' : account.role === 'universal_access' ? 'Universal Access' : 'Staff',
      status: 'active',
    };
  }
  return account.grants.find((g) => g.portal === portal || (portal === 'CREATOR' && g.portal === 'PRO'));
}
