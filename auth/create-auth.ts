import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../config";

export function createAuth(
  db: any,
  provider: "sqlite" | "pg",
  authSchema: {
    user: any;
    authSession: any;
    account: any;
    verification: any;
  },
) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider,
      schema: {
        user: authSchema.user,
        session: authSchema.authSession,
        account: authSchema.account,
        verification: authSchema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [env.FRONTEND_URL],
  });
}
