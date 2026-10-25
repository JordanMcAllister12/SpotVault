// ===== PLAYER NETWORK — STAKES + FORMAT COMMUNITIES =====
// Replaces the old floor/tier access system. The Player Network is ONE
// destination. Users pick a stakes community + poker format, and content
// updates accordingly. No access gating, no floors, no progression.

export const PLAYER_NETWORK_BACKGROUND = '/image copy copy copy copy.webp';

export type StakesLevel = 'micro' | 'low' | 'medium' | 'high';
export type PokerFormat = 'cash' | 'mtt' | 'live';

export interface StakesCommunity {
  id: StakesLevel;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  accentColor: string;
  usersOnline: number;
}

export const STAKES_COMMUNITIES: StakesCommunity[] = [
  {
    id: 'micro',
    name: 'Micro Stakes',
    shortName: 'Micro',
    tagline: 'Building the foundation',
    description: 'For players grinding the smallest stakes. Learning fundamentals, studying preflop charts, and building a bankroll from the ground up.',
    accentColor: '#e8a040',
    usersOnline: 847,
  },
  {
    id: 'low',
    name: 'Low Stakes',
    shortName: 'Low',
    tagline: 'Finding your edge',
    description: 'For players who have moved past the micros and are developing postflop skills, studying population tendencies, and taking the game seriously.',
    accentColor: '#d4a52c',
    usersOnline: 412,
  },
  {
    id: 'medium',
    name: 'Medium Stakes',
    shortName: 'Medium',
    tagline: 'Established grinders',
    description: 'For established players competing at meaningful stakes. Refined strategies, GTO study, and consistent volume.',
    accentColor: '#c9a44c',
    usersOnline: 186,
  },
  {
    id: 'high',
    name: 'High Stakes',
    shortName: 'High',
    tagline: 'The biggest games',
    description: 'For players competing at the highest levels. High-roller tournaments, deep cash games, and elite-level analysis.',
    accentColor: '#f0d070',
    usersOnline: 54,
  },
];

export const POKER_FORMATS: { id: PokerFormat; name: string; shortName: string }[] = [
  { id: 'cash', name: 'Cash Games', shortName: 'Cash' },
  { id: 'mtt', name: 'MTTs', shortName: 'MTT' },
  { id: 'live', name: 'Live Poker', shortName: 'Live' },
];

export function getStakesCommunity(id: StakesLevel): StakesCommunity {
  return STAKES_COMMUNITIES.find((s) => s.id === id)!;
}

// ===== DEMO CONTENT PER STAKES + FORMAT =====

export interface NetworkPost {
  id: string;
  author: string;
  handle: string;
  body: string;
  timestamp: string;
  likes: number;
  comments: number;
  saves: number;
}

export interface NetworkContact {
  name: string;
  handle: string;
  initials: string;
  online: boolean;
  status: string;
  lastActive: string;
}

