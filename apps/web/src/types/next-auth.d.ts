import "next-auth";

declare module "next-auth" {
  interface User {
    role: "athlete" | "recruiter";
    athleteId: string | null;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: "athlete" | "recruiter";
      athleteId: string | null;
    };
    accessToken: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    id: string;
    athleteId: string | null;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    error?: string;
  }
}
