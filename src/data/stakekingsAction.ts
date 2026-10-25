// FICTIONAL DEMO DATA — StakeKings action marketplace prototype.
// All listings, markup, availability, and tournament entries are illustrative.
// No real player has endorsed or agreed to any terms shown here.

export interface StakeKingsActionListing {
  id: string;
  playerName: string;
  playerDescriptor: string;
  avatarInitials: string;
  event: string;
  buyIn: string;
  buyInCurrency: 'USD' | 'EUR';
  buyInValue: number;
  percentOffered: number;
  percentRemaining: number;
  markup: number;
  status: 'featured' | 'selling_fast' | 'standard';
  quickPercents: { pct: number; price: string }[];
  peopleProfileId?: string;
  verifiedPurchaseUrl?: string;
}

function priceFor(listing: { buyInValue: number; markup: number; buyInCurrency: 'USD' | 'EUR' }, pct: number): string {
  const cost = (listing.buyInValue * listing.markup * pct) / 100;
  const sym = listing.buyInCurrency === 'EUR' ? '€' : '$';
  return `${sym}${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const baseListings: Omit<StakeKingsActionListing, 'quickPercents'>[] = [
  {
    id: 'sk-1',
    playerName: 'Alex Theologis',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'AT',
    event: 'WSOP $10K Main Event',
    buyIn: '$10,000',
    buyInCurrency: 'USD',
    buyInValue: 10000,
    percentOffered: 25,
    percentRemaining: 8,
    markup: 1.15,
    status: 'featured',
    peopleProfileId: 'sk-theologis',
  },
  {
    id: 'sk-2',
    playerName: 'Jordan Drummond',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'JD',
    event: 'WSOP $10K Main Event',
    buyIn: '$10,000',
    buyInCurrency: 'USD',
    buyInValue: 10000,
    percentOffered: 20,
    percentRemaining: 5,
    markup: 1.10,
    status: 'selling_fast',
    peopleProfileId: 'sk-drummond',
  },
  {
    id: 'sk-3',
    playerName: 'Bryan Paris',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'BP',
    event: 'EPT Main Event',
    buyIn: '€5,300',
    buyInCurrency: 'EUR',
    buyInValue: 5300,
    percentOffered: 30,
    percentRemaining: 12,
    markup: 1.08,
    status: 'featured',
    peopleProfileId: 'sk-paris',
  },
  {
    id: 'sk-4',
    playerName: 'Kevin Rabichow',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'KR',
    event: 'WSOP $25K High Roller',
    buyIn: '$25,000',
    buyInCurrency: 'USD',
    buyInValue: 25000,
    percentOffered: 15,
    percentRemaining: 4,
    markup: 1.12,
    status: 'selling_fast',
    peopleProfileId: 'sk-rabichow',
  },
  {
    id: 'sk-5',
    playerName: 'Maria Ho',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'MH',
    event: 'WPT Championship',
    buyIn: '$10,400',
    buyInCurrency: 'USD',
    buyInValue: 10400,
    percentOffered: 20,
    percentRemaining: 14,
    markup: 1.10,
    status: 'standard',
    peopleProfileId: 'sk-ho',
  },
  {
    id: 'sk-6',
    playerName: 'Martin Jacobson',
    playerDescriptor: 'Professional Poker Player',
    avatarInitials: 'MJ',
    event: 'WSOP $10K Main Event',
    buyIn: '$10,000',
    buyInCurrency: 'USD',
    buyInValue: 10000,
    percentOffered: 20,
    percentRemaining: 7,
    markup: 1.18,
    status: 'featured',
    peopleProfileId: 'sk-jacobson',
  },
];

export const STAKEKINGS_ACTION_LISTINGS: StakeKingsActionListing[] = baseListings.map((l) => {
  const quickOpts = l.percentRemaining >= 5 ? [1, 2.5, 5] : l.percentRemaining >= 2.5 ? [1, 2.5] : [1];
  return {
    ...l,
    quickPercents: quickOpts.map((pct) => ({
      pct,
      price: priceFor(l, pct),
    })),
  };
});

export const STAKEKINGS_SORT_OPTIONS = [
  { id: 'featured', label: 'Featured' },
  { id: 'selling_fast', label: 'Selling Fast' },
  { id: 'lowest_markup', label: 'Lowest Markup' },
  { id: 'highest_buyin', label: 'Highest Buy-In' },
  { id: 'newest', label: 'Newest' },
] as const;

export type StakeKingsSortId = (typeof STAKEKINGS_SORT_OPTIONS)[number]['id'];
