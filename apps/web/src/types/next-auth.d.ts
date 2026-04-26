import "next-auth";

declare module "next-auth" {
  interface User {
    role: "athlete" | "recruiter";
    accessToken: string;
    refreshToken: string;
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: "athlete" | "recruiter";
    };
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    id: string;
    accessToken: string;
    refreshToken: string;
  }
}
