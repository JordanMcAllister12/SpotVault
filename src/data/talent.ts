export type TalentCategory =
  | 'POKER_PRO' | 'COACH' | 'CREATOR' | 'MEDIA' | 'COMMENTATOR' | 'INDUSTRY_EXPERT';

export type ServiceType =
  | 'PRIVATE_MESSAGE' | 'CALL_15' | 'VIDEO_30' | 'VIDEO_60'
  | 'HAND_HISTORY_REVIEW' | 'TOURNAMENT_REVIEW' | 'DATABASE_REVIEW'
  | 'STRATEGY_SESSION' | 'CAREER_CONSULTATION' | 'BUSINESS_CONSULTATION'
  | 'MEDIA_APPEARANCE' | 'CUSTOM_REQUEST';

export interface TalentService {
  id: string;
  talentId: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCredits: number;
  type: ServiceType;
  includesMessaging: boolean;
  allowsFileUpload: boolean;
  sharesSpotVaultTools: boolean;
  cancellationHours: number;
  leadTimeHours: number;
  maxPerDay: number;
  maxPerWeek: number;
  isActive: boolean;
}

export interface TalentReview {
  id: string;
  talentId: string;
  authorName: string;
  rating: number;
  comment: string;
  sessionId: string;
  date: string;
}

export interface TalentProfile {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  category: TalentCategory;
  specialties: string[];
  gameTypes: string[];
  bio: string;
  credentials: string[];
  accomplishments: string[];
  photoInitials: string;
  coverGradient: string;
  verified: boolean;
  responseTimeHours: number;
  completedSessions: number;
  rating: number;
  reviewCount: number;
  fromPriceCredits: number;
  availabilityHoursPerWeek: number;
  timezone: string;
  availableDays: string[];
  availableHours: { start: string; end: string };
  minNoticeHours: number;
  bufferMinutes: number;
  maxDailyBookings: number;
  vacationDates: string[];
  postSessionChatDays: number;
}

export type BookingStatus =
  | 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'PAYOUT_ELIGIBLE' | 'PAID';

export interface Booking {
  id: string;
  talentId: string;
  talentName: string;
  buyerName: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  priceCredits: number;
  platformFeeCredits: number;
  talentEarningsCredits: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  status: BookingStatus;
  createdAt: string;
}

export const TALENT_PROFILES: TalentProfile[] = [];

export const TALENT_SERVICES: TalentService[] = [];

export const TALENT_REVIEWS: TalentReview[] = [];

export const DEMO_BOOKINGS: Booking[] = [];

export const CATEGORY_LABELS: Record<TalentCategory, string> = {
  POKER_PRO: 'Poker Pro',
  COACH: 'Coach',
  CREATOR: 'Creator',
  MEDIA: 'Media',
  COMMENTATOR: 'Commentator',
  INDUSTRY_EXPERT: 'Industry Expert',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  PRIVATE_MESSAGE: 'Private Message',
  CALL_15: '15 Minute Call',
  VIDEO_30: '30 Minute Video Call',
  VIDEO_60: '60 Minute Video Session',
  HAND_HISTORY_REVIEW: 'Hand History Review',
  TOURNAMENT_REVIEW: 'Tournament Review',
  DATABASE_REVIEW: 'Database / Analytics Review',
  STRATEGY_SESSION: 'Strategy Session',
  CAREER_CONSULTATION: 'Career Consultation',
  BUSINESS_CONSULTATION: 'Business Consultation',
  MEDIA_APPEARANCE: 'Media / Interview Appearance',
  CUSTOM_REQUEST: 'Custom Request',
};

export const PLATFORM_FEE_RATE = 0.20;

export function calculateEarnings(priceCredits: number): { fee: number; earnings: number } {
  const fee = Math.round(priceCredits * PLATFORM_FEE_RATE);
  return { fee, earnings: priceCredits - fee };
}

export function getTalentById(id: string): TalentProfile | undefined {
  return TALENT_PROFILES.find((t) => t.id === id);
}

export function getServicesByTalent(talentId: string): TalentService[] {
  return TALENT_SERVICES.filter((s) => s.talentId === talentId && s.isActive);
}

export function getReviewsByTalent(talentId: string): TalentReview[] {
  return TALENT_REVIEWS.filter((r) => r.talentId === talentId);
}
