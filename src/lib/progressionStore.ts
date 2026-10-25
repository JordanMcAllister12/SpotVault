import { supabase } from '@/lib/supabase';

export interface PlayerProgression {
  user_id: string;
  total_xp: number;
  current_level: number;
  prestige_class: string;
  lifetime_xp: number;
  updated_at: string;
}

export const XP_PER_LEVEL = 100;
export const MAX_LEVEL = 100;

export const PRESTIGE_CLASSES = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
] as const;

export const PRESTIGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  bronze: { bg: 'rgba(205,127,50,0.15)', text: '#cd7f32', border: 'rgba(205,127,50,0.4)' },
  silver: { bg: 'rgba(192,192,192,0.15)', text: '#c0c0c0', border: 'rgba(192,192,192,0.4)' },
  gold: { bg: 'rgba(212,165,44,0.15)', text: '#d4a52c', border: 'rgba(212,165,44,0.4)' },
  platinum: { bg: 'rgba(229,228,226,0.15)', text: '#e5e4e2', border: 'rgba(229,228,226,0.4)' },
  diamond: { bg: 'rgba(0,191,255,0.15)', text: '#00bfff', border: 'rgba(0,191,255,0.4)' },
};

export function xpForLevel(level: number): number {
  return (level - 1) * XP_PER_LEVEL;
}

export function levelFromXp(totalXp: number): { level: number; prestige: string; remainingXp: number } {
  const xpInCurrentCycle = ((totalXp % (MAX_LEVEL * XP_PER_LEVEL)) + (MAX_LEVEL * XP_PER_LEVEL)) % (MAX_LEVEL * XP_PER_LEVEL);
  const cycleNumber = Math.floor(totalXp / (MAX_LEVEL * XP_PER_LEVEL));
  const level = Math.floor(xpInCurrentCycle / XP_PER_LEVEL) + 1;
  const remainingXp = XP_PER_LEVEL - (xpInCurrentCycle % XP_PER_LEVEL);
  const prestige = PRESTIGE_CLASSES[Math.min(cycleNumber, PRESTIGE_CLASSES.length - 1)];
  return { level: Math.min(level, MAX_LEVEL), prestige, remainingXp };
}

export async function fetchProgression(userId: string): Promise<PlayerProgression | null> {
  const { data, error } = await supabase
    .from('player_progression')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureProgression(userId: string): Promise<PlayerProgression> {
  const existing = await fetchProgression(userId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('player_progression')
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addXp(userId: string, amount: number): Promise<PlayerProgression> {
  const current = await ensureProgression(userId);
  const newTotalXp = current.total_xp + amount;
  const newLifetimeXp = current.lifetime_xp + amount;
  const { level, prestige } = levelFromXp(newTotalXp);

  const { data, error } = await supabase
    .from('player_progression')
    .update({
      total_xp: newTotalXp,
      lifetime_xp: newLifetimeXp,
      current_level: level,
      prestige_class: prestige,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function getProgressInfo(progression: PlayerProgression): {
  level: number;
  prestige: string;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  nextClass: string | null;
} {
  const { level, prestige, remainingXp } = levelFromXp(progression.total_xp);
  const xpInCurrentLevel = XP_PER_LEVEL - remainingXp;
  const progressPct = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const currentClassIndex = PRESTIGE_CLASSES.indexOf(prestige as typeof PRESTIGE_CLASSES[number]);
  const nextClass = currentClassIndex < PRESTIGE_CLASSES.length - 1
    ? PRESTIGE_CLASSES[currentClassIndex + 1]
    : null;

  return {
    level,
    prestige,
    xpInCurrentLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progressPct,
    nextClass,
  };
}
