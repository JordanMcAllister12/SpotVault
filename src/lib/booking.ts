import { supabase } from '@/lib/supabase';

// ============================================================
// Types matching the database schema
// ============================================================

export type BookingCategory =
  | 'COACH' | 'CREATOR' | 'POKER_PRO' | 'BUSINESS' | 'INVESTOR' | 'INDUSTRY_EXPERT' | 'MEDIA';

export type BookingMode = 'paid' | 'meeting_requests' | 'both';

export type ServiceType =
  | 'COACHING' | 'STRATEGY_SESSION' | 'CAREER_ADVICE' | 'BUSINESS_CONSULTATION'
  | 'INDUSTRY_NETWORKING' | 'CONTENT_COLLABORATION' | 'PRIVATE_CONVERSATION'
  | 'VIDEO_CALL' | 'VOICE_CALL' | 'TEXT_CHAT' | 'CUSTOM_SESSION'
  | 'HAND_HISTORY_REVIEW' | 'TOURNAMENT_REVIEW' | 'DATABASE_REVIEW'
  | 'MEDIA_APPEARANCE' | 'SWEAT_SESSION';

export type BookingStatus =
  | 'requested' | 'pending' | 'confirmed' | 'declined'
  | 'cancelled' | 'completed' | 'expired' | 'reschedule_requested';

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'n/a';

export type RequestType = 'paid' | 'meeting_request';

export type EligibilityRole =
  | 'coach' | 'creator' | 'pro' | 'business' | 'investor'
  | 'industry_executive' | 'admin_authorized';

export interface BookingProvider {
  id: string;
  account_id: string;
  display_name: string;
  title: string | null;
  subtitle: string | null;
  category: string;
  bio: string | null;
  photo_initials: string;
  verified: boolean;
  is_available: boolean;
  booking_mode: string;
  response_time_hours: number;
  timezone: string;
  min_notice_hours: number;
  max_advance_days: number;
  max_daily_bookings: number;
  max_weekly_bookings: number;
  booking_notes: string | null;
  eligibility_role: string;
  specialties: string[];
  game_types: string[];
  completed_sessions: number;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface BookingService {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  service_type: string;
  duration_minutes: number;
  price_credits: number;
  is_active: boolean;
  includes_messaging: boolean;
  allows_file_upload: boolean;
  cancellation_hours: number;
  lead_time_hours: number;
  max_per_day: number;
  max_per_week: number;
  created_at: string;
  updated_at: string;
}

export interface BookingTimeSlot {
  id: string;
  provider_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  is_blackout: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  provider_account_id: string;
  requester_account_id: string;
  provider_id: string | null;
  service_id: string | null;
  service_name: string | null;
  service_type: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  price_credits: number;
  platform_fee_credits: number;
  provider_payout_credits: number;
  payment_status: string;
  booking_status: string;
  request_type: string;
  message: string | null;
  company: string | null;
  suggested_new_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingSettings {
  id: string;
  platform_fee_rate: number;
  provider_approval_required: boolean;
  allow_free_requests: boolean;
  min_booking_price_credits: number;
  max_booking_price_credits: number;
}

export interface BookingProviderApproval {
  id: string;
  account_id: string;
  display_name: string;
  username: string | null;
  email: string | null;
  categories: string[];
  approved_by: string | null;
  approved_at: string;
  status: string;
  revoked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Constants
// ============================================================

export const CATEGORY_LABELS: Record<string, string> = {
  COACH: 'Coach',
  CREATOR: 'Creator',
  POKER_PRO: 'Poker Pro',
  BUSINESS: 'Business',
  INVESTOR: 'Investor',
  INDUSTRY_EXPERT: 'Industry Executive',
  MEDIA: 'Media',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  COACHING: 'Coaching',
  STRATEGY_SESSION: 'Strategy Session',
  CAREER_ADVICE: 'Career Advice',
  BUSINESS_CONSULTATION: 'Business Consultation',
  INDUSTRY_NETWORKING: 'Industry Networking',
  CONTENT_COLLABORATION: 'Content Collaboration',
  PRIVATE_CONVERSATION: 'Private Conversation',
  VIDEO_CALL: 'Video Call',
  VOICE_CALL: 'Voice Call',
  TEXT_CHAT: 'Text Chat',
  CUSTOM_SESSION: 'Custom Session',
  HAND_HISTORY_REVIEW: 'Hand History Review',
  TOURNAMENT_REVIEW: 'Tournament Review',
  DATABASE_REVIEW: 'Database Review',
  MEDIA_APPEARANCE: 'Media Appearance',
  SWEAT_SESSION: 'Sweat Session',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
  expired: 'Expired',
  reschedule_requested: 'Reschedule Requested',
};

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_PLATFORM_FEE_RATE = 0.20;

// ============================================================
// Helper functions
// ============================================================

export function calculateFees(priceCredits: number, feeRate: number = DEFAULT_PLATFORM_FEE_RATE) {
  const fee = Math.round(priceCredits * feeRate);
  return {
    fee,
    payout: priceCredits - fee,
  };
}

export function formatPrice(credits: number): string {
  if (credits === 0) return 'Free';
  return `${credits.toLocaleString()} credits`;
}

export function formatTimeInZone(isoString: string, timezone?: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    });
  } catch {
    return isoString;
  }
}

