import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!stripeSecretKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: "Stripe webhook not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  // ── Signature verification ─────────────────────────────────────────────────

  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // ── Idempotency check ──────────────────────────────────────────────────────

  try {
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id, status")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      return new Response(JSON.stringify({ received: true, duplicate: true, status: existingEvent.status }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  } catch (idempotencyErr) {
    console.error("Idempotency check failed:", (idempotencyErr as Error).message);
    return new Response(JSON.stringify({ error: "Idempotency check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // ── Event processing ───────────────────────────────────────────────────────

  async function logEvent(status: "processed" | "failed" | "ignored", svTransactionId?: string, errorMessage?: string) {
    await supabase.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      status,
      sv_transaction_id: svTransactionId ?? null,
      payload: event as any,
      error_message: errorMessage ?? null,
    });
  }

  async function generateTransactionId(): Promise<string> {
    const { data } = await supabase.rpc("sv_generate_transaction_id");
    return data ?? `TXN-${Date.now()}`;
  }

  async function issueCredits(userId: string, quantity: number, stripeRef: string, amountCents: number, attribution: { attribution_id: string | null; deal_id: string | null; group_code: string | null }) {
    const txnId = await generateTransactionId();
    const { error: txnError } = await supabase.from("sv_transactions").insert({
      transaction_id: txnId,
      type_code: "CRD",
      user_id: userId,
      gross_amount: amountCents / 100,
      credit_amount: quantity,
      currency: "USD",
      payment_status: "complete",
      payment_provider_ref: stripeRef,
      attribution_id: attribution.attribution_id,
      deal_id: attribution.deal_id,
      group_code: attribution.group_code,
    });

    if (txnError) {
      console.error("Failed to create sv_transactions entry:", txnError);
      throw new Error("Failed to record transaction");
    }

    const { error: creditError } = await supabase.rpc("sv_add_credits", {
      p_user_id: userId,
      p_amount: quantity,
      p_reason: "credit_purchase",
      p_reference: txnId,
      p_counterparty: "stripe",
    });

    if (creditError) {
      console.error("Failed to add credits:", creditError);
      throw new Error("Failed to issue credits");
    }

    return txnId;
  }

  // ── Lifecycle helpers ──────────────────────────────────────────────────────

  /**
   * Apply a membership lifecycle change via the SECURITY DEFINER RPC.
   * This is the single server-side entry point — it handles:
   *   - Upserting user_memberships with period dates
   *   - Same-tier renewal (increments renewal_count, gate retained)
   *   - Tier change (resets renewal_count)
   *   - Audit log insertion (idempotent via stripe_event_id + action)
   */
  async function applyLifecycle(params: {
    userId: string;
    tier: string;
    status?: string;
    action: string;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    stripeCustomerId?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    reason?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await supabase.rpc("sv_apply_membership_lifecycle", {
      p_user_id: params.userId,
      p_tier: params.tier,
      p_status: params.status ?? "active",
      p_action: params.action,
      p_stripe_event_id: event.id,
      p_stripe_subscription_id: params.stripeSubscriptionId ?? null,
      p_stripe_price_id: params.stripePriceId ?? null,
      p_stripe_customer_id: params.stripeCustomerId ?? null,
      p_period_start: params.periodStart ?? null,
      p_period_end: params.periodEnd ?? null,
      p_cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
      p_reason: params.reason ?? null,
      p_source: params.source ?? "webhook",
      p_actor_id: null,
      p_metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("sv_apply_membership_lifecycle failed:", error);
      throw new Error(`Lifecycle apply failed: ${error.message}`);
    }
  }

  /**
   * Schedule a future tier change (e.g., downgrade at period end).
   */
  async function scheduleChange(params: {
    userId: string;
    fromTier: string;
    toTier: string;
    action: string;
    effectiveAt: string;
    stripeSubscriptionId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await supabase.rpc("sv_schedule_membership_change", {
      p_user_id: params.userId,
      p_from_tier: params.fromTier,
      p_to_tier: params.toTier,
      p_action: params.action,
      p_effective_at: params.effectiveAt,
      p_stripe_subscription_id: params.stripeSubscriptionId ?? null,
      p_stripe_event_id: event.id,
      p_metadata: params.metadata ?? {},
    });
    if (error) {
      console.error("sv_schedule_membership_change failed:", error);
      throw new Error(`Schedule change failed: ${error.message}`);
    }
  }

  /**
   * Fetch the Stripe customer ID for a user (for lifecycle tracking).
   */
  async function getStripeCustomerId(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.stripe_customer_id ?? null;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const userId = metadata.spotvault_user_id;
        const purchaseType = metadata.purchase_type;

        if (!userId) {
          await logEvent("ignored", undefined, "No spotvault_user_id in metadata");
          break;
        }

        await supabase
          .from("stripe_checkout_sessions")
          .update({ status: "paid", completed_at: new Date().toISOString() })
          .eq("stripe_session_id", session.id);

        const attribution = {
          attribution_id: metadata.attribution_id || null,
          deal_id: metadata.deal_id || null,
          group_code: metadata.group_code || null,
        };

        if (purchaseType === "credits") {
          const quantity = parseInt(metadata.credit_quantity || "0", 10);
          if (quantity < 1) {
            await logEvent("failed", undefined, "Invalid credit_quantity in metadata");
            break;
          }
          const { data: pricingData } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "credit_pricing")
            .single();
          const pricing = pricingData?.value as any;
          const expectedCents = quantity * (pricing?.stripe_cents_per_credit ?? 10);

          if (session.amount_total !== expectedCents) {
            console.error(`Amount mismatch: expected ${expectedCents} cents, got ${session.amount_total}`);
            await logEvent("failed", undefined, `Amount mismatch: expected ${expectedCents}, got ${session.amount_total}`);
            break;
          }

          const txnId = await issueCredits(
            userId,
            quantity,
            session.id,
            session.amount_total ?? expectedCents,
            attribution
          );
          await logEvent("processed", txnId);
        } else if (purchaseType === "membership") {
          const tier = metadata.membership_tier;
          if (!tier) {
            await logEvent("failed", undefined, "No membership_tier in metadata");
            break;
          }

          // Fetch the full subscription to get period dates
          const subscriptionId = session.subscription as string;
          let periodStart: string | null = null;
          let periodEnd: string | null = null;
          let stripePriceId: string | null = metadata.stripe_price_id ?? null;

          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              periodStart = sub.current_period_start
                ? new Date(sub.current_period_start * 1000).toISOString()
                : null;
              periodEnd = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;
              stripePriceId = sub.items.data[0]?.price?.id ?? stripePriceId;
            } catch (err) {
              console.error("Failed to retrieve subscription for period dates:", err);
            }
          }

          const customerId = await getStripeCustomerId(userId);

          await applyLifecycle({
            userId,
            tier,
            action: "new_subscription",
            stripeSubscriptionId: subscriptionId,
            stripePriceId,
            stripeCustomerId: customerId,
            periodStart,
            periodEnd,
            reason: "Checkout completed — new membership subscription",
            metadata: { checkout_session_id: session.id },
          });

          await logEvent("processed");
        } else {
          await logEvent("ignored", undefined, `Unknown purchase_type: ${purchaseType}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.spotvault_user_id;
        if (!userId) {
          await logEvent("ignored", undefined, "No spotvault_user_id in subscription metadata");
          break;
        }

        const tierId = subscription.metadata?.membership_tier;
        if (!tierId) {
          await logEvent("ignored", undefined, "No membership_tier in subscription metadata");
          break;
        }

        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        // Determine the Stripe subscription status
        const stripeStatus = subscription.status;

        // Map Stripe status to our internal status
        let internalStatus = "active";
        let action = "renewal";
        let reason = "Subscription updated";

        if (stripeStatus === "past_due") {
          internalStatus = "past_due";
          action = "past_due";
          reason = "Stripe subscription is past due — payment retry in progress";
        } else if (stripeStatus === "canceled") {
          internalStatus = "canceled";
          action = "canceled";
          reason = "Subscription canceled";
        } else if (stripeStatus === "unpaid") {
          internalStatus = "canceled";
          action = "unpaid";
          reason = "Subscription unpaid — access revoked";
        } else if (stripeStatus === "trialing") {
          internalStatus = "trialing";
          action = "trial_update";
          reason = "Subscription in trial period";
        }

        // Check if this is a same-tier renewal or a tier change (upgrade/downgrade)
        const { data: currentMembership } = await supabase
          .from("user_memberships")
          .select("tier_id, current_period_end")
          .eq("user_id", userId)
          .maybeSingle();

        const currentTier = currentMembership?.tier_id;
        const currentPeriodEnd = currentMembership?.current_period_end;
        const normalizedNewTier = tierId === "player" ? "free" : tierId;
        const isSameTier = currentTier === normalizedNewTier;

        // Detect whether this is a renewal vs a real update
        // A renewal has the same tier and a new period_end that's later than the old one
        const isRenewal = isSameTier && periodEnd && currentPeriodEnd &&
          new Date(periodEnd).getTime() > new Date(currentPeriodEnd).getTime();

        if (isRenewal && stripeStatus === "active") {
          action = "renewal";
          reason = "Same-tier subscription renewed — gate retained";
        } else if (!isSameTier && stripeStatus === "active") {
          // Tier change (upgrade or downgrade via Stripe)
          const tierOrder = ["free", "core", "pro", "elite"];
          const oldIdx = tierOrder.indexOf(currentTier ?? "free");
          const newIdx = tierOrder.indexOf(normalizedNewTier);
          action = newIdx > oldIdx ? "upgrade" : "downgrade";
          reason = `Tier changed from ${currentTier} to ${normalizedNewTier}`;
        }

        const customerId = typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null;

        // If cancel_at_period_end changed to true, schedule a downgrade
        if (cancelAtPeriodEnd && stripeStatus === "active" && periodEnd) {
          await scheduleChange({
            userId,
            fromTier: normalizedNewTier,
            toTier: "free",
            action: "scheduled_downgrade",
            effectiveAt: periodEnd,
            stripeSubscriptionId: subscription.id,
            metadata: { reason: "User canceled — downgrade at period end" },
          });
        } else if (!cancelAtPeriodEnd) {
          // If previously canceled and now reactivated, cancel any scheduled downgrade
          await supabase
            .from("membership_scheduled_changes")
            .update({ status: "superseded", processed_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("status", "pending");
        }

        await applyLifecycle({
          userId,
          tier: normalizedNewTier,
          status: internalStatus,
          action,
          stripeSubscriptionId: subscription.id,
          stripePriceId,
          stripeCustomerId: customerId,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
          reason,
          metadata: { stripe_subscription_status: stripeStatus },
        });

        await logEvent("processed");
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.spotvault_user_id;
        if (!userId) {
          await logEvent("ignored", undefined, "No spotvault_user_id in subscription metadata");
          break;
        }

        // The subscription is fully deleted — downgrade to free immediately
        await applyLifecycle({
          userId,
          tier: "free",
          status: "canceled",
          action: "subscription_deleted",
          stripeSubscriptionId: subscription.id,
          reason: "Stripe subscription deleted — access revoked",
          metadata: { stripe_subscription_status: subscription.status },
        });

        // Mark any pending scheduled changes as processed
        await supabase
          .from("membership_scheduled_changes")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("status", "pending");

        await logEvent("processed");
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only process recurring subscription invoices (not first invoice — that's
        // handled by checkout.session.completed)
        if (invoice.billing_reason !== "subscription_cycle") {
          await logEvent("ignored", undefined, `Non-cycle invoice: ${invoice.billing_reason}`);
          break;
        }

        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) {
          await logEvent("ignored", undefined, "No subscription ID on invoice");
          break;
        }

        // Retrieve the subscription to get user and tier metadata
        let subscription: Stripe.Subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (err) {
          console.error("Failed to retrieve subscription from invoice:", err);
          await logEvent("failed", undefined, "Failed to retrieve subscription");
          break;
        }

        const userId = subscription.metadata?.spotvault_user_id;
        const tierId = subscription.metadata?.membership_tier;
        if (!userId || !tierId) {
          await logEvent("ignored", undefined, "Missing user_id or tier in subscription metadata");
          break;
        }

        const normalizedTier = tierId === "player" ? "free" : tierId;
        const periodStart = subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
        const customerId = typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null;

        // This is a renewal — same-tier renewal retains the gate
        // The lifecycle function handles this: if same tier, increments renewal_count
        await applyLifecycle({
          userId,
          tier: normalizedTier,
          status: subscription.cancel_at_period_end ? "active" : "active",
          action: "renewal",
          stripeSubscriptionId: subscription.id,
          stripePriceId,
          stripeCustomerId: customerId,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          reason: "Subscription renewed via invoice.paid — same-tier renewal, gate retained",
          metadata: {
            invoice_id: invoice.id,
            billing_reason: invoice.billing_reason,
            amount_paid: invoice.amount_paid,
          },
        });

        // If cancel_at_period_end, ensure the scheduled downgrade exists
        if (subscription.cancel_at_period_end && periodEnd) {
          await scheduleChange({
            userId,
            fromTier: normalizedTier,
            toTier: "free",
            action: "scheduled_downgrade",
            effectiveAt: periodEnd,
            stripeSubscriptionId: subscription.id,
            metadata: { invoice_id: invoice.id },
          });
        }

        await logEvent("processed");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) {
          await logEvent("ignored", undefined, "No subscription ID on failed invoice");
          break;
        }

        let subscription: Stripe.Subscription;
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (err) {
          console.error("Failed to retrieve subscription from failed invoice:", err);
          await logEvent("failed", undefined, "Failed to retrieve subscription");
          break;
        }

        const userId = subscription.metadata?.spotvault_user_id;
        const tierId = subscription.metadata?.membership_tier;
        if (!userId || !tierId) {
          await logEvent("ignored", undefined, "Missing user_id or tier in subscription metadata");
          break;
        }

        const normalizedTier = tierId === "player" ? "free" : tierId;

        // Mark as past_due — the reconciliation function will downgrade after
        // the 7-day dunning grace period if Stripe doesn't recover
        await applyLifecycle({
          userId,
          tier: normalizedTier,
          status: "past_due",
          action: "payment_failed",
          stripeSubscriptionId: subscription.id,
          periodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          reason: "Renewal payment failed — subscription entered past_due state",
          metadata: {
            invoice_id: invoice.id,
            attempt_count: invoice.attempt_count,
            next_payment_attempt: invoice.next_payment_attempt,
          },
        });

        await logEvent("processed");
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const { data: originalTxn } = await supabase
          .from("sv_transactions")
          .select("transaction_id, type_code, user_id, credit_amount, gross_amount")
          .eq("payment_provider_ref", charge.id)
          .single();

        if (!originalTxn) {
          await logEvent("ignored", undefined, "No original transaction found for refund");
          break;
        }

        const refundTxnId = await generateTransactionId();
        await supabase.from("sv_transactions").insert({
          transaction_id: refundTxnId,
          type_code: "REF",
          user_id: originalTxn.user_id,
          gross_amount: -(originalTxn.gross_amount),
          credit_amount: -(originalTxn.credit_amount),
          currency: "USD",
          payment_status: "refunded",
          payment_provider_ref: charge.id,
          refund_for_transaction_id: originalTxn.transaction_id,
          refund_stripe_id: charge.refunds?.data[0]?.id ?? null,
        });

        // Debit the refunded credits back from the user's balance
        const { error: debitError } = await supabase.rpc("sv_debit_credits", {
          p_user_id: originalTxn.user_id,
          p_amount: originalTxn.credit_amount,
          p_reason: "refund",
          p_reference: refundTxnId,
        });
        if (debitError) {
          console.error("Failed to debit credits on refund:", debitError);
        }

        await logEvent("processed", refundTxnId);
        break;
      }

      default:
        await logEvent("ignored", undefined, `Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    await logEvent("failed", undefined, (err as Error).message);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
