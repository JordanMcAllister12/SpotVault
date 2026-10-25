// ===== FLOOR OFFERS — TARGETED ADVERTISING DATA LAYER =====
// Connects to the floor_offers Supabase table. Falls back to demo data
// if the database is unreachable so the UI always renders.

import { supabase } from '@/lib/supabase';
import type { FloorId } from '@/data/playerNetworkFloors';

export type OfferType = 'COACHING' | 'DEAL' | 'SERVICE' | 'EVENT' | 'PRODUCT' | 'PARTNER';

export interface FloorOffer {
  id: string;
  target_floors: number[];
  offer_type: OfferType;
  headline: string;
  description: string | null;
  provider_name: string;
  provider_handle: string | null;
  provider_floor: number | null;
  credits_price: number | null;
  duration_minutes: number | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  is_sponsored: boolean;
  sponsor_label: string | null;
  bookable: boolean;
  sort_order: number;
}

// ===== DEMO FALLBACK DATA =====
// Mirrors the Supabase seed. Used when the database is unreachable
// or returns no rows, so the floor always has offers to show.

const DEMO_OFFERS: Record<number, FloorOffer[]> = {
  1: [
    { id: 'd1-1', target_floors: [1], offer_type: 'DEAL', headline: 'Vegas Deal: $12.99 Breakfast + Late Checkout', description: 'Fuel up before the grind. Diner-style breakfast at the Motel cafe, plus 2pm late checkout. No resort fees.', provider_name: 'Motel Cafe', provider_handle: '@motelcafe', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Deal', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PARTNER OFFER', bookable: false, sort_order: 1 },
    { id: 'd1-2', target_floors: [1], offer_type: 'COACHING', headline: 'Beginner MTT Review', description: 'New to tournaments? Get a 30-minute hand review from a verified Floor 02 coach. Perfect for your first live series.', provider_name: 'Coach Sarah Chen', provider_handle: '@sarahchen', provider_floor: 2, credits_price: 75, duration_minutes: 30, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 2 },
    { id: 'd1-3', target_floors: [1], offer_type: 'DEAL', headline: 'Welcome Bonus: 50% Deposit Match', description: 'First-time players get a 50% deposit match up to $200 on your first tournament entry fee.', provider_name: 'Vegas Poker Rooms', provider_handle: '@vegasrooms', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Claim', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PROMOTED', bookable: false, sort_order: 3 },
    { id: 'd1-4', target_floors: [1], offer_type: 'DEAL', headline: '$25 Daily Tournament Entry', description: 'Affordable daily tournament at downtown card rooms. $25 buy-in, 5K starting stack, 20-min levels.', provider_name: 'Downtown Grind', provider_handle: '@downtowngrind', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Schedule', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 4 },
    { id: 'd1-5', target_floors: [1], offer_type: 'PRODUCT', headline: 'Free Poker Hand Tracker', description: 'Open-source hand tracking tool. Import your first 100 hands and start building your database.', provider_name: 'SpotVault Tools', provider_handle: '@spotvault', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Download Free', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 5 },
    { id: 'd1-6', target_floors: [1], offer_type: 'DEAL', headline: 'Motel Week: 3 Nights for $89', description: 'Stay 3 nights at the Motel for $89 total. Walking distance to downtown poker rooms. No resort fee.', provider_name: 'Motel 6 Vegas', provider_handle: '@motel6vegas', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Book Room', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'SPONSORED', bookable: false, sort_order: 6 },
  ],
  2: [
    { id: 'd2-1', target_floors: [2], offer_type: 'COACHING', headline: 'MTT Strategy Session', description: 'Deep-dive into tournament strategy with a verified Floor 03 Resort grinder. ICM, final table play, and bubble dynamics.', provider_name: 'Marcus Webb', provider_handle: '@marcuswebb', provider_floor: 3, credits_price: 150, duration_minutes: 30, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 1 },
    { id: 'd2-2', target_floors: [2], offer_type: 'COACHING', headline: 'Database Review', description: 'Full hand history database review from a Floor 04 High Roller coach. Find leaks, build a study plan, and level up.', provider_name: 'Elena Vasquez', provider_handle: '@elenav', provider_floor: 4, credits_price: 350, duration_minutes: 60, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 2 },
    { id: 'd2-3', target_floors: [2], offer_type: 'DEAL', headline: 'Poker Room Promo: $500 Freeroll', description: 'Active players only. Weekly $500 freeroll for verified Poker Room members. Top 10 paid.', provider_name: 'Strip Poker Room', provider_handle: '@strippoker', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Register', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PROMOTED', bookable: false, sort_order: 3 },
    { id: 'd2-4', target_floors: [2], offer_type: 'PRODUCT', headline: 'HH Analyzer Pro — 30 Day Trial', description: 'Advanced hand history analyzer with GTO baseline comparison. Spot leaks in your cash and tournament game.', provider_name: 'PokerTech', provider_handle: '@pokertech', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Start Trial', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'SPONSORED', bookable: false, sort_order: 4 },
    { id: 'd2-5', target_floors: [2], offer_type: 'DEAL', headline: 'Sunday Majors Bundle', description: 'Entry to 4 Sunday majors across 2 sites. $215 total value for $180. Verified active players only.', provider_name: 'Tournament Stakes', provider_handle: '@tournstakes', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Bundle', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 5 },
    { id: 'd2-6', target_floors: [2], offer_type: 'DEAL', headline: 'Vegas Poker Trip: 2 Nights + Tournament Entry', description: '2 nights at a mid-Strip hotel + $250 tournament entry. Everything you need for a Vegas poker weekend.', provider_name: 'Vegas Poker Trips', provider_handle: '@vegaspokertrips', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Package', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PARTNER OFFER', bookable: false, sort_order: 6 },
  ],
  3: [
    { id: 'd3-1', target_floors: [3], offer_type: 'COACHING', headline: 'Private Coaching — Advanced MTT', description: '1-on-1 advanced tournament coaching from a Floor 04 High Roller. Deep runs, final table strategy, and mental game.', provider_name: 'David Kessler', provider_handle: '@dkessler', provider_floor: 4, credits_price: 500, duration_minutes: 60, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 1 },
    { id: 'd3-2', target_floors: [3], offer_type: 'COACHING', headline: 'Elite Performance Coaching', description: 'Mental game and performance coaching from a Floor 05 Penthouse player. Tilt management, routine building, and competitive psychology.', provider_name: 'Alex Rivera', provider_handle: '@alexrivera', provider_floor: 5, credits_price: 700, duration_minutes: 45, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 2 },
    { id: 'd3-3', target_floors: [3], offer_type: 'SERVICE', headline: 'Poker Tax & Accounting Consult', description: 'Specialized poker tax services. Tournament winnings, cash game income, and international tax compliance. 30-min initial consult.', provider_name: 'Kruger Tax Partners', provider_handle: '@krugertax', provider_floor: null, credits_price: 200, duration_minutes: 30, cta_label: 'Book Consult', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'SPONSORED', bookable: false, sort_order: 3 },
    { id: 'd3-4', target_floors: [3], offer_type: 'SERVICE', headline: 'Staking Opportunity — MTT Stable', description: 'Verified MTT staking stable accepting applications. 50/50 split, makeup protection, and coaching included. ABI $150+ preferred.', provider_name: 'Apex Staking', provider_handle: '@apexstaking', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Apply', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 4 },
    { id: 'd3-5', target_floors: [3], offer_type: 'DEAL', headline: 'Resort Stay: Suite + Tournament Entry', description: '3 nights in a resort suite + $1K tournament entry. Premium Strip location with poker room access.', provider_name: 'Vegas Resort Partners', provider_handle: '@vegasresort', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Package', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PARTNER OFFER', bookable: false, sort_order: 5 },
  ],
  4: [
    { id: 'd4-1', target_floors: [4], offer_type: 'COACHING', headline: 'Elite Strategy Consultation', description: 'Private high-stakes strategy consultation with a Floor 05 Penthouse elite. GTO deep dives, exploitative adjustments, and game selection.', provider_name: 'Phil Graves', provider_handle: '@philgraves', provider_floor: 5, credits_price: 1200, duration_minutes: 90, cta_label: 'Book', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: true, sort_order: 1 },
    { id: 'd4-2', target_floors: [4], offer_type: 'SERVICE', headline: 'Wealth Management Consult', description: 'Specialized wealth management for high-stakes poker players. Investment strategy, tax optimization, and long-term financial planning.', provider_name: 'Summit Wealth', provider_handle: '@summitwealth', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Request Consult', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'SPONSORED', bookable: false, sort_order: 2 },
    { id: 'd4-3', target_floors: [4], offer_type: 'SERVICE', headline: 'High-Stakes Staking Network', description: 'Exclusive staking network for high-roller MTT and cash players. Verified volume required. Custom splits and backing terms.', provider_name: 'Black Chip Staking', provider_handle: '@blackchip', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Inquire', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 3 },
    { id: 'd4-4', target_floors: [4], offer_type: 'DEAL', headline: 'VIP Poker Trip — Private Suite + $5K Event', description: 'Private high-roller suite for 3 nights + $5K tournament entry. VIP hospitality, private transportation, and lounge access.', provider_name: 'Vegas VIP', provider_handle: '@vegasvip', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'View Package', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PARTNER OFFER', bookable: false, sort_order: 4 },
  ],
  5: [
    { id: 'd5-1', target_floors: [5], offer_type: 'SERVICE', headline: 'Private Aviation — Vegas Charter', description: 'Private jet charter to and from Las Vegas for series play. Dedicated crew, flexible scheduling, and FBO access.', provider_name: 'Summit Aviation', provider_handle: '@summitaviation', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Request Quote', cta_url: null, image_url: null, is_sponsored: true, sponsor_label: 'PARTNER OFFER', bookable: false, sort_order: 1 },
    { id: 'd5-2', target_floors: [5], offer_type: 'SERVICE', headline: 'Elite Wealth & Tax Strategy', description: 'Comprehensive wealth management for elite poker professionals. International tax, entity structuring, and legacy planning.', provider_name: 'Kruger Private', provider_handle: '@krugerprivate', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Request Consult', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 2 },
    { id: 'd5-3', target_floors: [5], offer_type: 'EVENT', headline: 'Private High-Stakes Game Invitation', description: 'Exclusive private poker game. $50/$100+ NLHE. Invitation only, verified Floor 05 members. Limited seating.', provider_name: 'The Vault Room', provider_handle: '@vaultroom', provider_floor: null, credits_price: null, duration_minutes: null, cta_label: 'Request Invite', cta_url: null, image_url: null, is_sponsored: false, sponsor_label: null, bookable: false, sort_order: 3 },
  ],
};

export async function fetchFloorOffers(floorId: FloorId): Promise<FloorOffer[]> {
  try {
    const { data, error } = await supabase
      .from('floor_offers')
      .select('*')
      .contains('target_floors', [floorId])
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEMO_OFFERS[floorId] ?? [];
    }

    return data as FloorOffer[];
  } catch {
    return DEMO_OFFERS[floorId] ?? [];
  }
}

export function getDemoFloorOffers(floorId: FloorId): FloorOffer[] {
  return DEMO_OFFERS[floorId] ?? [];
}

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  COACHING: 'Coaching',
  DEAL: 'Deal',
  SERVICE: 'Service',
  EVENT: 'Event',
  PRODUCT: 'Product',
  PARTNER: 'Partner',
};
