"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111827]">Scout AI</h1>
        <p className="text-sm text-fs-muted">
          Search athletes using natural language
        </p>
      </div>

      <div className="relative max-w-2xl">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-fs-muted"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="QB dual-threat, GPA 3.5+, Midwest, 2025"
          className="h-14 w-full rounded-xl border border-fs-border-gray bg-white pl-12 pr-5 text-base text-[#111827] placeholder:text-fs-muted focus:border-fs-black focus:outline-none focus:ring-1 focus:ring-fs-black"
        />
      </div>

      <div className="mt-16 text-center">
        <p className="text-sm text-fs-muted">
          Sin resultados para esta búsqueda. Intenta ajustar los criterios o
          usar lenguaje diferente.
        </p>
      </div>
    </div>
  );
}
