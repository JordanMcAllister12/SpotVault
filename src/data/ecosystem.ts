import type { LucideIcon } from 'lucide-react';
import {
  Brain, BarChart3, Repeat, Layers, Grid3x3, BookOpen, Library,
  GraduationCap, Users, MessageSquare, Store, Briefcase, Megaphone,
  Building2, User, PenTool, Shield, Zap, Share2, Trophy, Target,
  Compass, Crown, Sparkles, Dumbbell, Wallet, Video,
} from 'lucide-react';

export type EcosystemStatus = 'available' | 'beta' | 'coming_soon';

export type EcosystemCategory =
  | 'player_tools'
  | 'education'
  | 'community'
  | 'industry'
  | 'portals';

export interface EcosystemNode {
  id: string;
  title: string;
  category: EcosystemCategory;
  shortDescription: string;
  longDescription: string;
  problemSolved: string;
  connectionToSpotVault: string;
  relatedNodeIds: string[];
  route?: string;
  icon: LucideIcon;
  image?: string;
  videoUrl?: string;
  status: EcosystemStatus;
}

export interface EcosystemCategoryMeta {
  id: EcosystemCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const ECOSYSTEM_CATEGORIES: EcosystemCategoryMeta[] = [
  {
    id: 'player_tools',
    label: 'Player Tools',
    icon: Brain,
    color: '#d4a52c',
    description: 'Study, analyze, and improve your game with professional-grade tools.',
  },
  {
    id: 'education',
    label: 'Education',
    icon: GraduationCap,
    color: '#e8b94a',
    description: 'Learn through targeted, evidence-based Spots from real pros.',
  },
  {
    id: 'community',
    label: 'Community',
    icon: Users,
    color: '#c4962a',
    description: 'Connect, share, and discuss with the poker community.',
  },
  {
    id: 'industry',
    label: 'Industry',
    icon: Briefcase,
    color: '#b8862a',
    description: 'Marketplace, coaching, businesses, and industry services.',
  },
  {
    id: 'portals',
    label: 'Portals',
    icon: Building2,
    color: '#d4a52c',
    description: 'Dedicated workspaces for every role in the poker ecosystem.',
  },
];

export const ECOSYSTEM_NODES: EcosystemNode[] = [
  // PLAYER TOOLS
  {
    id: 'solver',
    title: 'Solver',
    category: 'player_tools',
    shortDescription: 'Run GTO solver calculations directly in your browser.',
    longDescription: 'A built-in GTO solver that runs preflop and postflop calculations without leaving SpotVault. Configure spots, run solves, and study strategies all in one place.',
    problemSolved: 'Players previously needed expensive desktop solver software and had to export results manually to study them.',
    connectionToSpotVault: 'Solver results feed directly into your Hand Workspace and can be SyncShared with coaches.',
    relatedNodeIds: ['analytics', 'hh-workspace', 'syncshare'],
    icon: Zap,
    status: 'beta',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    category: 'player_tools',
    shortDescription: 'Track your results, identify leaks, and measure performance.',
    longDescription: 'Comprehensive analytics that aggregate your hand histories into actionable insights. Track win rates, positional stats, trend graphs, and identify specific leaks in your game.',
    problemSolved: 'Poker analytics were scattered across spreadsheets and third-party tools with no connection to study or coaching.',
    connectionToSpotVault: 'Analytics identifies leaks that point you to relevant Spots and connect you with the right coach.',
    relatedNodeIds: ['solver', 'hh-workspace', 'my-locker'],
    icon: BarChart3,
    status: 'available',
  },
  {
    id: 'hh-replayer',
    title: 'HH Replayer',
    category: 'player_tools',
    shortDescription: 'Replay any hand history step-by-step with visual cards.',
    longDescription: 'A premium hand history replayer that visualizes every street, action, and board card. Import hand histories and replay them with full context.',
    problemSolved: 'Reviewing raw hand history text is slow and makes it hard to see the full picture of a hand.',
    connectionToSpotVault: 'Replayed hands can be saved to your Workspace and SyncShared with coaches or study groups.',
    relatedNodeIds: ['hh-workspace', 'multi-spot', 'syncshare'],
    icon: Repeat,
    status: 'available',
  },
  {
    id: 'hh-workspace',
    title: 'HH Workspace',
    category: 'player_tools',
    shortDescription: 'Your personal study workspace for hands and analysis.',
    longDescription: 'A dedicated workspace where you organize hands, add notes, tag spots, and build study sessions. Your analysis lives alongside your tools, not in a separate app.',
    problemSolved: 'Players studied hands in one tool, took notes in another, and lost the connection between data and insight.',
    connectionToSpotVault: 'Workspace hands connect to Analytics for leak detection and to Spots for targeted learning.',
    relatedNodeIds: ['hh-replayer', 'analytics', 'syncshare', 'multi-spot'],
    icon: Layers,
    status: 'available',
  },
  {
    id: 'multi-spot',
    title: 'Multi-Spot Analysis',
    category: 'player_tools',
    shortDescription: 'Analyze multiple spots and situations side by side.',
    longDescription: 'Compare different tournament spots, cash game scenarios, or ICM situations in a unified view. Build your own reference library of studied spots.',
    problemSolved: 'Studying spots in isolation made it hard to see patterns across similar situations.',
    connectionToSpotVault: 'Multi-Spot results can be SyncShared with coaches for review and discussion.',
    relatedNodeIds: ['solver', 'hh-workspace', 'hh-replayer'],
    icon: Grid3x3,
    status: 'beta',
  },
  {
    id: 'my-locker',
    title: 'My Spots',
    category: 'player_tools',
    shortDescription: 'Your personal content collection for saved content and study materials.',
    longDescription: 'A private area where your saved Spots, videos, hand replays, and study materials are organized and accessible. Content you purchase or save lives here permanently.',
    problemSolved: 'Purchased training content was scattered across platforms with no centralized library.',
    connectionToSpotVault: 'My Spots items connect to the Spot Library and Creator Content you purchase.',
    relatedNodeIds: ['spot-library', 'my-library', 'analytics'],
    icon: BookOpen,
    status: 'available',
  },
  {
    id: 'syncshare',
    title: 'SyncShare',
    category: 'player_tools',
    shortDescription: 'Securely share hands, analysis, and study materials with anyone.',
    longDescription: 'A permission-based sharing system that lets you grant access to specific hands, solver results, or workspace content to coaches, friends, or study groups — without exposing your full account.',
    problemSolved: 'Sharing hand histories and analysis required exporting files, sending them insecurely, and losing context.',
    connectionToSpotVault: 'SyncShare connects your Workspace to your coach and study group in real time.',
    relatedNodeIds: ['hh-workspace', 'solver', 'community-feed', 'coaching'],
    icon: Share2,
    status: 'available',
  },

  // EDUCATION
  {
    id: 'spot-library',
    title: 'Spot Library',
    category: 'education',
    shortDescription: 'Browse and purchase targeted Spots from top players and coaches.',
    longDescription: 'A marketplace of short, focused training Spots created by verified pros and coaches. Each Spot addresses a specific situation, so you learn exactly what you need instead of sitting through a full course.',
    problemSolved: 'Poker education was dominated by expensive, long-form courses that covered everything whether you needed it or not.',
    connectionToSpotVault: 'Spots are created by the same coaches in the Coaching marketplace and saved to your My Spots.',
    relatedNodeIds: ['my-library', 'spots', 'coaching', 'creator-content'],
    icon: Library,
    status: 'available',
  },
  {
    id: 'my-library',
    title: 'My Spots',
    category: 'education',
    shortDescription: 'Your purchased Spots and learning materials, organized.',
    longDescription: 'A personal library of every Spot, course, and training material you have purchased or saved. Organized, searchable, and connected to your study workflow.',
    problemSolved: 'Purchased content lived on the seller\'s platform, not yours, and was easy to lose track of.',
    connectionToSpotVault: 'My Spots connects purchases from the Spot Library to your Workspace.',
    relatedNodeIds: ['spot-library', 'my-locker', 'spots'],
    icon: BookOpen,
    status: 'available',
  },
  {
    id: 'spots',
    title: 'Spots',
    category: 'education',
    shortDescription: 'Short, targeted, evidence-based training units.',
    longDescription: 'The core educational unit of SpotVault. A Spot is a focused training segment — a single hand breakdown, a specific ICM spot, a tournament bubble situation — created by a pro who has studied it deeply. Buy only what you want to learn.',
    problemSolved: 'Players paid hundreds for full courses when they only needed help with one specific situation.',
    connectionToSpotVault: 'Spots are created by coaches, purchased from the Spot Library, and saved to My Spots.',
    relatedNodeIds: ['spot-library', 'my-library', 'creator-content', 'coaching'],
    icon: Target,
    status: 'available',
  },
  {
    id: 'courses',
    title: 'Courses',
    category: 'education',
    shortDescription: 'Structured learning paths from verified instructors.',
    longDescription: 'Longer-form courses for players who want comprehensive instruction on a topic. Courses complement Spots by providing deeper, structured learning paths.',
    problemSolved: 'Some topics require more depth than a single Spot can provide.',
    connectionToSpotVault: 'Courses are created by coaches and creators, and live alongside Spots in the Library.',
    relatedNodeIds: ['spot-library', 'my-library', 'creator-content'],
    icon: GraduationCap,
    status: 'coming_soon',
  },
  {
    id: 'creator-content',
    title: 'Creator Content',
    category: 'education',
    shortDescription: 'Free and premium content from poker creators.',
    longDescription: 'Content produced by SpotVault creators — articles, videos, stream clips, and breakdowns — that complement formal Spots and courses. A mix of free and premium content from the community.',
    problemSolved: 'Poker content on social media had no connection to structured learning or study tools.',
    connectionToSpotVault: 'Creator content links to Spots, the Spot Library, and the Community feed.',
    relatedNodeIds: ['spot-library', 'community-feed', 'creator-portal'],
    icon: PenTool,
    status: 'available',
  },

  // COMMUNITY
  {
    id: 'community-feed',
    title: 'Info',
    category: 'community',
    shortDescription: 'The poker community\'s central social feed.',
    longDescription: 'A poker-first social feed where players, coaches, creators, and industry pros share posts, hand breakdowns, results, and discussion. Built for poker, not bolted onto a general-purpose social network.',
    problemSolved: 'Poker discussion was fragmented across Twitter, Discord, and forums with no connection to tools or study.',
    connectionToSpotVault: 'Feed posts can link to Spots, hands, and SyncShared content directly.',
    relatedNodeIds: ['player-lounge', 'network', 'messaging', 'creator-content'],
    icon: MessageSquare,
    status: 'available',
  },
  {
    id: 'player-lounge',
    title: 'Player Lounge',
    category: 'community',
    shortDescription: 'A shared social space for players to connect and relax.',
    longDescription: 'A virtual lounge where players gather, chat, share results, and discuss hands in a more casual setting. Community rooms with real-time presence and conversation.',
    problemSolved: 'Poker lacked a dedicated social space that felt like a real community, not a forum thread.',
    connectionToSpotVault: 'The Lounge connects to the Info Feed and Messaging for seamless social interaction.',
    relatedNodeIds: ['community-feed', 'network', 'messaging'],
    icon: Users,
    status: 'beta',
  },
  {
    id: 'network',
    title: 'Network & Following',
    category: 'community',
    shortDescription: 'Follow players, coaches, and creators. Build your poker network.',
    longDescription: 'A poker-specific network system. Follow players, coaches, creators, and industry professionals. See their posts, results, and content in a personalized feed.',
    problemSolved: 'Poker networking happened on generic social platforms with no poker context or tool integration.',
    connectionToSpotVault: 'Your network connects to Messaging, the Feed, and SyncShare for private study groups.',
    relatedNodeIds: ['community-feed', 'messaging', 'people-directory'],
    icon: Users,
    status: 'available',
  },
  {
    id: 'messaging',
    title: 'Messaging & Chat',
    category: 'community',
    shortDescription: 'Private messages, group chats, and portal channels.',
    longDescription: 'A full messaging system with private DMs, group chats, and portal-specific channels. Talk to your coach, your study group, or your stable — all in one place.',
    problemSolved: 'Poker communication was split across WhatsApp, Discord, and DMs with no connection to study content.',
    connectionToSpotVault: 'Messaging integrates with SyncShare so you can share hands and analysis inside a conversation.',
    relatedNodeIds: ['community-feed', 'network', 'syncshare'],
    icon: MessageSquare,
    status: 'available',
  },

  // INDUSTRY
  {
    id: 'marketplace',
    title: 'Marketplace',
    category: 'industry',
    shortDescription: 'The central marketplace for poker products and services.',
    longDescription: 'A unified marketplace where players find coaches, staking, training content, and poker services. Coaches and businesses list their offerings in one place that the entire ecosystem can access.',
    problemSolved: 'Poker services were advertised across scattered platforms with no quality control or unified discovery.',
    connectionToSpotVault: 'Marketplace listings connect to coaching, the Spot Library, and business profiles.',
    relatedNodeIds: ['coaching', 'spot-library', 'businesses', 'advertising'],
    icon: Store,
    status: 'available',
  },
  {
    id: 'coaching',
    title: 'Coaching & Services',
    category: 'industry',
    shortDescription: 'Book sessions with verified coaches and service providers.',
    longDescription: 'A coaching marketplace where players find, book, and pay for sessions with verified coaches. Browse by specialty, rating, and price. Book a session without leaving SpotVault.',
    problemSolved: 'Finding a qualified coach required referrals, forum posts, and trust-based decisions with no reviews.',
    connectionToSpotVault: 'Coaching connects to Analytics (your coach sees your leaks), SyncShare (share hands), and the Spot Library.',
    relatedNodeIds: ['marketplace', 'syncshare', 'analytics', 'coach-portal'],
    icon: GraduationCap,
    status: 'available',
  },
  {
    id: 'businesses',
    title: 'Businesses',
    category: 'industry',
    shortDescription: 'Poker businesses — stables, training sites, and operators.',
    longDescription: 'A directory and CRM for poker businesses. Stables manage their roster, training sites publish content, and operators reach the community. Businesses get tools, visibility, and a direct line to players.',
    problemSolved: 'Poker businesses operated in isolation with no centralized platform to reach or manage their audience.',
    connectionToSpotVault: 'Businesses connect to the Marketplace, Advertising, and the Business Portal.',
    relatedNodeIds: ['marketplace', 'advertising', 'business-portal', 'poker-scene'],
    icon: Briefcase,
    status: 'available',
  },
  {
    id: 'advertising',
    title: 'Advertising',
    category: 'industry',
    shortDescription: 'Reach the poker community with targeted advertising.',
    longDescription: 'An advertising platform built for the poker industry. Businesses, stables, and creators can reach a targeted poker audience with sponsored content, display ads, and promoted listings.',
    problemSolved: 'Poker advertising relied on generic ad networks with no poker-specific targeting.',
    connectionToSpotVault: 'Advertising connects to Businesses, the Marketplace, and the Community feed.',
    relatedNodeIds: ['marketplace', 'businesses', 'community-feed'],
    icon: Megaphone,
    status: 'coming_soon',
  },
  {
    id: 'poker-scene',
    title: 'PokerScene',
    category: 'industry',
    shortDescription: 'Live poker rooms, events, and venue discovery.',
    longDescription: 'A platform for live poker venues, tournaments, and events. Discover nearby games, track tournament schedules, and connect with poker rooms. Built for the live poker community.',
    problemSolved: 'Finding live games and tracking tournament schedules required multiple websites and apps.',
    connectionToSpotVault: 'PokerScene connects to the Community feed, Businesses, and the Player Network.',
    relatedNodeIds: ['businesses', 'community-feed', 'network'],
    icon: Trophy,
    status: 'beta',
  },

  // PORTALS
  {
    id: 'player-portal',
    title: 'Player Portal',
    category: 'portals',
    shortDescription: 'The primary workspace for poker players.',
    longDescription: 'A dedicated portal where players access their tools, analytics, library, My Spots, community, and marketplace. The Player Portal is the home base for everything a player does on SpotVault.',
    problemSolved: 'Players juggled multiple tools and platforms with no unified workspace.',
    connectionToSpotVault: 'The Player Portal is the central hub that connects to every other part of the ecosystem.',
    relatedNodeIds: ['solver', 'analytics', 'hh-workspace', 'my-locker', 'community-feed', 'marketplace'],
    icon: User,
    status: 'available',
  },
  {
    id: 'coach-portal',
    title: 'Coach Portal',
    category: 'portals',
    shortDescription: 'A workspace for coaches to manage students and content.',
    longDescription: 'A dedicated portal for coaches. Manage students, review shared hands, create Spots, track student progress, and run your coaching business — all in one place.',
    problemSolved: 'Coaches managed students across spreadsheets, messaging apps, and video tools with no unified system.',
    connectionToSpotVault: 'The Coach Portal connects to SyncShare, the Marketplace, and the Spot Library.',
    relatedNodeIds: ['coaching', 'syncshare', 'spot-library', 'hh-workspace'],
    icon: GraduationCap,
    status: 'available',
  },
  {
    id: 'stable-portal',
    title: 'Stable Portal',
    category: 'portals',
    shortDescription: 'Tools for stables to manage rosters and staking.',
    longDescription: 'A portal for poker stables. Manage your roster, track player performance, coordinate staking agreements, and communicate with your team.',
    problemSolved: 'Stables managed rosters and staking across spreadsheets and group chats with no performance tracking.',
    connectionToSpotVault: 'The Stable Portal connects to Analytics, the Marketplace, and the Business Portal.',
    relatedNodeIds: ['analytics', 'marketplace', 'business-portal', 'businesses'],
    icon: Shield,
    status: 'beta',
  },
  {
    id: 'creator-portal',
    title: 'Creator Portal',
    category: 'portals',
    shortDescription: 'A workspace for content creators to publish and monetize.',
    longDescription: 'A portal for poker content creators. Publish Spots, create content, manage your audience, and monetize your expertise. Creators get tools to turn their knowledge into income.',
    problemSolved: 'Poker creators relied on YouTube and social media with no direct monetization or poker-specific tools.',
    connectionToSpotVault: 'The Creator Portal connects to the Spot Library, Creator Content, and the Community feed.',
    relatedNodeIds: ['spot-library', 'creator-content', 'community-feed', 'marketplace'],
    icon: PenTool,
    status: 'available',
  },
  {
    id: 'business-portal',
    title: 'Business Portal',
    category: 'portals',
    shortDescription: 'A workspace for poker businesses to operate and grow.',
    longDescription: 'A portal for poker businesses. Manage your profile, run advertising, track customers, publish offerings, and connect with the poker community. A CRM and operations hub for the poker industry.',
    problemSolved: 'Poker businesses had no centralized platform to manage operations and reach customers.',
    connectionToSpotVault: 'The Business Portal connects to the Marketplace, Advertising, and Businesses.',
    relatedNodeIds: ['businesses', 'marketplace', 'advertising', 'poker-scene'],
    icon: Building2,
    status: 'available',
  },
];

export const STATUS_LABELS: Record<EcosystemStatus, string> = {
  available: 'Available',
  beta: 'Beta',
  coming_soon: 'Available',
};

export const STATUS_COLORS: Record<EcosystemStatus, string> = {
  available: '#4ade80',
  beta: '#d4a52c',
  coming_soon: '#7A7D7F',
};

export interface JourneyStep {
  step: number;
  title: string;
  description: string;
  nodeId: string;
  icon: LucideIcon;
}

export const PLAYER_JOURNEY: JourneyStep[] = [
  {
    step: 1,
    title: 'Player',
    description: 'A player starts their SpotVault journey in the Player Portal.',
    nodeId: 'player-portal',
    icon: User,
  },
  {
    step: 2,
    title: 'Studies Analytics',
    description: 'They import hand histories and Analytics identifies a leak in their 3-bet defense.',
    nodeId: 'analytics',
    icon: BarChart3,
  },
  {
    step: 3,
    title: 'Finds a Spot',
    description: 'The Spot Library recommends a relevant Spot on 3-bet defense from a top pro.',
    nodeId: 'spot-library',
    icon: Target,
  },
  {
    step: 4,
    title: 'Studies the Spot',
    description: 'They study the Spot, save it to My Spots, and add hands to their Workspace.',
    nodeId: 'hh-workspace',
    icon: Layers,
  },
  {
    step: 5,
    title: 'SyncShares with Coach',
    description: 'They SyncShare the hands with their coach for review and feedback.',
    nodeId: 'syncshare',
    icon: Share2,
  },
  {
    step: 6,
    title: 'Discusses in Community',
    description: 'They post about the spot in the Community Feed and discuss it with other players.',
    nodeId: 'community-feed',
    icon: MessageSquare,
  },
];
