"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = (searchParams.get("role") === "recruiter" ? "recruiter" : "athlete") as
    | "athlete"
    | "recruiter";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    agreed &&
    (role === "recruiter" || ageConfirmed);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    try {
      await api.register({
        email,
        password,
        name,
        role: role.toUpperCase(),
      });

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError("Account created but sign-in failed. Try logging in.");
        return;
      }

      // Full navigation so middleware can read the session and route by role
      window.location.href = role === "recruiter" ? "/billy" : "/chat";
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status === 409
      ) {
        setError("This email is already registered. Try signing in.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "h-13 w-full rounded-xl border px-4 text-sm transition-colors placeholder:text-[#A0A0A0] focus:outline-none";
  const inputEmpty = "border-[#E0E0DC] bg-[#EDEDEA] text-[#2D2D2D]";
  const inputFilled = "border-[#C5C0D8] bg-[#E8E4F0] text-[#2D2D2D]";

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#F5F5F0] px-6">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center py-12">
        {/* Logo */}
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#3D3D3D]">
          <div className="h-3 w-3 rounded-full bg-[#F5F5F0]" />
        </div>

        {/* Heading */}
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#2D2D2D]">
          {role === "recruiter"
            ? "Find the right athletes"
            : "Every athlete deserves representation"}
        </h1>
        <p className="mt-3 text-center text-base text-[#6B6B6B]">
          {role === "recruiter"
            ? "Create your account and start recruiting with First Stringers."
            : "Create your account and start your journey with First Stringers."}
        </p>

        {/* Role selector — updates URL */}
        <div className="mt-8 w-full">
          <div className="flex gap-2 rounded-2xl bg-[#EDEDEA] p-1">
            <Link
              href="/welcome?role=athlete"
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-medium transition-colors ${
                role === "athlete"
                  ? "bg-[#3D3D3D] text-white shadow-sm"
                  : "text-[#6B6B6B] hover:text-[#2D2D2D]"
              }`}
            >
              Athlete
            </Link>
            <Link
              href="/welcome?role=recruiter"
              className={`flex-1 rounded-xl py-2.5 text-center text-sm font-medium transition-colors ${
                role === "recruiter"
                  ? "bg-[#3D3D3D] text-white shadow-sm"
                  : "text-[#6B6B6B] hover:text-[#2D2D2D]"
              }`}
            >
              Recruiter
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleContinue} className="mt-6 w-full space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-[#2D2D2D]"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className={`${inputBase} ${name.trim() ? inputFilled : inputEmpty}`}
            />
          </div>

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
                placeholder="At least 8 characters"
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

          {/* Age confirmation — athletes only */}
          {role === "athlete" && (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setAgeConfirmed(!ageConfirmed)}
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                  ageConfirmed
                    ? "border-[#3D3D3D] bg-[#3D3D3D]"
                    : "border-[#C0C0BC] bg-white"
                }`}
                aria-label="Confirm age"
              >
                {ageConfirmed && (
                  <svg
                    className="h-3 w-3 text-white"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <p className="text-sm leading-snug text-[#6B6B6B]">
                I confirm that I am 13 years of age or older.
              </p>
            </div>
          )}

          {/* T&C Checkbox */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                agreed
                  ? "border-[#3D3D3D] bg-[#3D3D3D]"
                  : "border-[#C0C0BC] bg-white"
              }`}
              aria-label="Agree to terms"
            >
              {agreed && (
                <svg
                  className="h-3 w-3 text-white"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <p className="text-sm leading-snug text-[#6B6B6B]">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-[#2D2D2D] underline">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#2D2D2D] underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Age notice — athletes only */}
          {role === "athlete" && (
            <p className="text-xs text-[#A0A0A0]">
              First Stringers is available for athletes ages 13 and older.
            </p>
          )}

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

        {/* Already started */}
        <Link
          href="/welcome/returning"
          className="mt-6 text-sm text-[#6B6B6B] hover:text-[#2D2D2D]"
        >
          Already started your journey?
        </Link>
      </div>

      {/* Footer */}
      <p className="pb-8 text-xs text-[#C0C0BC]">First Stringers</p>
    </div>
  );
}
