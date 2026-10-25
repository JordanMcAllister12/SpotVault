import { supabase } from '@/lib/supabase';

export interface LoungeTournament {
  id: string;
  lounge_slug: string;
  tournament_name: string | null;
  poker_room: string | null;
  location: string | null;
  operator: string | null;
  event_date: string | null;
  start_time: string | null;
  buy_in: number | null;
  guarantee: number | null;
  game_type: string | null;
  structure_info: string | null;
  registration_status: string | null;
  entrants: number | null;
  players_remaining: number | null;
  current_level: string | null;
  prize_pool: number | null;
  status: string | null;
  last_updated: string;
  created_at: string;
}

export interface LoungeCashGame {
  id: string;
  lounge_slug: string;
  poker_room: string | null;
  location: string | null;
  game: string | null;
  stakes: string | null;
  tables_running: number | null;
  players: number | null;
  open_seats: number | null;
  waitlist: number | null;
  status: string | null;
  starts_at: string | null;
  last_updated: string;
  created_at: string;
}

export async function fetchLoungeTournaments(loungeSlug: string): Promise<LoungeTournament[]> {
  const { data, error } = await supabase
    .from('lounge_tournament_feeds')
    .select('*')
    .eq('lounge_slug', loungeSlug)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as LoungeTournament[];
}

export async function fetchLoungeCashGames(loungeSlug: string): Promise<LoungeCashGame[]> {
  const { data, error } = await supabase
    .from('lounge_cash_game_feeds')
    .select('*')
    .eq('lounge_slug', loungeSlug)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as LoungeCashGame[];
}
