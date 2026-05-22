"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contact = searchParams.get("contact") ?? "";
  const isReturning = searchParams.get("returning") === "true";

  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSubmit = useCallback(
    async (fullCode: string) => {
      setLoading(true);
      // TODO: verify code with backend
      if (isReturning) {
        router.push("/chat");
      } else {
        router.push("/register");
      }
    },
    [isReturning, router],
  );

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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
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
          href={isReturning ? "/welcome/returning" : "/welcome"}
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
            Check your messages
          </h1>
          <p className="mt-3 text-center text-base text-[#6B6B6B]">
            We sent a verification code to
          </p>
          <p className="text-center text-base font-medium text-[#2D2D2D]">
            {contact}
          </p>

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
            <button
              type="button"
              className="text-sm font-medium text-[#6B6B6B] hover:text-[#2D2D2D]"
            >
              Resend code
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="pb-8 text-center text-xs text-[#C0C0BC]">First Stringers</p>
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
