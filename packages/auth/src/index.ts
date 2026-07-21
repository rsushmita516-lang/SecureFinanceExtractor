import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt, organization } from "better-auth/plugins";
import { prisma } from "@vessify/db";

const baseURL = process.env.AUTH_BASE_URL ?? "http://localhost:8787";

export const auth = betterAuth({
  baseURL,
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  trustedOrigins: [
    process.env.WEB_BASE_URL ?? "http://localhost:3000",
    process.env.AUTH_BASE_URL ?? "http://localhost:8787"
  ],
  plugins: [
    organization({
      teams: {
        enabled: true
      },
      allowUserToCreateOrganization: true
    }),
    bearer(),
    jwt({
      jwt: {
        expirationTime: "7d",
        issuer: baseURL,
        audience: baseURL,
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email
        })
      }
    })
  ]
});

export type AuthSession = typeof auth.$Infer.Session;

export async function getAuthSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
