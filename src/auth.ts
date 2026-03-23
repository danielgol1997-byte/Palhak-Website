import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";

function defaultUserName(email?: string | null): string {
  const base =
    (email ?? "")
      .trim()
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "משתמש";
  return base.length ? base : "משתמש";
}

const adapter = PrismaAdapter(prisma) as Adapter;

// Ensure `User.name` is always non-null (required by our schema).
adapter.createUser = async (data: Omit<AdapterUser, "id">) => {
  const email = data.email?.trim().toLowerCase();
  // Remove 'image' field as our User model doesn't include it
  const { image, ...userData } = data;
  return prisma.user.create({
    data: {
      ...userData,
      email: email ?? data.email,
      name: data.name ?? defaultUserName(email),
      // Open signup: anyone can create an account via Google.
      active: true,
      // onboardedAt is intentionally left null for new users
    },
  });
};

export const authOptions: NextAuthOptions = {
  adapter,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth",
    error: "/auth/error",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For new users being created, allow them through (adapter.createUser sets active: true)
      if (account?.provider === "google") {
        // Check if user exists and is active
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { active: true },
        });
        
        // If user doesn't exist yet, they're being created now - allow it
        // If user exists, check if they're active
        return dbUser ? dbUser.active : true;
      }
      return true;
    },
    async jwt({ token, user }) {
      // OAuth sign-in: attach user id to the token
      if (user?.id) {
        token.sub = user.id;
      }

      // Refresh role / active / onboarding from DB on every request so admin role
      // changes (e.g. יובל על חלל) apply without requiring sign-out. JWT alone
      // would otherwise keep stale claims until re-login.
      if (token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, active: true, onboardedAt: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.active = dbUser.active;
            token.onboardedAt = dbUser.onboardedAt?.toISOString() ?? null;
          }
        } catch {
          // DB unavailable: keep existing token claims
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role ?? "USER";
        session.user.active = token.active ?? true;
        session.user.onboardedAt = token.onboardedAt ?? null;
      }
      return session;
    },
  },
};

export const authHandler = NextAuth(authOptions);


