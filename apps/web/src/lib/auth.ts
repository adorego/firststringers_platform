import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Server-side only — Buffer is not available in browser environments
function decodeJwtPayload(token: string): {
  sub: string;
  email: string;
  role: string;
  athleteId: string | null;
  exp: number;
} {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
} | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const payload = decodeJwtPayload(data.access_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpires: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          const payload = decodeJwtPayload(data.access_token);

          return {
            id: payload.sub,
            email: payload.email,
            name: payload.email,
            role: payload.role.toLowerCase() as "athlete" | "recruiter",
            athleteId: payload.athleteId ?? null,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            accessTokenExpires: payload.exp * 1000,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/welcome",
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: persist tokens and expiry
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.athleteId = user.athleteId;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        return token;
      }

      // Token still valid — return as-is
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token expired — attempt refresh
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (refreshed) {
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpires = refreshed.accessTokenExpires;
        return token;
      }

      // Refresh failed — mark session as expired
      token.error = "RefreshTokenExpired";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role as "athlete" | "recruiter";
        session.user.athleteId = token.athleteId ?? null;
      }
      session.accessToken = token.accessToken;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || (() => { throw new Error("NEXTAUTH_SECRET env var is required"); })(),
};
