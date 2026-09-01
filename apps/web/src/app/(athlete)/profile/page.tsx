"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { User, HelpCircle, LogOut } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AthleteProfile {
  name: string;
  email: string;
  sport: string;
  position: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    fetch(`${API_URL}/athletes/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AthleteProfile | null) => setProfile(data))
      .catch(() => setProfile(null));
  }, [session?.accessToken]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-2 pb-4">
        <h1 className="text-2xl font-bold text-fs-text">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile card */}
          <div className="flex items-center gap-4 rounded-2xl bg-fs-surface px-5 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fs-text text-lg font-semibold text-white">
              {profile?.name ? (
                profile.name.charAt(0).toUpperCase()
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-fs-text">
                {profile?.name ?? "Athlete"}
              </p>
              <p className="text-sm text-fs-text-muted">
                {profile?.sport && profile?.position
                  ? `${profile.sport} · ${profile.position}`
                  : "First Stringers Member"}
              </p>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-fs-text-muted">
              Account
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push("/profile/details")}
                className="flex w-full items-center gap-4 rounded-2xl bg-fs-surface px-5 py-4 text-left transition-colors hover:bg-fs-surface-alt"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fs-border text-fs-text-muted">
                  <User size={18} />
                </div>
                <div>
                  <p className="font-medium text-fs-text">Account</p>
                  <p className="text-sm text-fs-text-muted">
                    Name, email and password
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-fs-text-muted">
              Support
            </h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-4 rounded-2xl bg-fs-surface px-5 py-4 text-left transition-colors hover:bg-fs-surface-alt">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fs-border text-fs-text-muted">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <p className="font-medium text-fs-text">Help & Support</p>
                  <p className="text-sm text-fs-text-muted">Get assistance</p>
                </div>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/welcome" })}
                className="flex w-full items-center gap-4 rounded-2xl bg-fs-surface px-5 py-4 text-left transition-colors hover:bg-fs-surface-alt"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-fs-border text-fs-text-muted">
                  <LogOut size={18} />
                </div>
                <p className="font-medium text-fs-text">Log out</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
