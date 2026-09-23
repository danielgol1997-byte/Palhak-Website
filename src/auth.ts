import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isViewOnlyAccountEmail } from "@/lib/viewOnlyAccounts";

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

  // No pre-existing user: create a brand-new one.
  // Specific accounts are created as view-only and skip onboarding, which they cannot submit.
  const viewOnly = isViewOnlyAccountEmail(email);
  return prisma.user.create({
    data: {
      ...userData,
      email,
      name: data.name ?? defaultUserName(email),
      active: true,
      role: viewOnly ? Role.VIEW_ONLY : Role.USER,
      ...(viewOnly ? { onboardedAt: new Date() } : {}),
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
        const email = user.email?.trim().toLowerCase();
        // If this account was created earlier as a normal user, promote it once.
        // An admin-assigned role other than USER is left as-is.
        if (email && isViewOnlyAccountEmail(email)) {
          await prisma.user.updateMany({
            where: { email: { equals: email, mode: "insensitive" }, role: Role.USER },
            data: { role: Role.VIEW_ONLY },
          });
          await prisma.user.updateMany({
            where: {
              email: { equals: email, mode: "insensitive" },
              role: Role.VIEW_ONLY,
              onboardedAt: null,
            },
            data: { onboardedAt: new Date() },
          });
        }

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


