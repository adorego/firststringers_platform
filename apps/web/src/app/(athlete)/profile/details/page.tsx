"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ArrowLeft, Check, LogOut } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AthleteProfile {
  name: string;
  email: string;
  sport: string;
  position: string;
}

export default function AccountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    fetch(`${API_URL}/athletes/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AthleteProfile | null) => {
        setProfile(data);
        if (data) setName(data.name);
      })
      .catch(() => setProfile(null));
  }, [session?.accessToken]);

  const dirty = profile !== null && name.trim() !== profile.name;
  const passwordReady =
    currentPassword.length > 0 && newPassword.length >= 8 && !changingPassword;

  const handleSave = async () => {
    const token = session?.accessToken;
    if (!token || !name.trim() || !dirty) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/athletes/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated: AthleteProfile = await res.json();
      setProfile(updated);
      setName(updated.name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const token = session?.accessToken;
    if (!token || !passwordReady) return;

    setChangingPassword(true);
    setPasswordError(null);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "");
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 2500);
    } catch (caught) {
      setPasswordError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Could not update your password. Please try again.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-6 pt-5 pb-4">
        <button
          onClick={() => router.push("/profile")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#EDEDEA]"
          aria-label="Back to profile"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#2D2D2D]">Account</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
              Your details
            </h3>
            <div className="space-y-3 rounded-2xl bg-[#EDEDEA] px-5 py-4">
              <div>
                <label htmlFor="name" className="text-sm text-[#A0A0A0]">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E0E0DC] bg-white px-4 py-3 text-sm font-medium text-[#2D2D2D] outline-none transition-colors focus:border-[#C0C0BC]"
                />
              </div>
              <div>
                <p className="text-sm text-[#A0A0A0]">Email</p>
                <p className="mt-1 px-1 text-sm font-medium text-[#6B6B6B]">
                  {profile?.email ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!dirty || !name.trim() || saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3D3D3D] px-5 py-4 font-medium text-white transition-opacity disabled:opacity-30"
          >
            {saved ? (
              <>
                <Check size={18} /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
          </button>

          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
              Password
            </h3>
            <div className="space-y-3 rounded-2xl bg-[#EDEDEA] px-5 py-4">
              {passwordError && (
                <p className="text-sm text-red-700">{passwordError}</p>
              )}
              <div>
                <label
                  htmlFor="currentPassword"
                  className="text-sm text-[#A0A0A0]"
                >
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E0E0DC] bg-white px-4 py-3 text-sm font-medium text-[#2D2D2D] outline-none transition-colors focus:border-[#C0C0BC]"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="text-sm text-[#A0A0A0]">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E0E0DC] bg-white px-4 py-3 text-sm font-medium text-[#2D2D2D] outline-none transition-colors focus:border-[#C0C0BC]"
                />
                <p className="mt-1 px-1 text-xs text-[#A0A0A0]">
                  At least 8 characters.
                </p>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={!passwordReady}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D6D6D2] bg-white px-5 py-3 text-sm font-medium text-[#2D2D2D] transition-opacity disabled:opacity-30"
              >
                {passwordChanged ? (
                  <>
                    <Check size={16} /> Password updated
                  </>
                ) : changingPassword ? (
                  "Updating…"
                ) : (
                  "Update password"
                )}
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
              Athletic identity
            </h3>
            <div className="space-y-3 rounded-2xl bg-[#EDEDEA] px-5 py-4">
              <div className="flex items-center justify-between border-b border-[#E0E0DC] pb-3">
                <span className="text-sm text-[#A0A0A0]">Sport</span>
                <span className="text-sm font-medium text-[#2D2D2D]">
                  {profile?.sport || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#A0A0A0]">Position</span>
                <span className="text-sm font-medium text-[#2D2D2D]">
                  {profile?.position || "—"}
                </span>
              </div>
              <p className="pt-1 text-xs leading-relaxed text-[#A0A0A0]">
                Your athletic identity is built through your conversations with
                Jerry — tell him about any changes and he&apos;ll keep your
                representation up to date.
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/welcome" })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D6D6D2] px-5 py-4 font-medium text-[#6B6B6B] transition-colors hover:bg-[#EDEDEA]"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </div>
    </div>
  );
}
