/**
 * Centralized credit pricing module.
 * Single source of truth for credit-to-USD conversion across the entire app.
 *
 * Permanent base rule:
 *   1 credit = $0.10 USD
 *   10 credits = $1.00 USD
 *   stripe_amount_cents = credit_quantity × 10
 *
 * The server (edge function) is authoritative — it independently calculates
 * the USD amount from the credit quantity. The browser must never dictate
 * the charge amount.
 */

export const CREDIT_PRICING = {
  usdPerCredit: 0.10,
  creditsPerUsd: 10,
  stripeCentsPerCredit: 10,
  minPurchaseCredits: 1,
  maxPurchaseCredits: 100000,
  currency: 'USD' as const,
} as const;

/** Convert credits to USD (display only — server is authoritative for charges) */
export function creditsToUsd(credits: number): number {
  return credits * CREDIT_PRICING.usdPerCredit;
}

/** Convert USD to credits (display only) */
export function usdToCredits(usd: number): number {
  return Math.floor(usd * CREDIT_PRICING.creditsPerUsd);
}

/** Convert credits to Stripe amount in integer cents (for payment calculations) */
export function creditsToStripeCents(credits: number): number {
  return credits * CREDIT_PRICING.stripeCentsPerCredit;
}

/** Format credits as a USD string for display */
export function formatCreditsAsUsd(credits: number): string {
  return `$${creditsToUsd(credits).toFixed(2)}`;
}

/** Validate a credit purchase quantity */
export function validateCreditQuantity(quantity: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Credit quantity must be a whole number.' };
  }
  if (quantity < CREDIT_PRICING.minPurchaseCredits) {
    return { valid: false, error: `Minimum purchase is ${CREDIT_PRICING.minPurchaseCredits} credit.` };
  }
  if (quantity > CREDIT_PRICING.maxPurchaseCredits) {
    return { valid: false, error: `Maximum purchase is ${CREDIT_PRICING.maxPurchaseCredits.toLocaleString()} credits.` };
  }
  return { valid: true };
}
