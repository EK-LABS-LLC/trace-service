import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../config";

type DrizzleAdapterDb = Parameters<typeof drizzleAdapter>[0];
type DrizzleAdapterOptions = NonNullable<Parameters<typeof drizzleAdapter>[1]>;
type DrizzleProvider = DrizzleAdapterOptions["provider"];
type DrizzleAuthSchema = NonNullable<DrizzleAdapterOptions["schema"]>;

export function createAuth(
  db: DrizzleAdapterDb,
  provider: DrizzleProvider,
  authSchema: DrizzleAuthSchema,
) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider,
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [env.FRONTEND_URL],
  });
}
