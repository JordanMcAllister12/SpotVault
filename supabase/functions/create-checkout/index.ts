import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") || "https://thespotvault.com";

  if (!stripeSecretKey) {
    return json({ error: "Stripe is not configured. Payment processing is unavailable." }, 503);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function getCreditPricingConfig(): Promise<{
    usd_per_credit: number;
    credits_per_usd: number;
    stripe_cents_per_credit: number;
    min_purchase_credits: number;
    max_purchase_credits: number;
    currency: string;
  }> {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "credit_pricing")
      .single();
    if (error || !data) {
      return {
        usd_per_credit: 0.10,
        credits_per_usd: 10,
        stripe_cents_per_credit: 10,
        min_purchase_credits: 1,
        max_purchase_credits: 100000,
        currency: "USD",
      };
    }
    return data.value as any;
  }

  async function resolveMembershipPrice(configuredId: string, expectedAmountCents: number): Promise<string> {
    if (configuredId.startsWith("price_")) {
      const price = await stripe.prices.retrieve(configuredId);
      if (!price.active || price.type !== "recurring") {
        throw new Error("Configured membership price is inactive or not recurring");
      }
      if (price.unit_amount !== expectedAmountCents) {
        throw new Error("Configured membership price amount does not match the tier");
      }
      return price.id;
    }

    if (!configuredId.startsWith("prod_")) {
      throw new Error("Configured membership billing reference is invalid");
    }

    const product = await stripe.products.retrieve(configuredId);
    const defaultPriceId = typeof product.default_price === "string"
      ? product.default_price
      : product.default_price?.id;

    if (defaultPriceId) {
      const defaultPrice = await stripe.prices.retrieve(defaultPriceId);
      if (defaultPrice.active && defaultPrice.type === "recurring" && defaultPrice.unit_amount === expectedAmountCents) {
        return defaultPrice.id;
      }
    }

    const prices = await stripe.prices.list({
      product: configuredId,
      active: true,
      type: "recurring",
      limit: 10,
    });
    const matchingPrice = prices.data.find((price) => price.unit_amount === expectedAmountCents);
    if (!matchingPrice) {
      throw new Error("No active recurring price matches the membership tier");
    }
    return matchingPrice.id;
  }

  async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    const { data: existing } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (existing) return existing.stripe_customer_id;

    const customer = await stripe.customers.create({
      email,
      metadata: { spotvault_user_id: userId },
    });

    await supabase.from("stripe_customers").insert({
      stripe_customer_id: customer.id,
      user_id: userId,
    });

    return customer.id;
  }

  async function getUserAttribution(userId: string): Promise<{ attribution_id: string | null; deal_id: string | null; group_code: string | null }> {
    const { data } = await supabase
      .from("sv_attribution_records")
      .select("attribution_id, deal_id, group_code")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return {
      attribution_id: data?.attribution_id ?? null,
      deal_id: data?.deal_id ?? null,
      group_code: data?.group_code ?? null,
    };
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Invalid authentication." }, 401);

    // ── Route ──────────────────────────────────────────────────────────────────

    const body = await req.json();
    const { type } = body;
    if (type === "credits") {
      const { quantity } = body;
      if (!Number.isInteger(quantity) || quantity < 1) {
        return json({ error: "Invalid credit quantity. Must be a positive integer." }, 400);
      }

      const pricing = await getCreditPricingConfig();

      if (quantity < pricing.min_purchase_credits || quantity > pricing.max_purchase_credits) {
        return json({
          error: `Quantity must be between ${pricing.min_purchase_credits} and ${pricing.max_purchase_credits.toLocaleString()} credits.`,
        }, 400);
      }

      const amountCents = quantity * pricing.stripe_cents_per_credit;

      const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? "");
      const attribution = await getUserAttribution(user.id);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{
          price_data: {
            currency: pricing.currency.toLowerCase(),
            product_data: {
              name: `${quantity} SpotVault Credits`,
              metadata: { type: "credit_purchase", credit_quantity: String(quantity) },
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        metadata: {
          spotvault_user_id: user.id,
          purchase_type: "credits",
          credit_quantity: String(quantity),
          attribution_id: attribution.attribution_id ?? "",
          deal_id: attribution.deal_id ?? "",
          group_code: attribution.group_code ?? "",
        },
        success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
      });

      await supabase.from("stripe_checkout_sessions").insert({
        stripe_session_id: session.id,
        user_id: user.id,
        purchase_type: "credits",
        credit_quantity: quantity,
        amount_cents: amountCents,
        currency: pricing.currency,
        status: "pending",
        attribution_id: attribution.attribution_id,
        deal_id: attribution.deal_id,
        group_code: attribution.group_code,
      });

      return json({ url: session.url });
    }

    if (type === "membership") {
      const { tier } = body;
      if (!tier || !["core", "elite", "pro"].includes(tier)) {
        return json({ error: "Invalid membership tier." }, 400);
      }

      const { data: tierRow, error: tierError } = await supabase
        .from("membership_tiers")
        .select("id, name, stripe_price_id, monthly_price_cents")
        .eq("id", tier)
        .single();

      if (tierError || !tierRow) {
        return json({ error: "Membership tier not found." }, 404);
      }

      if (!tierRow.stripe_price_id) {
        return json({ error: "This membership tier is not yet configured for payment." }, 503);
      }

      const resolvedPriceId = await resolveMembershipPrice(
        tierRow.stripe_price_id,
        tierRow.monthly_price_cents,
      );
      const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? "");
      const attribution = await getUserAttribution(user.id);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        metadata: {
          spotvault_user_id: user.id,
          purchase_type: "membership",
          membership_tier: tier,
          stripe_price_id: resolvedPriceId,
          attribution_id: attribution.attribution_id ?? "",
          deal_id: attribution.deal_id ?? "",
          group_code: attribution.group_code ?? "",
        },
        subscription_data: {
          metadata: {
            spotvault_user_id: user.id,
            membership_tier: tier,
            stripe_price_id: resolvedPriceId,
          },
        },
        success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?checkout=cancelled`,
      });

      await supabase.from("stripe_checkout_sessions").insert({
        stripe_session_id: session.id,
        user_id: user.id,
        purchase_type: "membership",
        membership_tier: tier,
        stripe_price_id: resolvedPriceId,
        amount_cents: tierRow.monthly_price_cents,
        currency: "USD",
        status: "pending",
        attribution_id: attribution.attribution_id,
        deal_id: attribution.deal_id,
        group_code: attribution.group_code,
      });

      return json({ url: session.url });
    }

    if (type === "portal") {
      return json({ error: "Professional portal purchases are not available yet. Coming soon." }, 503);
    }

    if (type === "manage-billing") {
      const { subscriptionId } = body;
      if (!subscriptionId) {
        return json({ error: "Subscription ID is required for billing management." }, 400);
      }

      // Retrieve the subscription to get the customer
      const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
      const customerId = subscription.customer as string;

      // Verify this subscription belongs to the authenticated user
      const { data: customerRecord } = await supabase
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerRecord || customerRecord.user_id !== user.id) {
        return json({ error: "You do not have access to this subscription." }, 403);
      }

      // Create a Stripe Billing Portal session so the user can manage
      // their subscription, update payment methods, and cancel/reactivate
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/?billing=returned`,
      });

      return json({ url: portalSession.url });
    }

    return json({ error: "Unknown checkout type. Use 'credits', 'membership', or 'manage-billing'." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown checkout error";
    console.error("Checkout error:", { message, operation: "create_checkout_session" });
    return json({ error: "Checkout is temporarily unavailable. Please try again shortly." }, 500);
  }
});
