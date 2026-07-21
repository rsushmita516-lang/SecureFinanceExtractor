import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

process.env.NEXTAUTH_URL ??= "http://localhost:3000";
process.env.NEXTAUTH_URL_INTERNAL ??= "http://localhost:3000";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "default-secret-for-development-only-1234",
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Better Auth",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(parsed.data)
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as {
          user?: { id: string; email: string; name: string };
          token?: string;
          jwt?: string;
          organizationIds?: string[];
        };

        if (!payload.user) {
          return null;
        }

        return {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.name,
          betterAuthToken: payload.token,
          betterAuthJwt: payload.jwt,
          organizationId: payload.organizationIds?.[0] ?? null
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        /* eslint-disable @typescript-eslint/no-explicit-any */
        token.accessToken = (user as any).betterAuthToken ?? (user as any).betterAuthJwt;
        token.authJwt = (user as any).betterAuthJwt ?? (user as any).betterAuthToken;
        token.organizationId = (user as any).organizationId;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      session.accessToken = (token.accessToken as string | undefined) ?? (token.authJwt as string | undefined);
      session.authJwt = (token.authJwt as string | undefined) ?? (token.accessToken as string | undefined);
      session.organizationId = token.organizationId as string | undefined;
      return session;
    }
  }
};
