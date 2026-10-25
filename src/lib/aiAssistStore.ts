import { supabase } from '@/lib/supabase';
import { ENTITLEMENTS, FEATURE_FLAGS, type MembershipTier } from '@/lib/entitlements';

export const AI_ASSIST_PER_SPOT_LIMIT = 2;

export type AIFieldType = 'title' | 'subtitle' | 'introduction' | 'hand_details' | 'content' | 'tags';

export interface AIAssistUsage {
  spotUsed: number;
  spotRemaining: number;
  weekUsed: number;
  weekRemaining: number;
  weeklyLimit: number;
  canUse: boolean;
  upgradeMessage: string | null;
}

export interface SpotContext {
  title: string;
  subtitle: string | null;
  introduction: string | null;
  hand_details: string | null;
  content_html: string;
  tags: Record<string, string>;
  source: string;
}

/** Fetch current AI Assist usage for a spot + user's weekly count. */
export async function fetchAIAssistUsage(
  spotId: string,
  userId: string,
  tier: MembershipTier = 'free',
): Promise<AIAssistUsage> {
  const entitlements = ENTITLEMENTS[tier];
  const weeklyLimit = entitlements.aiAssistsWeekly;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [spotRes, weekRes] = await Promise.all([
    supabase
      .from('ai_assist_usage')
      .select('id', { count: 'exact', head: true })
      .eq('spot_id', spotId),
    supabase
      .from('ai_assist_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneWeekAgo),
  ]);

  const spotUsed = spotRes.count ?? 0;
  const weekUsed = weekRes.count ?? 0;

  const canUse = FEATURE_FLAGS.aiAssistEnabled && weeklyLimit > 0 && weekUsed < weeklyLimit;
  const upgradeMessage = !FEATURE_FLAGS.aiAssistEnabled
    ? 'AI Assist is coming soon.'
    : weeklyLimit === 0
    ? 'AI Assist is available with Core, Pro, or Elite.'
    : null;

  return {
    spotUsed,
    spotRemaining: Math.max(0, AI_ASSIST_PER_SPOT_LIMIT - spotUsed),
    weekUsed,
    weekRemaining: Math.max(0, weeklyLimit - weekUsed),
    weeklyLimit,
    canUse,
    upgradeMessage,
  };
}

/** Record a successful AI Assist generation. Returns true if inserted. */
export async function recordAIAssistUsage(spotId: string, userId: string, fieldType: AIFieldType): Promise<boolean> {
  const { error } = await supabase
    .from('ai_assist_usage')
    .insert({ spot_id: spotId, user_id: userId, field_type: fieldType });
  return !error;
}

/** Call the edge function to generate an AI suggestion. */
export async function generateAIAssist(
  fieldType: AIFieldType,
  context: SpotContext,
  currentText: string,
): Promise<{ suggestion: string; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assist', {
      body: { fieldType, context, currentText },
    });

    if (error) {
      return { suggestion: '', error: 'AI Assist couldn\'t generate a response. Try again.' };
    }

    const result = data as { suggestion?: string; error?: string };
    if (result.error) {
      return { suggestion: '', error: result.error };
    }
    if (!result.suggestion) {
      return { suggestion: '', error: 'AI Assist couldn\'t generate a response. Try again.' };
    }

    return { suggestion: result.suggestion, error: null };
  } catch {
    return { suggestion: '', error: 'AI Assist couldn\'t generate a response. Try again.' };
  }
}

/** Check if there's enough context for AI to generate a meaningful suggestion. */
export function hasEnoughContext(context: SpotContext, fieldType: AIFieldType): boolean {
  const hasTitle = context.title.trim().length > 0;
  const hasSubtitle = context.subtitle?.trim().length > 0;
  const hasHand = context.hand_details?.trim().length > 0;
  const hasIntro = context.introduction?.trim().length > 0;

  if (fieldType === 'title') return hasHand || hasIntro || hasSubtitle;
  if (fieldType === 'subtitle') return hasTitle || hasHand;
  if (fieldType === 'introduction') return hasTitle || hasHand;
  if (fieldType === 'hand_details') return hasTitle || hasSubtitle;
  if (fieldType === 'content') return hasTitle || hasHand || hasIntro;
  if (fieldType === 'tags') return hasTitle || hasHand || hasIntro;
  return false;
}

/** Build the context-missing message for a field. */
export function getMissingContextMessage(fieldType: AIFieldType): string {
  if (fieldType === 'introduction') return 'Add the hand scenario or title first so AI Assist has enough context.';
  if (fieldType === 'content') return 'Add the title and hand details first so AI Assist has enough context.';
  if (fieldType === 'tags') return 'Add a title or hand details first so AI Assist can suggest relevant tags.';
  if (fieldType === 'title') return 'Add the hand scenario first so AI Assist has enough context.';
  if (fieldType === 'subtitle') return 'Add a title first so AI Assist has enough context.';
  return 'Add more spot details first so AI Assist has enough context.';
}
