import { Hono, type Context } from "hono";
import { sessionMiddleware } from "../middleware/session";
import { StripeService } from "../services/stripe.service";

const stripeService = new StripeService();
const stripeRoutes = new Hono();


stripeRoutes.post("/webhook", async (c: Context) => {
  const body = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature provided" }, 400);
  }

  try {
    await stripeService.handleWebhook(body, signature);
    return c.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, 500);
  }
});

// apply to all routes except /webhook
stripeRoutes.use("*", sessionMiddleware);

stripeRoutes.post("/create-checkout-session", async (c: Context) => {
  const userId = c.get("userId") as string;
  const userEmail = c.get("userEmail") as string;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { priceId } = await c.req.json();

  if (!priceId) {
    return c.json({ error: "priceId is required" }, 400);
  }

  try {
    const url = await stripeService.createCheckoutSession(userId, userEmail, priceId);
    return c.json({ url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      500
    );
  }
});

stripeRoutes.get("/subscription", async (c: Context) => {
  const userId = c.get("userId") as string;

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const subscription = await stripeService.getSubscription(userId);
    return c.json({ subscription });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return c.json({ error: "Failed to fetch subscription" }, 500);
  }
});

export { stripeRoutes };
