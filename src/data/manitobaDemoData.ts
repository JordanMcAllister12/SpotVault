// Manitoba Poker demo data — seeded content for the Manitoba Poker community hub.
// UI components import from here so demo data can later be replaced by real operator feeds.
//
// All content in this file is FICTIONAL DEMO DATA — not real production records.
// Remove the exports or set MANITOBA_DEMO_ENABLED = false to disable.

export const MANITOBA_DEMO_ENABLED = false;

export interface ManitobaTournament {
  id: string;
  venue: string;
  operator: string;
  name: string;
  startTime: string;
  buyIn: number;
  prizePoolContribution: number;
  fee: number;
  feePercent: number;
  startingStack: number;
  blindLevelMinutes: number;
  lateRegistration: string;
  reEntry: boolean;
  reEntryLimit: number | null;
  rebuy: boolean;
  addOn: boolean;
  guarantee: number | null;
  live?: {
    level: number;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    entries: number;
    remaining: number;
    reentries: number;
    rebuys: number;
    totalChips: number;
    avgStack: number;
    lateRegRemaining: string;
    nextBreakIn: string;
    elapsed: string;
    lastUpdated: string;
    prizePool: number;
    chipCounts?: ManitobaChipCount[];
  };
}

export interface ManitobaChipCount {
  rank: number;
  playerName: string;
  stack: number;
  reportedAgo: string;
}

export interface ManitobaCashGame {
  id: string;
  venue: string;
  game: string;
  tables: number;
  players: number;
  waiting: number;
  openSeats: number;
  lastUpdated: string;
  status: 'RUNNING' | 'STARTING' | 'INTEREST';
  startsAt?: string;
}

export interface ManitobaPost {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string;
  authorUserId?: string;
  timestamp: string;
  text: string;
  image: string | null;
  image_url: string | null;
  video_url: string | null;
  isFeatured?: boolean;
  reactions: { emoji: string; count: number }[];
  commentCount: number;
  comments?: ManitobaComment[];
  likeCount?: number;
  likedByMe?: boolean;
  boostCount?: number;
  boostedByMe?: boolean;
}

export interface ManitobaComment {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  timestamp: string;
}

export interface ManitobaChatMessage {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  timestamp: string;
  isSelf?: boolean;
}

export interface ManitobaDirectContact {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  online: boolean;
  lastSeen: string;
  previewMessage?: string;
  previewTimestamp?: string;
  messages: ManitobaChatMessage[];
}

// === LIVE TOURNAMENTS ===

