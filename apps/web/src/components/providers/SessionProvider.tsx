"use client";

import { useEffect } from "react";
import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import { setAccessToken } from "@/lib/api";

function TokenSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const token = (session?.accessToken as string) ?? null;
    setAccessToken(token);
    // Keep localStorage in sync for consumers outside the axios layer
    // (Billy socket handshake and fetch helpers read fs_token).
    if (token) {
      localStorage.setItem("fs_token", token);
    } else {
      localStorage.removeItem("fs_token");
    }
  }, [session?.accessToken]);

  return <>{children}</>;
}

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <TokenSync>{children}</TokenSync>
    </NextAuthSessionProvider>
  );
}
