"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FormErrors {
  const errors: FormErrors = {};
  if (!name.trim()) {
    errors.name = "Name is required";
  }
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email";
  }
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"athlete" | "recruiter">("athlete");
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");

    const fieldErrors = validate(name, email, password);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);

    try {
      // Register with backend API
      await api.register({
        email,
        password,
        name,
        role: role.toUpperCase(),
      });

      // Sign in with next-auth to create session
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setServerError("Account created but sign-in failed. Try logging in.");
        return;
      }

      if (role === "recruiter") {
        router.push("/matches");
      } else {
        router.push("/chat");
      }
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status === 409
      ) {
        setServerError("This email is already registered. Try logging in.");
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function clearError(field: keyof FormErrors) {
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between bg-fs-black p-12 lg:flex lg:w-1/2">
        <div>
          <span className="text-3xl font-black text-fs-white">FS</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight text-fs-white">
            The intelligence network for athlete recruiting.
          </h2>
          <p className="mt-4 max-w-sm text-fs-muted">
            Build your dossier with Jerry, connect with recruiters, and take
            your athletic career to the next level.
          </p>
        </div>
        <p className="text-sm text-fs-muted">
          &copy; 2026 First Stringers Inc.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-[#F9FAFB] px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <span className="text-2xl font-black text-fs-black">FS</span>
          </div>

          <h1 className="text-3xl font-bold text-[#111827]">Create account</h1>
          <p className="mt-2 text-sm text-fs-muted">
            Join First Stringers and get discovered
          </p>

          {serverError && (
            <div className="mt-4 rounded-lg border border-fs-red/30 bg-fs-red/10 px-4 py-3 text-sm text-fs-red">
              {serverError}
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Role selector */}
            <div className="flex gap-2 rounded-lg border border-fs-border-gray bg-white p-1">
              <button
                type="button"
                onClick={() => setRole("athlete")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  role === "athlete"
                    ? "bg-fs-black text-fs-white"
                    : "text-fs-muted hover:text-[#111827]"
                }`}
              >
                Athlete
              </button>
              <button
                type="button"
                onClick={() => setRole("recruiter")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  role === "recruiter"
                    ? "bg-fs-black text-fs-white"
                    : "text-fs-muted hover:text-[#111827]"
                }`}
              >
                Recruiter
              </button>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-[#111827]"
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                placeholder="Marcus Johnson"
                className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-[#111827] placeholder:text-fs-muted focus:outline-none focus:ring-1 ${
                  errors.name
                    ? "border-fs-red focus:border-fs-red focus:ring-fs-red"
                    : "border-fs-border-gray focus:border-fs-black focus:ring-fs-black"
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-fs-red">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[#111827]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                placeholder="you@example.com"
                className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-[#111827] placeholder:text-fs-muted focus:outline-none focus:ring-1 ${
                  errors.email
                    ? "border-fs-red focus:border-fs-red focus:ring-fs-red"
                    : "border-fs-border-gray focus:border-fs-black focus:ring-fs-black"
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-fs-red">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[#111827]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError("password");
                }}
                placeholder="••••••••"
                className={`h-11 w-full rounded-lg border bg-white px-4 text-sm text-[#111827] placeholder:text-fs-muted focus:outline-none focus:ring-1 ${
                  errors.password
                    ? "border-fs-red focus:border-fs-red focus:ring-fs-red"
                    : "border-fs-border-gray focus:border-fs-black focus:ring-fs-black"
                }`}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-fs-red">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-fs-black text-sm font-semibold text-fs-white transition-colors hover:bg-[#1a1a1a] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <svg
                  className="h-5 w-5 animate-spin text-white"
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
                "Create account"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-fs-border-gray" />
              <span className="text-xs text-fs-muted">or</span>
              <div className="h-px flex-1 bg-fs-border-gray" />
            </div>

            {/* Google */}
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-fs-border-gray bg-white text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6] active:scale-[0.97]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-fs-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-fs-black underline hover:opacity-70"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