export const LIVE_TOURNAMENTS: ManitobaTournament[] = [
  {
    id: 'live-tuesday-night',
    venue: 'McPhillips Street Station Casino',
    operator: 'Trip Aces Poker',
    name: 'Tuesday $150 NLH',
    startTime: '19:00',
    buyIn: 150,
    prizePoolContribution: 130,
    fee: 20,
    feePercent: 13.3,
    startingStack: 25000,
    blindLevelMinutes: 30,
    lateRegistration: 'Until Level 6',
    reEntry: true,
    reEntryLimit: 2,
    rebuy: false,
    addOn: true,
    guarantee: 15000,
    live: {
      level: 8,
      smallBlind: 1000,
      bigBlind: 2000,
      ante: 2000,
      entries: 74,
      remaining: 31,
      reentries: 5,
      rebuys: 0,
      totalChips: 2220000,
      avgStack: 71600,
      lateRegRemaining: 'Closed',
      nextBreakIn: '08:42',
      elapsed: '2h 15m',
      lastUpdated: '30 sec ago',
      prizePool: 9620,
      chipCounts: [
        { rank: 1, playerName: 'Mike R.', stack: 188000, reportedAgo: '2m' },
        { rank: 2, playerName: 'Sarah T.', stack: 154000, reportedAgo: '4m' },
        { rank: 3, playerName: 'Jordan McAllister', stack: 126000, reportedAgo: 'NOW' },
        { rank: 4, playerName: 'Chris B.', stack: 94000, reportedAgo: '7m' },
        { rank: 5, playerName: 'Dylan E.', stack: 81000, reportedAgo: '11m' },
      ],
    },
  },
  {
    id: 'live-turbo',
    venue: 'Club Regent Casino',
    operator: 'Manitoba Poker League',
    name: 'Turbo',
    startTime: '18:30',
    buyIn: 120,
    prizePoolContribution: 110,
    fee: 10,
    feePercent: 8.3,
    startingStack: 20000,
    blindLevelMinutes: 15,
    lateRegistration: 'Until Level 4',
    reEntry: false,
    reEntryLimit: null,
    rebuy: false,
    addOn: false,
    guarantee: null,
    live: {
      level: 11,
      smallBlind: 2000,
      bigBlind: 4000,
      ante: 4000,
      entries: 38,
      remaining: 12,
      reentries: 0,
      rebuys: 0,
      totalChips: 760000,
      avgStack: 63333,
      lateRegRemaining: 'Closed',
      nextBreakIn: '03:20',
      elapsed: '2h 45m',
      lastUpdated: '1 min ago',
      prizePool: 4180,
      chipCounts: [
        { rank: 1, playerName: 'Alex R.', stack: 142000, reportedAgo: '1m' },
        { rank: 2, playerName: 'Dave D.', stack: 98000, reportedAgo: '3m' },
        { rank: 3, playerName: 'James W.', stack: 71000, reportedAgo: '6m' },
      ],
    },
  },
  {
    id: 'live-weekend-main',
    venue: 'McPhillips Street Station Casino',
    operator: 'Trip Aces Poker',
    name: 'Weekend Main',
    startTime: '14:00',
    buyIn: 500,
    prizePoolContribution: 460,
    fee: 40,
    feePercent: 8,
    startingStack: 40000,
    blindLevelMinutes: 40,
    lateRegistration: 'Until Level 8',
    reEntry: true,
    reEntryLimit: 2,
    rebuy: false,
    addOn: true,
    guarantee: 50000,
    live: {
      level: 5,
      smallBlind: 500,
      bigBlind: 1000,
      ante: 1000,
      entries: 62,
      remaining: 54,
      reentries: 2,
      rebuys: 0,
      totalChips: 2480000,
      avgStack: 45925,
      lateRegRemaining: '45m',
      nextBreakIn: '15:30',
      elapsed: '1h 20m',
      lastUpdated: '2 min ago',
      prizePool: 28520,
      chipCounts: [
        { rank: 1, playerName: 'Tyler K.', stack: 92000, reportedAgo: 'NOW' },
        { rank: 2, playerName: 'Dylan E.', stack: 78000, reportedAgo: '5m' },
        { rank: 3, playerName: 'Sarah T.', stack: 61000, reportedAgo: '8m' },
      ],
    },
  },
];

// === CASH GAMES ===

export const LIVE_CASH_GAMES: ManitobaCashGame[] = [
  {
    id: 'cash-1-2-nlh',
    venue: 'Wyndham Hotel — Winnipeg',
    game: '1/2 NLH',
    tables: 3,
    players: 24,
    waiting: 1,
    openSeats: 2,
    lastUpdated: '3:02 PM',
    status: 'RUNNING',
  },
  {
    id: 'cash-2-5-nlh',
    venue: 'Wyndham Hotel — Winnipeg',
    game: '2/5 NLH',
    tables: 1,
    players: 8,
    waiting: 0,
    openSeats: 1,
    lastUpdated: '3:02 PM',
    status: 'RUNNING',
  },
  {
    id: 'cash-1-2-plo',
    venue: 'Wyndham Hotel — Winnipeg',
    game: '1/2 PLO',
    tables: 0,
    players: 4,
    waiting: 0,
    openSeats: 0,
    lastUpdated: '3:02 PM',
    status: 'STARTING',
    startsAt: '3:30 PM',
  },
];

// === TONIGHT'S TOURNAMENTS (carousel) ===

