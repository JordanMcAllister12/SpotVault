import { supabase } from '@/lib/supabase';
import { CREDIT_PRICING, validateCreditQuantity } from '@/lib/creditPricing';

/**
 * Stripe Checkout pages set X-Frame-Options: DENY, so they cannot render
 * inside an iframe (e.g. Bolt's embedded preview). Always open the checkout
 * URL in a new top-level browser tab/window. Falls back to top-level
 * navigation if popup blockers prevent the new tab.
 */
export function openStripeCheckout(url: string): void {
  const newTab = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newTab) {
    window.location.href = url;
  }
}

/**
 * Client-side Stripe checkout service.
 * Calls the server-side edge functions which independently validate quantities
 * and calculate the USD amount. The browser never dictates the charge amount.
 */

export async function createCreditCheckout(quantity: number): Promise<{ url?: string; error?: string }> {
  const validation = validateCreditQuantity(quantity);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { type: 'credits', quantity },
  });

  if (error) return { error: 'Checkout is temporarily unavailable. Please try again shortly.' };
  if (data?.error) return { error: data.error };
  return { url: data?.url };
}

export async function createMembershipCheckout(tier: 'core' | 'elite' | 'pro'): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { type: 'membership', tier },
  });

  if (error) return { error: 'Checkout is temporarily unavailable. Please try again shortly.' };
  if (data?.error) return { error: data.error };
  return { url: data?.url };
}

export { CREDIT_PRICING };