export function formatDateInZone(isoString: string, timezone?: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone || undefined,
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  return `${formatDateInZone(isoString)} · ${formatTimeInZone(isoString)}`;
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function toIsoLocal(date: Date): string {
  return date.toISOString();
}

export function makeIsoFromLocal(dateStr: string, timeStr: string): string {
  // dateStr: 'YYYY-MM-DD', timeStr: 'HH:MM'
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return d.toISOString();
}

// ============================================================
// Data access functions
// ============================================================

export async function fetchAvailableProviders(filters?: {
  category?: string;
  availableToday?: boolean;
  freeRequestsOnly?: boolean;
  paidOnly?: boolean;
}): Promise<BookingProvider[]> {
  // First fetch all active provider approvals
  const { data: approvals, error: approvalError } = await supabase
    .from('booking_provider_approvals')
    .select('account_id')
    .eq('status', 'active');
  if (approvalError) {
    console.error('fetchAvailableProviders approval error:', approvalError);
    return [];
  }
  const approvedIds = new Set((approvals || []).map((a: { account_id: string }) => a.account_id));
  if (approvedIds.size === 0) return [];

  let query = supabase
    .from('booking_providers')
    .select('*')
    .eq('is_available', true)
    .in('account_id', Array.from(approvedIds));

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query.order('rating', { ascending: false });
  if (error) {
    console.error('fetchAvailableProviders error:', error);
    return [];
  }

  let providers = data as BookingProvider[];

  if (filters?.freeRequestsOnly) {
    providers = providers.filter((p) => p.booking_mode === 'meeting_requests' || p.booking_mode === 'both');
  }
  if (filters?.paidOnly) {
    providers = providers.filter((p) => p.booking_mode === 'paid' || p.booking_mode === 'both');
  }

  return providers;
}

export async function fetchProviderByAccountId(accountId: string): Promise<BookingProvider | null> {
  const { data, error } = await supabase
    .from('booking_providers')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) {
    console.error('fetchProviderByAccountId error:', error);
    return null;
  }
  return data as BookingProvider | null;
}

export async function fetchProviderById(id: string): Promise<BookingProvider | null> {
  const { data, error } = await supabase
    .from('booking_providers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('fetchProviderById error:', error);
    return null;
  }
  return data as BookingProvider | null;
}

export async function fetchServicesByProvider(providerId: string): Promise<BookingService[]> {
  const { data, error } = await supabase
    .from('booking_services')
    .select('*')
    .eq('provider_id', providerId)
    .eq('is_active', true)
    .order('price_credits', { ascending: true });
  if (error) {
    console.error('fetchServicesByProvider error:', error);
    return [];
  }
  return data as BookingService[];
}

export async function fetchTimeSlotsByProvider(providerId: string): Promise<BookingTimeSlot[]> {
  const { data, error } = await supabase
    .from('booking_time_slots')
    .select('*')
    .eq('provider_id', providerId)
    .order('day_of_week', { ascending: true, nullsFirst: false });
  if (error) {
    console.error('fetchTimeSlotsByProvider error:', error);
    return [];
  }
  return data as BookingTimeSlot[];
}

