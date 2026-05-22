"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WelcomeBackPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = email.trim().length > 0 && password.length > 0;

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    const session = await fetch("/api/auth/session").then((r) => r.json());
    if (session?.accessToken) {
      localStorage.setItem("fs_token", session.accessToken);
    }

    const role = session?.user?.role;
    if (role === "recruiter") {
      router.push("/matches");
    } else {
      router.push("/chat");
    }
  }

  const inputBase =
    "h-13 w-full rounded-xl border px-4 text-sm transition-colors placeholder:text-[#A0A0A0] focus:outline-none";
  const inputEmpty = "border-[#E0E0DC] bg-[#EDEDEA] text-[#2D2D2D]";
  const inputFilled = "border-[#C5C0D8] bg-[#E8E4F0] text-[#2D2D2D]";

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F0] px-6">
      {/* Back button */}
      <div className="pt-6">
        <Link
          href="/welcome"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#2D2D2D] hover:opacity-70"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3D3D3D]">
              <div className="h-3 w-3 rounded-full bg-[#F5F5F0]" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-center text-3xl font-bold tracking-tight text-[#2D2D2D]">
            Welcome back
          </h1>
          <p className="mt-3 text-center text-base text-[#6B6B6B]">
            Continue your journey with Jerry.
          </p>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleContinue} className="mt-10 w-full space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#2D2D2D]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`${inputBase} ${email.trim() ? inputFilled : inputEmpty}`}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#2D2D2D]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${inputBase} pr-12 ${password ? inputFilled : inputEmpty}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#A0A0A0] hover:text-[#2D2D2D]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Continue button */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="flex h-13 w-full items-center justify-center rounded-xl bg-[#C5C5C0] text-base font-medium text-white transition-all enabled:bg-[#3D3D3D] enabled:hover:bg-[#2D2D2D] enabled:active:scale-[0.98] disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="pb-8 text-center text-xs text-[#C0C0BC]">First Stringers</p>
    </div>
  );
}
