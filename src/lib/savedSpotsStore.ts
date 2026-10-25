import { supabase } from './supabase';

export interface SavedSpot {
  id: string;
  spot_id: string;
  saved_at: string;
  expires_at: string | null;
}

export async function saveSpot(
  userId: string,
  spotId: string,
  duration: '30days' | 'forever'
): Promise<SavedSpot | null> {
  const expiresAt =
    duration === '30days'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data, error } = await supabase
    .from('user_saved_spots')
    .upsert(
      {
        user_id: userId,
        spot_id: spotId,
        saved_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: 'user_id,spot_id' }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('saveSpot error:', error.message);
    return null;
  }
  return data as SavedSpot | null;
}

export async function unsaveSpot(userId: string, spotId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_saved_spots')
    .delete()
    .eq('user_id', userId)
    .eq('spot_id', spotId);
  if (error) {
    console.error('unsaveSpot error:', error.message);
    return false;
  }
  return true;
}

export async function changeSaveDuration(
  userId: string,
  spotId: string,
  duration: '30days' | 'forever'
): Promise<boolean> {
  const expiresAt =
    duration === '30days'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase
    .from('user_saved_spots')
    .update({ expires_at: expiresAt, saved_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('spot_id', spotId);

  if (error) {
    console.error('changeSaveDuration error:', error.message);
    return false;
  }
  return true;
}

export async function fetchSavedSpots(userId: string): Promise<SavedSpot[]> {
  const { data, error } = await supabase
    .from('user_saved_spots')
    .select('id, spot_id, saved_at, expires_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('fetchSavedSpots error:', error.message);
    return [];
  }
  return (data || []) as SavedSpot[];
}

export async function fetchSavedSpotIds(userId: string): Promise<Set<string>> {
  const saved = await fetchSavedSpots(userId);
  return new Set(saved.map((s) => s.spot_id));
}

export async function checkSpotSaved(
  userId: string,
  spotId: string
): Promise<SavedSpot | null> {
  const { data, error } = await supabase
    .from('user_saved_spots')
    .select('id, spot_id, saved_at, expires_at')
    .eq('user_id', userId)
    .eq('spot_id', spotId)
    .maybeSingle();

  if (error) {
    console.error('checkSpotSaved error:', error.message);
    return null;
  }
  return data as SavedSpot | null;
}

export function isSaveExpired(saved: SavedSpot): boolean {
  if (!saved.expires_at) return false;
  return new Date(saved.expires_at).getTime() < Date.now();
}

export function daysRemaining(saved: SavedSpot): number | null {
  if (!saved.expires_at) return null;
  const ms = new Date(saved.expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function formatSavedExpiry(saved: SavedSpot): string {
  const days = daysRemaining(saved);
  if (days === null) return 'Saved forever';
  if (days === 0) return 'Expires today';
  return `Saved \u2022 ${days} day${days === 1 ? '' : 's'} remaining`;
}
