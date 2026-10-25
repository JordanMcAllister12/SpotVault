// Centralized demo/seed data for the SpotVault mobile and desktop experience.
// All values here are fictional. Never persisted to the database.
// The UI reads from this layer when demo mode is active; real authenticated
// users with their own data always take precedence.

export const DEMO_USER = {
  name: '',
  username: '',
  handle: '',
  initials: '',
  level: 0,
  floor: '',
  spi: 0,
  profit: 0,
  roi: 0,
};

export const DEMO_CASH_ANALYTICS = {
  hands: '',
  bbWon: '',
  bb100: '',
  vpip: '',
  pfr: '',
  threeBet: '',
  wtsd: '',
  wsd: '',
  wwsf: '',
  spi: '',
};

export const DEMO_TOURNAMENT_ANALYTICS = {
  tournaments: '',
  buyIns: '',
  cashes: '',
  profit: '',
  roi: '',
  abi: '',
  itm: '',
  finalTables: '',
  wins: '',
};

export interface DemoMediaItem {
  id: string;
  title: string;
  creator: string;
  category: string;
  duration: string;
  progress: number;
  accent: string;
  badge?: string;
}

export const DEMO_MEDIA: DemoMediaItem[] = [];

export interface DemoLibraryItem {
  id: string;
  title: string;
  creator: string;
  type: string;
  acquired: string;
  accent: string;
}

export const DEMO_LIBRARY: DemoLibraryItem[] = [];

export interface DemoCreator {
  id: string;
  name: string;
  handle: string;
  role: string;
  rating: number;
  sales: number;
  accent: string;
}

export const DEMO_CREATORS: DemoCreator[] = [];

export interface DemoProduct {
  id: string;
  title: string;
  creator: string;
  hands: number;
  price: number;
  rating: number;
  sales: number;
  accent: string;
}

export const DEMO_PRODUCTS: DemoProduct[] = [];

export interface DemoHand {
  id: string;
  stakes: string;
  tournament: string;
  position: string;
  holeCards: string;
  board: string;
  result: string;
  pot: number;
  timestamp: string;
}

export const DEMO_HANDS: DemoHand[] = [];

export interface DemoChatMessage {
  id: string;
  author: string;
  handle: string;
  body: string;
  timestamp: string;
  channel: string;
}

export const DEMO_CHAT_CHANNELS: string[] = [];

export const DEMO_CHAT_MESSAGES: DemoChatMessage[] = [];

export interface DemoBooking {
  id: string;
  title: string;
  provider: string;
  type: string;
  date: string;
  time: string;
  status: string;
  accent: string;
}

export const DEMO_BOOKINGS: DemoBooking[] = [];

export interface DemoScheduleItem {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  accent: string;
}

export const DEMO_SCHEDULE: DemoScheduleItem[] = [];

export interface DemoMarketplaceItem {
  id: string;
  title: string;
  provider: string;
  category: string;
  price: number;
  rating: number;
  accent: string;
}

export const DEMO_MARKETPLACE: DemoMarketplaceItem[] = [];

export interface DemoNetworkUser {
  id: string;
  name: string;
  role: string;
  level: number;
  biggestScore?: string;
  online: boolean;
  accent: string;
}

export const DEMO_NETWORK_USERS: DemoNetworkUser[] = [];
