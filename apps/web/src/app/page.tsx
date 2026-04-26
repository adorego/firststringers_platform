import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-xl font-black text-black">FS</span>
        <div className="flex items-center gap-4 text-sm text-[#6B7280]">
          <Link href="/login" className="hover:text-black">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-black">
            Terms
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight text-black md:text-7xl">
          The intelligence network for athlete recruiting.
        </h1>
        <Link
          href="/register"
          className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-black px-8 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] active:scale-[0.97]"
        >
          Join
        </Link>
        <p className="mt-4 text-sm text-[#6B7280]">
          Join First Stringers early to get priority access when we go live
        </p>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-4 text-sm text-[#6B7280]">
        <div className="flex items-center gap-4">
          <Link href="/login" className="hover:text-black">
            Privacy
          </Link>
          <Link href="/login" className="hover:text-black">
            Terms
          </Link>
        </div>
        <span>2026 First Stringers Inc.</span>
      </footer>
    </div>
  );
}