export interface NetworkDm {
  contactName: string;
  initials: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

export interface NetworkMember {
  name: string;
  initials: string;
  status: string;
}

export interface NetworkOffer {
  id: string;
  title: string;
  provider: string;
  type: string;
  price: string;
}

// Generate content key from stakes + format
function contentKey(stakes: StakesLevel, format: PokerFormat): string {
  return `${stakes}-${format}`;
}

// ===== DEMO POSTS =====
const POSTS: Record<string, NetworkPost[]> = {
  'micro-cash': [
    { id: 'mc1', author: 'NewToVegas', handle: '@newtovegas', body: 'Just started playing 1c/2c online. Anyone else building from the bottom? Studying preflop charts has been a game changer.', timestamp: '4m', likes: 12, comments: 5, saves: 1 },
    { id: 'mc2', author: 'RecreationalGrind', handle: '@recgrind', body: 'Finally beat 2nl for a real sample. Moving to 5nl next week. Any advice on the jump?', timestamp: '18m', likes: 24, comments: 8, saves: 2 },
    { id: 'mc3', author: 'WeekendWarrior', handle: '@weekendwar', body: 'Looking for a study group for micro cash. Already watching videos but need people to discuss hands with.', timestamp: '42m', likes: 8, comments: 14, saves: 0 },
  ],
  'micro-mtt': [
    { id: 'mm1', author: 'NewToVegas', handle: '@newtovegas', body: 'Played my first $1 MTT on ACR. Bubbled but had fun. Anyone have good low-stakes MTT study material?', timestamp: '6m', likes: 15, comments: 7, saves: 3 },
    { id: 'mm2', author: 'MicroGrinder', handle: '@microgrind', body: 'The $2 180-man SNGs on PokerStars are great practice for push/fold. Anyone play these regularly?', timestamp: '22m', likes: 19, comments: 6, saves: 1 },
    { id: 'mm3', author: 'BankrollBuilder', handle: '@brbuilder', body: 'Looking for a micro MTT backing deal or swap group. Have 200 games logged at 20% ROI.', timestamp: '1h', likes: 11, comments: 9, saves: 4 },
  ],
  'micro-live': [
    { id: 'ml1', author: 'FirstTimer', handle: '@firsttimer', body: 'Going to my first live $1/$2 game this weekend. Any tips for not looking like a total newbie?', timestamp: '12m', likes: 31, comments: 18, saves: 7 },
    { id: 'ml2', author: 'WeekendWarrior', handle: '@weekendwar', body: 'Local casino runs a $60 nightly tournament. Great way to learn live tells and pace. Anyone play these?', timestamp: '38m', likes: 14, comments: 5, saves: 1 },
  ],
  'low-cash': [
    { id: 'lc1', author: 'Maria Ho', handle: '@mariaho', body: 'Moving from 25nl to 50nl this month. The reg ratio is definitely shifting. Anyone have notes on the player pool?', timestamp: '8m', likes: 47, comments: 12, saves: 8 },
    { id: 'lc2', author: 'Spraggy', handle: '@spraggy', body: 'These 50nl games on ACR are softer than people think. Just need to table select properly. Hand histories going up on SpotVault.', timestamp: '32m', likes: 31, comments: 15, saves: 5 },
    { id: 'lc3', author: 'Jamie Kerstetter', handle: '@jamiekerstetter', body: 'Looking for a study group for low-stakes cash. Already running one with 3 players, looking to add 2-3 more.', timestamp: '1h', likes: 27, comments: 11, saves: 8 },
  ],
  'low-mtt': [
    { id: 'lm1', author: 'Maria Ho', handle: '@mariaho', body: 'Just finished a deep run in the $11. Final table bubble hurts but the play was solid. Hand histories going up on SpotVault tonight.', timestamp: '8m', likes: 47, comments: 12, saves: 8 },
    { id: 'lm2', author: 'Spraggy', handle: '@spraggy', body: 'These $11 structures need longer levels. 20-minute levels in a $1K is just a turbo with extra steps.', timestamp: '32m', likes: 31, comments: 15, saves: 5 },
    { id: 'lm3', author: 'Jamie Kerstetter', handle: '@jamiekerstetter', body: 'Looking for a study group for Sunday majors. Already running one with 3 players, looking to add 2-3 more.', timestamp: '1h', likes: 27, comments: 11, saves: 8 },
  ],
  'low-live': [
    { id: 'll1', author: 'LiveGrinder', handle: '@livegrinder', body: 'Been grinding $1/$3 at the local room. The games are amazing but the rake is brutal. Anyone have a good win rate at 1/3?', timestamp: '15m', likes: 22, comments: 9, saves: 2 },
    { id: 'll2', author: 'CasinoReg', handle: '@casinoreg', body: 'Local casino just added a $250 nightly with a great structure. Perfect for building live MTT skills.', timestamp: '45m', likes: 18, comments: 7, saves: 3 },
  ],
  'medium-cash': [
    { id: 'mc1m', author: 'Kevin Rabichow', handle: '@krabichow', body: '5/10 games on ACR are getting tougher but still very beatable if you study population tendencies. Uploading my database analysis to SpotVault.', timestamp: '15m', likes: 18, comments: 7, saves: 3 },
    { id: 'mc2m', author: 'Courtney Gee', handle: '@courtneygee', body: 'Anyone have experience with the new site cashout system at 5/10? Withdrawal speeds have been inconsistent for me.', timestamp: '45m', likes: 22, comments: 18, saves: 2 },
    { id: 'mc3m', author: 'Kristen Bicknell', handle: '@kbicknell', body: 'Booked a nice win in the 5/10 yesterday. Hand histories and session analysis uploaded to SpotVault for verification.', timestamp: '2h', likes: 56, comments: 14, saves: 12 },
  ],
  'medium-mtt': [
    { id: 'mm1m', author: 'Kevin Rabichow', handle: '@krabichow', body: 'Looking for someone to swap 5% in the Main. Have results in large fields, happy to share references and HH.', timestamp: '15m', likes: 18, comments: 7, saves: 3 },
    { id: 'mm2m', author: 'Courtney Gee', handle: '@courtneygee', body: 'Anyone have experience with the new site cashout system? Withdrawal speeds have been inconsistent for me.', timestamp: '45m', likes: 22, comments: 18, saves: 2 },
    { id: 'mm3m', author: 'Kristen Bicknell', handle: '@kbicknell', body: 'Booked a nice win in the $5K yesterday. Hand histories and tournament summary uploaded to SpotVault for verification.', timestamp: '2h', likes: 56, comments: 14, saves: 12 },
  ],
  'medium-live': [
    { id: 'ml1m', author: 'LivePro', handle: '@livepro', body: 'The 5/10 live games at the Bellagio are incredible. So much dead money. Anyone want to swap notes on the player pool?', timestamp: '20m', likes: 34, comments: 11, saves: 5 },
    { id: 'ml2m', author: 'VegasRegular', handle: '@vegasreg', body: 'WSOP Circuit events are great value at this level. $1K buy-ins with huge fields and soft locals.', timestamp: '1h', likes: 28, comments: 8, saves: 4 },
  ],
  'high-cash': [
    { id: 'hc1', author: 'Darren Elias', handle: '@darrenelias', body: '25/50 games on ACR are running more often lately. Anyone interested in discussing high-stakes cash strategy?', timestamp: '22m', likes: 34, comments: 9, saves: 7 },
    { id: 'hc2', author: 'Justin Bonomo', handle: '@justinbonomo', body: 'Just finished reviewing some massive pots from the last 25/50 session. GTO analysis is up on my SpotVault.', timestamp: '1h', likes: 48, comments: 12, saves: 15 },
  ],
  'high-mtt': [
    { id: 'hm1', author: 'Darren Elias', handle: '@darrenelias', body: 'High roller schedule is looking good for the next series. Anyone interested in swapping pieces in the $25K?', timestamp: '22m', likes: 34, comments: 9, saves: 7 },
    { id: 'hm2', author: 'Justin Bonomo', handle: '@justinbonomo', body: 'Just finished reviewing some massive pots from the last session. GTO analysis is up on my SpotVault if anyone wants to discuss.', timestamp: '1h', likes: 48, comments: 12, saves: 15 },
  ],
  'high-live': [
    { id: 'hl1', author: 'Phil Ivey', handle: '@philivey', body: 'The Bobby\'s Room games have been incredible lately. Welcome to anyone who has made it this far. Let us play.', timestamp: '1h', likes: 89, comments: 23, saves: 31 },
    { id: 'hl2', author: 'HighRollerLife', handle: '@hrlife', body: 'Triton series is coming up. Anyone planning to play the $100K? Looking to swap action and study together.', timestamp: '2h', likes: 42, comments: 11, saves: 8 },
  ],
};

export function getNetworkPosts(stakes: StakesLevel, format: PokerFormat): NetworkPost[] {
  return POSTS[contentKey(stakes, format)] ?? POSTS['micro-cash'];
}

// ===== DEMO CONTACTS =====
const CONTACTS: Record<string, NetworkContact[]> = {
  'micro-cash': [
    { name: 'Mike T.', handle: '@miket', initials: 'MT', online: true, status: 'In a 1c/2c session', lastActive: 'now' },
    { name: 'Sarah L.', handle: '@sarahL', initials: 'SL', online: true, status: 'Studying preflop', lastActive: 'now' },
    { name: 'BigRay', handle: '@bigray', initials: 'BR', online: false, status: 'Offline', lastActive: '2h' },
  ],
  'low-cash': [
    { name: 'Maria Ho', handle: '@mariaho', initials: 'MH', online: true, status: 'Playing 50nl', lastActive: 'now' },
    { name: 'Jamie K.', handle: '@jamiekerstetter', initials: 'JK', online: true, status: 'Reviewing hands', lastActive: 'now' },
    { name: 'Spraggy', handle: '@spraggy', initials: 'SP', online: false, status: 'Offline', lastActive: '30m' },
    { name: 'Ryan D.', handle: '@ryandepaulo', initials: 'RD', online: true, status: 'Streaming', lastActive: 'now' },
  ],
  'medium-cash': [
    { name: 'Kevin R.', handle: '@krabichow', initials: 'KR', online: true, status: 'Deep in 5/10 session', lastActive: 'now' },
    { name: 'Courtney G.', handle: '@courtneygee', initials: 'CG', online: false, status: 'Offline', lastActive: '1h' },
    { name: 'Kristen B.', handle: '@kbicknell', initials: 'KB', online: true, status: 'Available', lastActive: 'now' },
  ],
  'high-cash': [
    { name: 'Darren E.', handle: '@darrenelias', initials: 'DE', online: true, status: 'In 25/50', lastActive: 'now' },
    { name: 'Justin B.', handle: '@justinbonomo', initials: 'JB', online: false, status: 'Offline', lastActive: '4h' },
  ],
  'micro-mtt': [
    { name: 'NewToVegas', handle: '@newtovegas', initials: 'NV', online: true, status: 'Playing $1 MTT', lastActive: 'now' },
    { name: 'MicroGrinder', handle: '@microgrind', initials: 'MG', online: true, status: 'Studying push/fold', lastActive: 'now' },
    { name: 'BankrollBuilder', handle: '@brbuilder', initials: 'BB', online: false, status: 'Offline', lastActive: '1h' },
  ],
  'low-mtt': [
    { name: 'Maria Ho', handle: '@mariaho', initials: 'MH', online: true, status: 'Playing $11 MTT', lastActive: 'now' },
    { name: 'Jamie K.', handle: '@jamiekerstetter', initials: 'JK', online: true, status: 'Reviewing hands', lastActive: 'now' },
    { name: 'Spraggy', handle: '@spraggy', initials: 'SP', online: false, status: 'Offline', lastActive: '30m' },
  ],
  'medium-mtt': [
    { name: 'Kevin R.', handle: '@krabichow', initials: 'KR', online: true, status: 'Deep in tournament', lastActive: 'now' },
    { name: 'Courtney G.', handle: '@courtneygee', initials: 'CG', online: false, status: 'Offline', lastActive: '1h' },
    { name: 'Kristen B.', handle: '@kbicknell', initials: 'KB', online: true, status: 'Available', lastActive: 'now' },
  ],
  'high-mtt': [
    { name: 'Darren E.', handle: '@darrenelias', initials: 'DE', online: true, status: 'In $25K', lastActive: 'now' },
    { name: 'Justin B.', handle: '@justinbonomo', initials: 'JB', online: false, status: 'Offline', lastActive: '4h' },
  ],
  'micro-live': [
    { name: 'FirstTimer', handle: '@firsttimer', initials: 'FT', online: true, status: 'At the casino', lastActive: 'now' },
    { name: 'WeekendWarrior', handle: '@weekendwar', initials: 'WW', online: false, status: 'Offline', lastActive: '3h' },
  ],
  'low-live': [
    { name: 'LiveGrinder', handle: '@livegrinder', initials: 'LG', online: true, status: 'Playing 1/3 live', lastActive: 'now' },
    { name: 'CasinoReg', handle: '@casinoreg', initials: 'CR', online: false, status: 'Offline', lastActive: '1h' },
  ],
  'medium-live': [
    { name: 'LivePro', handle: '@livepro', initials: 'LP', online: true, status: 'At Bellagio', lastActive: 'now' },
    { name: 'VegasRegular', handle: '@vegasreg', initials: 'VR', online: false, status: 'Offline', lastActive: '2h' },
  ],
  'high-live': [
    { name: 'Phil I.', handle: '@philivey', initials: 'PI', online: true, status: 'In Bobby\'s Room', lastActive: 'now' },
    { name: 'HighRollerLife', handle: '@hrlife', initials: 'HR', online: false, status: 'Offline', lastActive: '6h' },
  ],
};

export function getNetworkContacts(stakes: StakesLevel, format: PokerFormat): NetworkContact[] {
  return CONTACTS[contentKey(stakes, format)] ?? CONTACTS['micro-cash'];
}

// ===== DEMO DMs =====
const DMS: Record<string, NetworkDm[]> = {
  'micro-cash': [
    { contactName: 'Mike T.', initials: 'MT', lastMessage: 'You still down for tonight?', timestamp: '5m', unread: 2 },
    { contactName: 'Sarah L.', initials: 'SL', lastMessage: 'Sent you that video', timestamp: '1h', unread: 0 },
  ],
  'low-cash': [
    { contactName: 'Maria Ho', initials: 'MH', lastMessage: 'Send the HH when you get a sec', timestamp: '12m', unread: 1 },
    { contactName: 'Jamie K.', initials: 'JK', lastMessage: 'Study group at 8?', timestamp: '40m', unread: 0 },
    { contactName: 'Spraggy', initials: 'SP', lastMessage: 'lol that river call', timestamp: '2h', unread: 0 },
  ],
  'medium-cash': [
    { contactName: 'Kevin R.', initials: 'KR', lastMessage: '5% still available?', timestamp: '20m', unread: 1 },
    { contactName: 'Kristen B.', initials: 'KB', lastMessage: 'Nice win yesterday', timestamp: '3h', unread: 0 },
  ],
  'high-cash': [
    { contactName: 'Darren E.', initials: 'DE', lastMessage: '25/50 running tonight', timestamp: '25m', unread: 0 },
  ],
  'micro-mtt': [
    { contactName: 'NewToVegas', initials: 'NV', lastMessage: 'Which MTT should I play?', timestamp: '10m', unread: 1 },
    { contactName: 'MicroGrinder', initials: 'MG', lastMessage: 'Push/fold chart sent', timestamp: '1h', unread: 0 },
  ],
  'low-mtt': [
    { contactName: 'Maria Ho', initials: 'MH', lastMessage: 'Send the HH when you get a sec', timestamp: '12m', unread: 1 },
    { contactName: 'Jamie K.', initials: 'JK', lastMessage: 'Study group at 8?', timestamp: '40m', unread: 0 },
  ],
  'medium-mtt': [
    { contactName: 'Kevin R.', initials: 'KR', lastMessage: '5% still available?', timestamp: '20m', unread: 1 },
    { contactName: 'Kristen B.', initials: 'KB', lastMessage: 'Nice win yesterday', timestamp: '3h', unread: 0 },
  ],
  'high-mtt': [
    { contactName: 'Darren E.', initials: 'DE', lastMessage: '25K swap confirmed', timestamp: '25m', unread: 0 },
  ],
  'micro-live': [
    { contactName: 'FirstTimer', initials: 'FT', lastMessage: 'Going tomorrow night', timestamp: '30m', unread: 0 },
  ],
  'low-live': [
    { contactName: 'LiveGrinder', initials: 'LG', lastMessage: 'Game at 8pm?', timestamp: '15m', unread: 1 },
  ],
  'medium-live': [
    { contactName: 'LivePro', initials: 'LP', lastMessage: 'Bellagio tonight?', timestamp: '20m', unread: 0 },
  ],
  'high-live': [
    { contactName: 'Phil I.', initials: 'PI', lastMessage: 'Bobby\'s Room at 9', timestamp: '1h', unread: 0 },
  ],
};

export function getNetworkDms(stakes: StakesLevel, format: PokerFormat): NetworkDm[] {
  return DMS[contentKey(stakes, format)] ?? DMS['micro-cash'];
}

// ===== DEMO ONLINE MEMBERS =====
const ONLINE_MEMBERS: Record<string, NetworkMember[]> = {
  'micro-cash': [
    { name: 'NewToVegas', initials: 'NV', status: 'posting' },
    { name: 'RecreationalGrind', initials: 'RG', status: 'browsing' },
    { name: 'WeekendWarrior', initials: 'WW', status: 'posting' },
    { name: 'FirstTimer', initials: 'FT', status: 'browsing' },
    { name: 'MicroGrinder', initials: 'MG', status: 'idle' },
  ],
  'low-cash': [
    { name: 'Maria Ho', initials: 'MH', status: 'posting' },
    { name: 'Spraggy', initials: 'SP', status: 'browsing' },
    { name: 'Jamie Kerstetter', initials: 'JK', status: 'posting' },
    { name: 'Ryan DePaulo', initials: 'RD', status: 'browsing' },
    { name: 'FintanHand', initials: 'FH', status: 'idle' },
  ],
  'medium-cash': [
    { name: 'Kevin Rabichow', initials: 'KR', status: 'posting' },
    { name: 'Courtney Gee', initials: 'CG', status: 'browsing' },
    { name: 'Kristen Bicknell', initials: 'KB', status: 'posting' },
    { name: 'Darren Elias', initials: 'DE', status: 'browsing' },
    { name: 'Barry Woods', initials: 'BW', status: 'idle' },
  ],
  'high-cash': [
    { name: 'Darren Elias', initials: 'DE', status: 'posting' },
    { name: 'Justin Bonomo', initials: 'JB', status: 'browsing' },
    { name: 'Stephen Chidwick', initials: 'SC', status: 'idle' },
  ],
  'micro-mtt': [
    { name: 'NewToVegas', initials: 'NV', status: 'posting' },
    { name: 'MicroGrinder', initials: 'MG', status: 'browsing' },
    { name: 'BankrollBuilder', initials: 'BB', status: 'posting' },
  ],
  'low-mtt': [
    { name: 'Maria Ho', initials: 'MH', status: 'posting' },
    { name: 'Jamie Kerstetter', initials: 'JK', status: 'posting' },
    { name: 'Spraggy', initials: 'SP', status: 'browsing' },
  ],
  'medium-mtt': [
    { name: 'Kevin Rabichow', initials: 'KR', status: 'posting' },
    { name: 'Kristen Bicknell', initials: 'KB', status: 'posting' },
    { name: 'Courtney Gee', initials: 'CG', status: 'browsing' },
  ],
  'high-mtt': [
    { name: 'Darren Elias', initials: 'DE', status: 'posting' },
    { name: 'Justin Bonomo', initials: 'JB', status: 'browsing' },
  ],
  'micro-live': [
    { name: 'FirstTimer', initials: 'FT', status: 'posting' },
    { name: 'WeekendWarrior', initials: 'WW', status: 'browsing' },
  ],
  'low-live': [
    { name: 'LiveGrinder', initials: 'LG', status: 'posting' },
    { name: 'CasinoReg', initials: 'CR', status: 'browsing' },
  ],
  'medium-live': [
    { name: 'LivePro', initials: 'LP', status: 'posting' },
    { name: 'VegasRegular', initials: 'VR', status: 'browsing' },
  ],
  'high-live': [
    { name: 'Phil Ivey', initials: 'PI', status: 'posting' },
    { name: 'HighRollerLife', initials: 'HR', status: 'browsing' },
  ],
};

export function getNetworkMembers(stakes: StakesLevel, format: PokerFormat): NetworkMember[] {
  return ONLINE_MEMBERS[contentKey(stakes, format)] ?? ONLINE_MEMBERS['micro-cash'];
}

// ===== DEMO OFFERS =====
const OFFERS: Record<string, NetworkOffer[]> = {
  'micro-cash': [
    { id: 'o1', title: 'Preflop Charts for Micros', provider: 'GTO Sensei', type: 'Course', price: '15 credits' },
    { id: 'o2', title: '1-on-1 Micro Cash Review', provider: 'Coach Mike', type: 'Coaching', price: '25 credits' },
  ],
  'low-cash': [
    { id: 'o1', title: '50nl Population Tendencies', provider: 'Maria Ho', type: 'Course', price: '40 credits' },
    { id: 'o2', title: 'Low-Stakes Cash Group Coaching', provider: 'Jamie K.', type: 'Coaching', price: '50 credits' },
  ],
  'medium-cash': [
    { id: 'o1', title: '5/10 GTO Analysis Pack', provider: 'K. Rabichow', type: 'Course', price: '100 credits' },
    { id: 'o2', title: 'Mid-Stakes Private Coaching', provider: 'K. Bicknell', type: 'Coaching', price: '150 credits' },
  ],
  'high-cash': [
    { id: 'o1', title: 'High-Stakes Cash Masterclass', provider: 'D. Elias', type: 'Course', price: '250 credits' },
    { id: 'o2', title: '25/50 Hand Review Session', provider: 'J. Bonomo', type: 'Coaching', price: '500 credits' },
  ],
  'micro-mtt': [
    { id: 'o1', title: 'Micro MTT Push/Fold Guide', provider: 'MicroGrinder', type: 'Course', price: '10 credits' },
    { id: 'o2', title: 'Beginner MTT Strategy', provider: 'Coach Mike', type: 'Coaching', price: '20 credits' },
  ],
  'low-mtt': [
    { id: 'o1', title: 'Low-Stakes MTT Strategy', provider: 'Maria Ho', type: 'Course', price: '35 credits' },
    { id: 'o2', title: 'Sunday Major Prep Group', provider: 'Jamie K.', type: 'Coaching', price: '45 credits' },
  ],
  'medium-mtt': [
    { id: 'o1', title: 'Mid-Stakes MTT GTO Pack', provider: 'K. Rabichow', type: 'Course', price: '100 credits' },
    { id: 'o2', title: 'MTT Final Table Coaching', provider: 'K. Bicknell', type: 'Coaching', price: '120 credits' },
  ],
  'high-mtt': [
    { id: 'o1', title: 'High Roller MTT Strategy', provider: 'D. Elias', type: 'Course', price: '300 credits' },
    { id: 'o2', title: 'High-Roller Final Table Review', provider: 'J. Bonomo', type: 'Coaching', price: '500 credits' },
  ],
  'micro-live': [
    { id: 'o1', title: 'Live Poker Basics', provider: 'LiveGrinder', type: 'Course', price: '15 credits' },
    { id: 'o2', title: 'Casino Etiquette Guide', provider: 'CasinoReg', type: 'Guide', price: '5 credits' },
  ],
  'low-live': [
    { id: 'o1', title: '1/3 Live Cash Strategy', provider: 'LiveGrinder', type: 'Course', price: '30 credits' },
    { id: 'o2', title: 'Live Tells Workshop', provider: 'CasinoReg', type: 'Coaching', price: '40 credits' },
  ],
  'medium-live': [
    { id: 'o1', title: '5/10 Live Cash Mastery', provider: 'LivePro', type: 'Course', price: '80 credits' },
    { id: 'o2', title: 'WSOP Circuit Prep', provider: 'VegasRegular', type: 'Coaching', price: '100 credits' },
  ],
  'high-live': [
    { id: 'o1', title: 'Bobby\'s Room Strategy', provider: 'Phil Ivey', type: 'Course', price: '500 credits' },
    { id: 'o2', title: 'Triton Event Prep', provider: 'HighRollerLife', type: 'Coaching', price: '750 credits' },
  ],
};

export function getNetworkOffers(stakes: StakesLevel, format: PokerFormat): NetworkOffer[] {
  return OFFERS[contentKey(stakes, format)] ?? OFFERS['micro-cash'];
}
