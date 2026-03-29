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

// When a Google user signs in for the first time, NextAuth calls createUser.
// If an admin pre-created a User row with the same email we link to it
// instead of creating a duplicate.
adapter.createUser = async (data: Omit<AdapterUser, "id">) => {
  const email = data.email?.trim().toLowerCase() ?? data.email;
  const { image, ...userData } = data;

  // Check if admin already created a user with this email
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    // Update name from Google profile if admin left it as placeholder
    if (data.name && data.name !== existing.name) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: data.emailVerified ?? new Date() },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: data.emailVerified ?? new Date() },
      });
    }
    // Return the existing user — NextAuth will then link the Account to it
    return existing as AdapterUser;
  }

  // No pre-existing user: create a brand-new one
  return prisma.user.create({
    data: {
      ...userData,
      email,
      name: data.name ?? defaultUserName(email),
      active: true,
    },
  }) as Promise<AdapterUser>;
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
      // Admin-created users exist with same email but no Account row yet; link Google OAuth to that User.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { active: true },
        });
        // New users (being created now): allow through
        // Existing users: only if active
        return dbUser ? dbUser.active : true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

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