export async function fetchBookingsForUser(accountId: string): Promise<Booking[]> {
  // Fetch where user is either provider or requester
  const [providerResult, requesterResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('*')
      .eq('provider_account_id', accountId)
      .order('start_time', { ascending: true }),
    supabase
      .from('bookings')
      .select('*')
      .eq('requester_account_id', accountId)
      .order('start_time', { ascending: true }),
  ]);

  if (providerResult.error) console.error('fetchBookings provider error:', providerResult.error);
  if (requesterResult.error) console.error('fetchBookings requester error:', requesterResult.error);

  const providerBookings = (providerResult.data as Booking[]) || [];
  const requesterBookings = (requesterResult.data as Booking[]) || [];

  // Merge and dedupe
  const allMap = new Map<string, Booking>();
  for (const b of [...providerBookings, ...requesterBookings]) {
    allMap.set(b.id, b);
  }

  return Array.from(allMap.values()).sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

export async function fetchBookingSettings(): Promise<BookingSettings | null> {
  const { data, error } = await supabase
    .from('booking_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('fetchBookingSettings error:', error);
    return null;
  }
  return data as BookingSettings | null;
}

// ============================================================
// Mutation functions
// ============================================================

export async function upsertProvider(
  provider: Partial<BookingProvider> & { account_id: string; display_name: string }
): Promise<BookingProvider | null> {
  const { data, error } = await supabase
    .from('booking_providers')
    .upsert(provider, { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('upsertProvider error:', error);
    return null;
  }
  return data as BookingProvider | null;
}

export async function addService(
  service: Omit<BookingService, 'id' | 'created_at' | 'updated_at'>
): Promise<BookingService | null> {
  const { data, error } = await supabase
    .from('booking_services')
    .insert(service)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('addService error:', error);
    return null;
  }
  return data as BookingService | null;
}

export async function updateService(
  id: string,
  patch: Partial<BookingService>
): Promise<BookingService | null> {
  const { data, error } = await supabase
    .from('booking_services')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('updateService error:', error);
    return null;
  }
  return data as BookingService | null;
}

export async function deleteService(id: string): Promise<boolean> {
  const { error } = await supabase.from('booking_services').delete().eq('id', id);
  if (error) {
    console.error('deleteService error:', error);
    return false;
  }
  return true;
}

export async function addTimeSlot(
  slot: Omit<BookingTimeSlot, 'id' | 'created_at'>
): Promise<BookingTimeSlot | null> {
  const { data, error } = await supabase
    .from('booking_time_slots')
    .insert(slot)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('addTimeSlot error:', error);
    return null;
  }
  return data as BookingTimeSlot | null;
}

export async function deleteTimeSlot(id: string): Promise<boolean> {
  const { error } = await supabase.from('booking_time_slots').delete().eq('id', id);
  if (error) {
    console.error('deleteTimeSlot error:', error);
    return false;
  }
  return true;
}

export async function createBooking(
  booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>
): Promise<{ booking: Booking | null; error: string | null }> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select('*')
    .maybeSingle();
  if (error) {
    // Check for double-booking constraint violation
    if (error.code === '23RRN' || error.message.includes('prevent_double_booking') || error.message.includes('EXCLUDE')) {
      return { booking: null, error: 'This time slot is already booked. Please choose another time.' };
    }
    console.error('createBooking error:', error);
    return { booking: null, error: error.message };
  }
  return { booking: data as Booking, error: null };
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  suggestedNewTime?: string
): Promise<Booking | null> {
  const patch: Record<string, unknown> = { booking_status: status };
  if (suggestedNewTime) patch.suggested_new_time = suggestedNewTime;
  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('updateBookingStatus error:', error);
    return null;
  }
  return data as Booking | null;
}

// ============================================================
// Provider Approval functions
// ============================================================

export async function checkProviderApproval(accountId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_booking_provider', { p_account_id: accountId });
  if (error) {
    console.error('checkProviderApproval error:', error);
    return false;
  }
  return data === true;
}