export const TONIGHT_TOURNAMENTS: ManitobaTournament[] = [
  {
    id: 'tonight-trip-aces-sat',
    venue: 'McPhillips Street Station Casino',
    operator: 'Trip Aces Poker',
    name: 'Saturday $200 Deepstack',
    startTime: '19:00',
    buyIn: 200,
    prizePoolContribution: 180,
    fee: 20,
    feePercent: 10,
    startingStack: 25000,
    blindLevelMinutes: 30,
    lateRegistration: 'Until Level 6',
    reEntry: true,
    reEntryLimit: 2,
    rebuy: false,
    addOn: true,
    guarantee: 15000,
  },
  {
    id: 'tonight-club-regent-sat',
    venue: 'Club Regent Casino',
    operator: 'Manitoba Poker League',
    name: 'Saturday $150 Bounty',
    startTime: '18:00',
    buyIn: 150,
    prizePoolContribution: 120,
    fee: 30,
    feePercent: 20,
    startingStack: 15000,
    blindLevelMinutes: 20,
    lateRegistration: 'Until Level 4',
    reEntry: true,
    reEntryLimit: 1,
    rebuy: false,
    addOn: false,
    guarantee: null,
  },
  {
    id: 'tonight-canadian-brewers',
    venue: 'Canadian Brewers Lounge',
    operator: 'Winnipeg Poker Series',
    name: 'Saturday $80 Rebuy',
    startTime: '19:30',
    buyIn: 80,
    prizePoolContribution: 70,
    fee: 10,
    feePercent: 12.5,
    startingStack: 12000,
    blindLevelMinutes: 20,
    lateRegistration: 'Until Level 5',
    reEntry: false,
    reEntryLimit: null,
    rebuy: true,
    addOn: true,
    guarantee: 5000,
  },
  {
    id: 'tonight-brandon-community',
    venue: 'Brandon Community Centre',
    operator: 'Brandon Poker Club',
    name: 'Saturday $60 Freezeout',
    startTime: '18:30',
    buyIn: 60,
    prizePoolContribution: 55,
    fee: 5,
    feePercent: 8.3,
    startingStack: 10000,
    blindLevelMinutes: 20,
    lateRegistration: 'Until Level 3',
    reEntry: false,
    reEntryLimit: null,
    rebuy: false,
    addOn: false,
    guarantee: null,
  },
];

// === COMMUNITY FEED POSTS ===

