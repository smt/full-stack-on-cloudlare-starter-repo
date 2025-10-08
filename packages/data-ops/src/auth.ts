import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db/database";
import {
  account,
  session,
  user,
  verification,
} from "./drizzle-out/auth-schema";

let auth: ReturnType<typeof betterAuth>;

export function createBetterAuth(
  database: NonNullable<Parameters<typeof betterAuth>[0]>["database"],
  github?: { clientId: string; clientSecret: string },
): ReturnType<typeof betterAuth> {
  return betterAuth({
    database,
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      github: {
        clientId: github?.clientId ?? "",
        clientSecret: github?.clientSecret ?? "",
      },
    },
  });
}

export function getAuth(github: {
  clientId: string;
  clientSecret: string;
}): ReturnType<typeof createBetterAuth> {
  if (auth) return auth;

  auth = createBetterAuth(
    drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    github,
  );
  return auth;
}
