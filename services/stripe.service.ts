import Stripe from "stripe";
import { env } from "../config";
import { db } from "../db";
import { user } from "../db/auth-schema";
import {
  subscriptions,
  type Subscription as DbSubscription,
} from "../db/schema";
import { eq } from "drizzle-orm";

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }

  async getOrCreateCustomer(
    userId: string,
    userEmail: string,
  ): Promise<string> {
    const users = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const userRecord = users[0];

    if (!userRecord) {
      throw new Error("User not found");
    }
    let customerId = userRecord.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;

      await db
        .update(user)
        .set({ stripeCustomerId: customerId })
        .where(eq(user.id, userId));
    }
    return customerId;
  }

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    priceId: string,
  ): Promise<string> {
    const customerId = await this.getOrCreateCustomer(userId, userEmail);

    const checkoutSession = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/`,
    });

    return checkoutSession.url!;
  }

  async handleWebhook(body: string, signature: string): Promise<void> {
    const event: Stripe.Event = this.stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const sessionData = event.data.object as Stripe.Checkout.Session;
        const userId = sessionData.metadata?.userId;

        if (!userId) {
          console.error("No userId in session metadata");
          break;
        }

        const subscriptionId =
          typeof sessionData.subscription === "string"
            ? sessionData.subscription
            : sessionData.subscription?.id;
        const customerId =
          typeof sessionData.customer === "string"
            ? sessionData.customer
            : sessionData.customer?.id;

        if (!subscriptionId || !customerId) {
          console.error("No subscription or customer ID in session data");
          break;
        }
        const existing = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
          .limit(1);

        if (existing.length === 0) {
          let priceId = "";
          if (sessionData.line_items?.data) {
            priceId = sessionData.line_items.data[0]?.price?.id || "";
          }

          // Create placeholder subscription record
          // The actual subscription dates will be set by customer.subscription.created event
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            status: "active",
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeSubscription: Stripe.Subscription = event.data
          .object as Stripe.Subscription;
        const status: string = stripeSubscription.status;
        const periodStart: Date = new Date(
          (stripeSubscription as any).current_period_start * 1000,
        );
        const periodEnd: Date = new Date(
          (stripeSubscription as any).current_period_end * 1000,
        );
        const cancelAtEnd: boolean = (stripeSubscription as any)
          .cancel_at_period_end;
        const subscriptionId: string = stripeSubscription.id;
        const customerId: string = stripeSubscription.customer as string;
        const priceId: string =
          stripeSubscription.items.data[0]?.price?.id || "";

        const existing = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
          .limit(1);

        const users = await db
          .select()
          .from(user)
          .where(eq(user.stripeCustomerId, customerId))
          .limit(1);
        const userId = users[0]?.id;

        if (!userId) {
          console.error("No user found for customer:", customerId);
          break;
        }

        if (existing.length === 0) {
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            status,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: cancelAtEnd,
          });
        } else {
          await db
            .update(subscriptions)
            .set({
              status,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: cancelAtEnd,
              stripePriceId: priceId,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        }
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSubscription: Stripe.Subscription = event.data
          .object as Stripe.Subscription;
        const subscriptionId: string = stripeSubscription.id;

        await db
          .update(subscriptions)
          .set({
            status: stripeSubscription.status,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId: string | undefined =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const subscriptionId: string | undefined =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          await db
            .update(subscriptions)
            .set({
              status: "past_due",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        }
        break;
      }
      default:
        break;
    }
  }

  async getSubscription(userId: string): Promise<DbSubscription | null> {
    const userSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return userSubscriptions[0] ?? null;
  }
}
