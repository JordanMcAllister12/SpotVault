// Single source of truth for Store products, credit packages, and entitlements.
// Display only — no billing logic lives here.

export type PlanTier = 'free' | 'core' | 'pro' | 'elite';

export interface SubscriptionProduct {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceLabel: string;
  badge?: string;
  comingSoon?: boolean;
  portalProduct?: boolean;
  perUserPriceMonthly?: number;
  features?: string[];
  contactForPricing?: boolean;
  description?: string;
  longDescription?: string;
}

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  // ── MEMBERSHIPS ──
  {
    id: 'free',
    name: 'Free',
    tagline: 'Explore SpotVault and join the community.',
    priceMonthly: 0,
    priceLabel: '$0',
    description: 'Explore SpotVault and join the community.',
    features: [
      'Community access',
      'Browse Spot Library',
      'Limited Hand History Replayer',
      '5 HH Vault saves / month',
    ],
    longDescription: 'Explore SpotVault and join the community.\n\nIncludes:\n• Community access\n• Browse Spot Library\n• Limited Hand History Replayer\n• 5 HH Vault saves / month',
  },
  {
    id: 'core',
    name: 'Core',
    tagline: 'Essential SpotVault tools + community access.',
    priceMonthly: 9.99,
    priceLabel: '$9.99 / month',
    description: 'Essential SpotVault tools + community access.',
    features: [
      'Everything in Free',
      'Community chat privileges',
      'Hand History Replayer',
      'SyncShare',
      'Create & upload content',
      'Publish to Public Library',
    ],
    longDescription: 'Essential SpotVault tools + community access.\n\nIncludes:\n• Everything in Free\n• Community chat privileges\n• Hand History Replayer\n• SyncShare\n• Create & upload content\n• Publish to Public Library\n\nImportant: Access to private Lounge chats does NOT require Core membership. Lounge chat access is FREE if you are accepted into that Lounge/group.',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Everything in Core, plus advanced performance tools.',
    priceMonthly: 29.99,
    priceLabel: '$29.99 / month',
    badge: 'Best Value',
    description: 'Everything in Core, plus advanced performance tools.',
    features: [
      'Everything in Core',
      'Full Analytics Suite',
      'Tournament & Cash Analytics',
      'Board Analysis',
      'Advanced Reports',
      'HH SyncShare',
      'Voice Commentary',
    ],
    longDescription: 'Everything in Core, plus advanced performance tools.\n\nIncludes:\n• Everything in Core\n• Full Analytics Suite\n• Tournament & Cash Analytics\n• Board Analysis\n• Advanced Reports\n• HH SyncShare\n• Voice Commentary',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: "SpotVault's complete player toolkit.",
    priceMonthly: 99.99,
    priceLabel: '$99.99 / month',
    badge: 'Top Tier',
    description: "SpotVault's complete player toolkit.",
    features: [
      'Everything in Pro',
      'Unlimited Spot saves',
      'Unlimited SyncShares',
      'Priority support',
    ],
    longDescription: "SpotVault's complete player toolkit.\n\nIncludes:\n• Everything in Pro\n• Unlimited Spot saves\n• Unlimited SyncShares\n• Priority support\n\nSolver access is Coming Soon for Elite members.",
  },
  // ── PROFESSIONAL PORTALS ──
  {
    id: 'creator-portal',
    name: 'Creator / Pro Portal',
    tagline: 'A professional presence for poker creators and industry professionals.',
    priceMonthly: 50,
    priceLabel: '$50 / month',
    portalProduct: true,
    description: 'A professional presence for poker creators and industry professionals.',
    features: [
      'Rolodex access',
      'Site-wide advertising opportunities',
      'Professional profile/presence',
      'Booking and hosting tools',
    ],
    longDescription: 'A professional presence for poker creators and industry professionals.\n\nIncludes:\n• Rolodex access\n• Site-wide advertising opportunities\n• Professional profile/presence\n• Booking and hosting tools',
  },
  {
    id: 'coach-portal',
    name: 'Coach Portal',
    tagline: 'A professional workspace built to make coaching easier and help grow your business.',
    priceMonthly: 50,
    priceLabel: '$50 / month',
    portalProduct: true,
    description: 'A professional workspace built to make coaching easier and help grow your business.',
    features: [
      'Coach-specific workflow and management tools',
      'Marketplace and site-wide advertising opportunities',
      'Rolodex access',
      'Booking/client tools',
      'Potential facilitated payment processing through SpotVault',
    ],
    longDescription: 'A professional workspace built to make coaching easier and help grow your business.\n\nIncludes:\n• Coach-specific workflow and management tools\n• Marketplace and site-wide advertising opportunities\n• Rolodex access\n• Booking/client tools\n• Potential facilitated payment processing through SpotVault\n\nNote: Payment processing functionality is not yet finalized. Access to facilitated payment processing is subject to future availability.',
  },
  {
    id: 'stable-portal',
    name: 'Stable Portal',
    tagline: 'A centralized workspace for managing and developing your stable.',
    priceMonthly: 500,
    perUserPriceMonthly: 30,
    priceLabel: '$500 / month + $30 per active user',
    portalProduct: true,
    contactForPricing: true,
    description: 'A centralized workspace for managing and developing your stable.',
    features: [
      'Stable-specific workflow and management tools',
      'Tools designed to simplify day-to-day stable operations',
      'Marketplace and site-wide advertising opportunities',
      'Rolodex access',
    ],
    longDescription: 'A centralized workspace for managing and developing your stable.\n\nIncludes:\n• Stable-specific workflow and management tools\n• Tools designed to simplify day-to-day stable operations\n• Marketplace and site-wide advertising opportunities\n• Rolodex access',
  },
  {
    id: 'business-portal',
    name: 'Business Portal',
    tagline: 'A dedicated presence for poker businesses and service providers.',
    priceMonthly: 50,
    priceLabel: '$50 / month',
    portalProduct: true,
    description: 'A dedicated presence for poker businesses and service providers.',
    features: [
      'Rolodex access',
      'Site-wide advertising opportunities',
      'Business visibility throughout SpotVault',
      'Booking and hosting tools',
    ],
    longDescription: 'A dedicated presence for poker businesses and service providers.\n\nIncludes:\n• Rolodex access\n• Site-wide advertising opportunities\n• Business visibility throughout SpotVault\n• Booking and hosting tools',
  },
  {
    id: 'media-portal',
    name: 'Media Portal',
    tagline: 'A dedicated presence for poker media and content organizations.',
    priceMonthly: 50,
    priceLabel: '$50 / month',
    portalProduct: true,
    description: 'A dedicated presence for poker media and content organizations.',
    features: [
      'Rolodex access',
      'Site-wide advertising opportunities',
      'Media/content visibility throughout SpotVault',
      'Booking and hosting tools',
    ],
    longDescription: 'A dedicated presence for poker media and content organizations.\n\nIncludes:\n• Rolodex access\n• Site-wide advertising opportunities\n• Media/content visibility throughout SpotVault\n• Booking and hosting tools',
  },
];