export const MANITOBA_POSTS: ManitobaPost[] = [
  // Featured: Jordan congratulates Dylan Ellis on 2027 WSOP Main Event win
  {
    id: 'post-dylan-wsop',
    authorName: 'Jordan McAllister',
    authorAvatar: null,
    authorRole: 'FOUNDER',
    timestamp: '2h',
    text: 'Absolutely unreal. Huge congratulations to Dylan Ellis on winning the 2027 WSOP Main Event. Bringing the Main Event bracelet home to Manitoba. What a run. 🏆',
    image: '/assets/profiles/image copy 4.webp',
    image_url: '/assets/profiles/image copy 4.webp',
    video_url: null,
    isFeatured: true,
    authorUserId: 'acc-jordan',
    reactions: [
      { emoji: '🏆', count: 312 },
      { emoji: '🔥', count: 89 },
      { emoji: '💎', count: 47 },
    ],
    likeCount: 312,
    boostCount: 47,
    commentCount: 64,
    comments: [
      { id: 'dc1', authorName: 'Mike Thompson', authorAvatar: null, text: 'Incredible run Dylan! Manitoba proud!', timestamp: '1h' },
      { id: 'dc2', authorName: 'Sarah Kowalski', authorAvatar: null, text: 'Watched the whole final table. Unreal heads-up play.', timestamp: '55m' },
      { id: 'dc3', authorName: 'Trip Aces Poker Tour', authorAvatar: null, text: 'From our Tuesday night games to the WSOP stage. Congratulations!', timestamp: '40m' },
    ],
  },
  // Featured: Trip Aces Poker Tour new Winnipeg location announcement
  {
    id: 'post-trip-aces-room',
    authorName: 'Trip Aces Poker Tour',
    authorAvatar: null,
    authorRole: 'BUSINESS',
    timestamp: '4h',
    text: 'BIG NEWS FOR WINNIPEG POKER ♠️\n\nTrip Aces Poker Tour is getting a new home in Winnipeg.\n\nJoe and Tyler are excited to announce a brand-new poker location with more tournaments, more cash action and plenty more coming for the Manitoba poker community.\n\nMore details soon.',
    image: '/trip-aces-winnipeg.webp',
    image_url: '/trip-aces-winnipeg.webp',
    video_url: null,
    isFeatured: true,
    reactions: [
      { emoji: '🔥', count: 156 },
      { emoji: '👍', count: 98 },
      { emoji: '🎯', count: 34 },
    ],
    likeCount: 156,
    boostCount: 34,
    commentCount: 41,
    comments: [
      { id: 'tc1', authorName: 'Dave Davidson', authorAvatar: null, text: 'This is huge for the Winnipeg scene!', timestamp: '3h' },
      { id: 'tc2', authorName: 'James W.', authorAvatar: null, text: 'Will there be cash games daily?', timestamp: '2h' },
      { id: 'tc3', authorName: 'Trip Aces Poker Tour', authorAvatar: null, text: 'Yes! Cash games 7 days a week plus tournaments 4 nights a week.', timestamp: '2h' },
    ],
  },
  // Trip Aces $100 tournament winner post
  {
    id: 'post-trip-aces-winner',
    authorName: 'Trip Aces Poker Tour',
    authorAvatar: null,
    authorRole: 'BUSINESS',
    timestamp: '6h',
    text: 'Congratulations to tonight\'s $100 NLH champion! 🏆\n\n1st — $2,450\n2nd — $1,525\n3rd — $975\n4th — $650\n5th — $425\n\nThanks to everyone who came out tonight. Great turnout and another fun night of poker.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [
      { emoji: '🏆', count: 42 },
      { emoji: '🔥', count: 18 },
      { emoji: '👍', count: 27 },
    ],
    likeCount: 42,
    boostCount: 8,
    commentCount: 8,
    comments: [
      { id: 'wc1', authorName: 'Mike R.', authorAvatar: null, text: 'Great structure tonight!', timestamp: '5h' },
      { id: 'wc2', authorName: 'Sarah T.', authorAvatar: null, text: 'Nice payout for a $100 buy-in!', timestamp: '4h' },
    ],
  },
  // Community posts
  {
    id: 'post-1',
    authorName: 'Mike R.',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '12m',
    text: 'Anyone playing the Tuesday night tournament?',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 5 }, { emoji: '🎯', count: 2 }],
    likeCount: 14,
    boostCount: 2,
    commentCount: 3,
  },
  {
    id: 'post-2',
    authorName: 'Sarah T.',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '25m',
    text: 'Looks like 2/5 should be running tonight.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 8 }, { emoji: '🔥', count: 3 }],
    likeCount: 11,
    boostCount: 1,
    commentCount: 2,
  },
  {
    id: 'post-3',
    authorName: 'Jordan McAllister',
    authorAvatar: null,
    authorRole: 'FOUNDER',
    authorUserId: 'acc-jordan',
    timestamp: '45m',
    text: 'Great turnout tonight — 74 entries.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 12 }, { emoji: '🔥', count: 5 }],
    likeCount: 31,
    boostCount: 8,
    commentCount: 4,
  },
  {
    id: 'post-4',
    authorName: 'Chris B.',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '1h',
    text: 'Final table reached. Blinds getting big.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 7 }, { emoji: '🎯', count: 1 }],
    likeCount: 9,
    boostCount: 1,
    commentCount: 2,
  },
  {
    id: 'post-5',
    authorName: 'Dave D.',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '2h',
    text: "Who's heading out this weekend?",
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 9 }, { emoji: '🎯', count: 3 }],
    likeCount: 15,
    boostCount: 2,
    commentCount: 3,
  },
  {
    id: 'post-6',
    authorName: 'Sarah Kowalski',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '3h',
    text: 'Cash game at McPhillips last night was insane. 2/5 ran until 4am. Three all-ins in one hand — aces vs kings vs ace-king suited. Aces held.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 18 }, { emoji: '🔥', count: 7 }, { emoji: '💎', count: 5 }],
    likeCount: 24,
    boostCount: 5,
    commentCount: 3,
  },
  {
    id: 'post-7',
    authorName: 'Brandon Poker Club',
    authorAvatar: null,
    authorRole: 'BUSINESS',
    timestamp: '4h',
    text: 'Reminder: Brandon Community Centre Saturday $60 Freezeout at 6:30pm. Great structure for recreational players — 20K stack, 20-min levels. Kitchen will be open!',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 14 }, { emoji: '🎯', count: 6 }],
    likeCount: 20,
    boostCount: 4,
    commentCount: 2,
  },
  {
    id: 'post-8',
    authorName: 'Alex Rivera',
    authorAvatar: null,
    authorRole: 'PLAYER',
    timestamp: '5h',
    text: 'First time playing at McPhillips last night. Great room, friendly dealers, and the 1/2 game was soft. Coming back for sure.',
    image: null,
    image_url: null,
    video_url: null,
    reactions: [{ emoji: '👍', count: 15 }, { emoji: '🎯', count: 3 }],
    likeCount: 18,
    boostCount: 3,
    commentCount: 2,
  },
];

// === GROUP CHAT MESSAGES ===

export const MANITOBA_GROUP_CHAT: ManitobaChatMessage[] = [
  { id: 'gc1', authorName: 'Mike R.', authorAvatar: null, text: 'Anyone playing the Tuesday tonight?', timestamp: '5m' },
  { id: 'gc2', authorName: 'Sarah T.', authorAvatar: null, text: 'Yeah heading down around 6', timestamp: '4m' },
  { id: 'gc3', authorName: 'Jordan McAllister', authorAvatar: null, text: 'Structure looks really good tonight', timestamp: '3m' },
  { id: 'gc4', authorName: 'Chris B.', authorAvatar: null, text: '2/5 running yet?', timestamp: '2m' },
  { id: 'gc5', authorName: 'Trip Aces', authorAvatar: null, text: 'Should be going shortly 👍', timestamp: '1m' },
  { id: 'gc6', authorName: 'Mike R.', authorAvatar: null, text: 'Perfect. See you there', timestamp: '45s' },
];

