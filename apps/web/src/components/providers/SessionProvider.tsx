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
    setAccessToken((session?.accessToken as string) ?? null);
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