export const CREDIT_USES = [
  'Coaching & hand reviews',
  'Marketplace purchases',
  'Premium content',
  'ProVault questions',
  'Industry services',
];

export const COACH_PORTAL_FEATURES = [
  'Public Coaching Marketplace Profile',
  'Rates & Package Pricing',
  'Availability',
  'Results',
  'Ratings & Reviews',
  'Booking Workflow',
  'SpotVault Payment / Credit Handling',
  'Student Management',
  'Hand History Submissions',
  'Integrated HH Replayer',
  'Coach Notes & Hand Analysis',
  'Reference Image Uploads',
  'Structured Lessons',
  'Solver Integration*',
  'Analytics Integration*',
  'Portal Customization Available**',
];

export const COACH_PORTAL_FEATURE_FOOTNOTES = [
  '*Separate SpotVault add-on subscription required.',
  '**Additional customization/development fees may apply depending on scope.',
];

// Entitlement matrix — audited against actual product features.
// Only includes features that actually exist in SpotVault.
export interface EntitlementRow {
  feature: string;
  free: string | boolean;
  core: string | boolean;
  pro: string | boolean;
  elite: string | boolean;
}

export const ENTITLEMENT_ROWS: EntitlementRow[] = [
  { feature: 'Community access', free: true, core: true, pro: true, elite: true },
  { feature: 'Browse Spot Library', free: true, core: true, pro: true, elite: true },
  { feature: 'Create & upload to My Spots', free: false, core: true, pro: true, elite: true },
  { feature: 'Edit & organize Library', free: false, core: true, pro: true, elite: true },
  { feature: 'Publish to Public Library', free: false, core: true, pro: true, elite: true },
  { feature: 'Creator profile', free: false, core: true, pro: true, elite: true },
  { feature: 'Hand History Replayer', free: 'Limited', core: true, pro: true, elite: true },
  { feature: 'Knowledge SyncShare', free: false, core: true, pro: true, elite: true },
  { feature: 'HH Vault saves', free: '5 / month', core: 'Unlimited', pro: 'Unlimited', elite: 'Unlimited' },
  { feature: 'Full Analytics Suite', free: false, core: false, pro: true, elite: true },
  { feature: 'Tournament Analytics', free: false, core: false, pro: true, elite: true },
  { feature: 'Cash Analytics', free: false, core: false, pro: true, elite: true },
  { feature: 'Board Analysis', free: false, core: false, pro: true, elite: true },
  { feature: 'Advanced Reports', free: false, core: false, pro: true, elite: true },
  { feature: 'Hand History SyncShare', free: false, core: false, pro: true, elite: true },
  { feature: 'Text commentary', free: false, core: true, pro: true, elite: true },
  { feature: 'Voice commentary', free: false, core: false, pro: true, elite: true },
  { feature: 'Monetize Spots', free: 'Coming Soon', core: 'Coming Soon', pro: 'Coming Soon', elite: 'Coming Soon' },
  { feature: 'Solver Access', free: false, core: false, pro: false, elite: 'Coming Soon' },
];

