"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function VerifyForm() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const contact = searchParams.get("contact") ?? session?.user?.email ?? "";
  const role = searchParams.get("role") ?? "athlete";

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSubmit = useCallback(
    async (fullCode: string) => {
      const token = session?.accessToken;
      if (!token) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code: fullCode }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.message ?? "Invalid code. Please try again.");
          setCode(Array(6).fill(""));
          inputRefs.current[0]?.focus();
          setLoading(false);
          return;
        }

        // Verified — redirect by role
        window.location.href = role === "recruiter" ? "/billy" : "/chat";
      } catch {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      }
    },
    [session?.accessToken, role],
  );

  async function handleResend() {
    const token = session?.accessToken;
    if (!token) return;

    setResent(false);
    setError("");

    try {
      await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch {
      setError("Could not resend code.");
    }
  }

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const digit = value.slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (next.every((d) => d !== "")) {
      handleSubmit(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;

    const next = [...code];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setCode(next);

    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();

    if (next.every((d) => d !== "")) {
      handleSubmit(next.join(""));
    }
  }

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
            Check your email
          </h1>
          <p className="mt-3 text-center text-base text-[#6B6B6B]">
            We sent a verification code to
          </p>
          {contact && (
            <p className="text-center text-base font-medium text-[#2D2D2D]">
              {contact}
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Code inputs */}
          <div className="mt-10 flex justify-center gap-3">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={loading}
                className="h-14 w-12 rounded-xl border border-[#E0E0DC] bg-[#EDEDEA] text-center text-xl font-semibold text-[#2D2D2D] transition-colors focus:border-[#C5C0D8] focus:bg-[#E8E4F0] focus:outline-none disabled:opacity-50"
              />
            ))}
          </div>

          {/* Resend */}
          <div className="mt-6 text-center">
            {resent ? (
              <p className="text-sm text-[#6B6B6B]">Code resent!</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm font-medium text-[#6B6B6B] hover:text-[#2D2D2D]"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="pb-8 text-center text-xs text-[#C0C0BC]">
        First Stringers
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