export async function fetchAllApprovedProviders(): Promise<BookingProviderApproval[]> {
  const { data, error } = await supabase
    .from('booking_provider_approvals')
    .select('*')
    .order('approved_at', { ascending: false });
  if (error) {
    console.error('fetchAllApprovedProviders error:', error);
    return [];
  }
  return data as BookingProviderApproval[];
}

export async function fetchApprovalByAccountId(accountId: string): Promise<BookingProviderApproval | null> {
  const { data, error } = await supabase
    .from('booking_provider_approvals')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) {
    console.error('fetchApprovalByAccountId error:', error);
    return null;
  }
  return data as BookingProviderApproval | null;
}

export async function approveProvider(
  accountId: string,
  displayName: string,
  username?: string,
  email?: string,
  categories?: string[],
  approvedBy?: string,
  notes?: string
): Promise<BookingProviderApproval | null> {
  const { data, error } = await supabase
    .from('booking_provider_approvals')
    .upsert({
      account_id: accountId,
      display_name: displayName,
      username: username || null,
      email: email || null,
      categories: categories || [],
      approved_by: approvedBy || null,
      status: 'active',
      revoked_at: null,
      notes: notes || null,
    }, { onConflict: 'account_id' })
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('approveProvider error:', error);
    return null;
  }
  return data as BookingProviderApproval | null;
}

export async function revokeProviderApproval(accountId: string): Promise<boolean> {
  const { error } = await supabase
    .from('booking_provider_approvals')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);
  if (error) {
    console.error('revokeProviderApproval error:', error);
    return false;
  }
  return true;
}

// ============================================================
// Next Available computation
// ============================================================

/**
 * Compute the next available time slot for a provider based on their
 * recurring and one-time availability slots, excluding any that overlap
 * with existing confirmed/pending bookings.
 *
 * Returns a human-readable string like "Wed 6:00 PM" or null if no
 * availability in the next 14 days.
 */
export async function computeNextAvailable(providerId: string, timezone?: string): Promise<string | null> {
  const [slots, bookings] = await Promise.all([
    fetchTimeSlotsByProvider(providerId),
    supabase
      .from('bookings')
      .select('start_time, end_time, booking_status')
      .eq('provider_id', providerId)
      .in('booking_status', ['confirmed', 'pending'])
      .order('start_time', { ascending: true }),
  ]);

  const bookedIntervals: { start: Date; end: Date }[] = (bookings.data || [])
    .map((b: { start_time: string; end_time: string }) => ({
      start: new Date(b.start_time),
      end: new Date(b.end_time),
    }));

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 14);

  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dow = date.getDay();
    const dateStr = date.toISOString().slice(0, 10);

    const daySlots = slots.filter((s) => {
      if (s.is_blackout) return false;
      if (s.specific_date) return s.specific_date === dateStr;
      if (s.day_of_week !== null && s.is_recurring) return s.day_of_week === dow;
      return false;
    });

    const dayBlackouts = slots.filter((s) => {
      if (!s.is_blackout) return false;
      if (s.specific_date) return s.specific_date === dateStr;
      if (s.day_of_week !== null && s.is_recurring) return s.day_of_week === dow;
      return false;
    });

    if (dayBlackouts.length > 0 && daySlots.length === 0) continue;

    for (const slot of daySlots) {
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(sh, sm, 0, 0);
      const [eh, em] = slot.end_time.split(':').map(Number);
      const slotEnd = new Date(date);
      slotEnd.setHours(eh, em, 0, 0);

      if (slotEnd <= now) continue;
      if (slotStart < now) {
        // Check if the remaining portion is at least 30 min
        if (slotEnd.getTime() - now.getTime() < 30 * 60 * 1000) continue;
      }

      const overlaps = bookedIntervals.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );
      if (!overlaps) {
        const displayDate = slotStart < now ? now : slotStart;
        try {
          return displayDate.toLocaleDateString('en-US', {
            weekday: 'short',
            timeZone: timezone || undefined,
          }) + ' ' + displayDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone || undefined,
          });
        } catch {
          return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${slot.start_time}`;
        }
      }
    }
  }

  return null;
}