export const PLAN_SUMMARY: { tier: PlanTier; title: string; subtitle: string; price?: string; cta: string }[] = [
  { tier: 'free', title: 'FREE', subtitle: 'Explore', cta: 'Explore SpotVault' },
  { tier: 'core', title: 'CORE', subtitle: 'Create and Share', price: '$9.99/month', cta: 'View Core' },
  { tier: 'pro', title: 'PRO', subtitle: 'Analyze and Improve', price: '$29.99/month', cta: 'View Pro' },
  { tier: 'elite', title: 'ELITE', subtitle: 'Complete Toolkit', price: '$99.99/month', cta: 'View Elite' },
];

export const KNOWLEDGE_FEATURES = [
  { icon: 'BookOpen', label: 'Browse community knowledge' },
  { icon: 'Library', label: 'Build a personal Library' },
  { icon: 'PenTool', label: 'Create & publish content' },
  { icon: 'Share2', label: 'Share knowledge with players' },
  { icon: 'Play', label: 'Replay hand histories' },
  { icon: 'BarChart3', label: 'Analyze performance & find leaks' },
  { icon: 'Gift', label: 'Mystery Vaults (Coming Soon)' },
];

export const REWARD_EXAMPLES = [
  'Digital collectible cards',
  'Credits',
  'XP boosts',
  'Premium study content',
  'Core/Pro membership time',
  'ProVault Question Tokens',
  'Coaching sessions',
  'Cosmetics & collectibles',
  'Seasonal rewards',
];

export const REWARDS_STATUS = 'coming_soon' as const;

export const REWARD_ACTIVITIES = [
  'Studying',
  'Creating content',
  'Sharing knowledge',
  'Participating in community',
];

export const FAQ_ITEMS = [
  { q: 'What can I do with a Free account?', a: 'Free accounts can browse the community, explore the Spot Library, use a limited Hand History Replayer, and save up to 5 hands per month to the HH Vault. Mystery Vault rewards are coming soon.' },
  { q: 'How does the monthly Library limit work?', a: 'Free users can browse but cannot create or upload to My Spots. Core and Pro users can create, upload, edit, organize, and publish content to the Public Library with no monthly limits.' },
  { q: 'What is included with Core?', a: 'Core includes everything in Free plus: full Library creation and publishing, Knowledge SyncShare, unlimited HH Vault saves, text commentary, and creator profile. Enhanced Mystery Vault rewards are coming soon.' },
  { q: 'What is included with Pro?', a: 'Pro includes everything in Core plus: the full Analytics Suite (tournament, cash, board analysis), Advanced Reports, Hand History SyncShare, and voice commentary. Premium Mystery Vault rewards are coming soon.' },
  { q: 'How do I earn Mystery Vaults?', a: 'Mystery Vaults are not yet available. When launched, they will be earned through platform activity: studying, creating content, sharing knowledge, and participating in the community. Higher tiers will unlock better reward pools.' },
  { q: 'Are rewards guaranteed?', a: 'No. When rewards launch, they will be randomized. Specific prizes, drop rates, and outcomes are not guaranteed. You may not receive every type of reward listed.' },
  { q: 'Can Free users win premium rewards?', a: 'When rewards launch, Free users will have access to basic reward pools. Premium rewards will be available to Core and Pro members through enhanced and premium reward tiers.' },
  { q: 'Can I upgrade Core to Pro?', a: 'Yes. You can upgrade from Core to Pro at any time. The price difference will be prorated for the remaining billing period.' },
  { q: 'Can I cancel?', a: 'Yes. You can cancel your subscription at any time. Your plan remains active until the end of the current billing period, after which your account reverts to Free.' },
  { q: 'What happens to My Spots if membership expires?', a: 'Your Spots content is preserved. If your membership expires, you can still browse but cannot create new content, upload, or publish until you resubscribe.' },
];