// === DIRECT CHAT CONTACTS ===

export const MANITOBA_DIRECT_CONTACTS: ManitobaDirectContact[] = [
  {
    id: 'tyler',
    name: 'Tyler',
    avatar: null,
    role: 'PLAYER',
    online: true,
    lastSeen: 'NOW',
    previewMessage: 'Perfect, should be a good turnout.',
    previewTimestamp: '1m',
    messages: [
      { id: 'dc-t1', authorName: 'Tyler', authorAvatar: null, text: 'You playing tonight?', timestamp: '10m' },
      { id: 'dc-t2', authorName: 'You', authorAvatar: null, text: 'Yeah probably heading down around 6.', timestamp: '8m', isSelf: true },
      { id: 'dc-t3', authorName: 'Tyler', authorAvatar: null, text: 'Perfect, should be a good turnout.', timestamp: '1m' },
    ],
  },
  {
    id: 'joe',
    name: 'Joe',
    avatar: null,
    role: 'BUSINESS',
    online: true,
    lastSeen: 'NOW',
    previewMessage: 'New room opens next month!',
    previewTimestamp: '5m',
    messages: [
      { id: 'dc-j1', authorName: 'Joe', authorAvatar: null, text: 'New room opens next month!', timestamp: '5m' },
    ],
  },
  {
    id: 'dylan',
    name: 'Dylan',
    avatar: null,
    role: 'PLAYER',
    online: false,
    lastSeen: '2h',
    previewMessage: 'Thanks for the support!',
    previewTimestamp: '2h',
    messages: [
      { id: 'dc-d1', authorName: 'Dylan', authorAvatar: null, text: 'Thanks for the support!', timestamp: '2h' },
    ],
  },
  {
    id: 'mike-r',
    name: 'Mike R.',
    avatar: null,
    role: 'PLAYER',
    online: true,
    lastSeen: 'NOW',
    previewMessage: 'See you at McPhillips',
    previewTimestamp: '30s',
    messages: [
      { id: 'dc-m1', authorName: 'Mike R.', authorAvatar: null, text: 'See you at McPhillips', timestamp: '30s' },
    ],
  },
  {
    id: 'sarah-t',
    name: 'Sarah T.',
    avatar: null,
    role: 'PLAYER',
    online: false,
    lastSeen: '15m',
    previewMessage: 'Heading down around 6',
    previewTimestamp: '15m',
    messages: [
      { id: 'dc-s1', authorName: 'Sarah T.', authorAvatar: null, text: 'Heading down around 6', timestamp: '15m' },
    ],
  },
];

// === GROUP CHAT PRESENCE ===

export const MANITOBA_GROUP_PRESENCE: { name: string; online: boolean }[] = [
  { name: 'Mike R.', online: true },
  { name: 'Sarah T.', online: true },
  { name: 'Jordan McAllister', online: true },
  { name: 'Chris B.', online: false },
  { name: 'Tyler', online: true },
  { name: 'Dave D.', online: false },
  { name: 'James W.', online: false },
];

// === BEST PLAYER VALUE CALCULATION ===

export function calculateBestPlayerValue(tournaments: ManitobaTournament[]): ManitobaTournament | null {
  if (tournaments.length === 0) return null;
  let best: ManitobaTournament | null = null;
  let bestRatio = Infinity;
  for (const t of tournaments) {
    const ratio = t.fee / (t.prizePoolContribution + t.fee);
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = t;
    }
  }
  return best;
}

export function getBestValueExplanation(t: ManitobaTournament): string {
  const ratio = ((t.fee / (t.prizePoolContribution + t.fee)) * 100).toFixed(1);
  return `Of the $${t.buyIn} buy-in, $${t.prizePoolContribution} (${(100 - parseFloat(ratio)).toFixed(1)}%) goes directly to the prize pool. Only $${t.fee} (${ratio}%) is retained as fee/rake. This is the best ratio among today's tournaments, meaning more of your entry fee reaches the prize pool per dollar spent.`;
}

// Backward compatibility — old direct chat export mapped to contacts
export const MANITOBA_DIRECT_CHAT: ManitobaChatMessage[] = MANITOBA_DIRECT_CONTACTS[0]?.messages ?? [];
