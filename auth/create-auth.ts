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
  // Better Auth always trusts the baseURL origin; additional origins (e.g. a
  // separately hosted dashboard) must be opted into via PULSE_ALLOWED_ORIGINS.
  const extraOrigins = (env.PULSE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

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
    trustedOrigins: extraOrigins,
  });
}
