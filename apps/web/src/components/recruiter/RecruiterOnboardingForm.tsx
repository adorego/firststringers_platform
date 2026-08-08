"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Question {
  key: "organizationType" | "recruiterRole" | "location";
  label: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    key: "organizationType",
    label: "What type of organization do you work with?",
    options: [
      "High School",
      "College / University",
      "Club",
      "Academy",
      "Professional Organization",
      "Other",
    ],
  },
  {
    key: "recruiterRole",
    label: "What is your role within the program?",
    options: [
      "Head Coach",
      "Assistant Coach",
      "Recruiting Coordinator",
      "Scout",
      "Position Coach",
      "Other",
    ],
  },
  {
    key: "location",
    label: "What region or area do you primarily recruit from?",
    options: ["Florida", "Southeast", "Texas", "Midwest", "Nationwide", "International", "Other"],
  },
];

interface Props {
  recruiterName: string;
  onComplete: () => void;
}

export function RecruiterOnboardingForm({ recruiterName, onComplete }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const isComplete = QUESTIONS.every((q) => {
    const answer = answers[q.key];
    if (!answer) return false;
    return answer === "Other" ? !!otherText[q.key]?.trim() : true;
  });

  const handleSubmit = async () => {
    if (!isComplete || submitting) return;
    setSubmitting(true);
    setError(false);
    const resolved = (key: Question["key"]) =>
      answers[key] === "Other" ? otherText[key].trim() : answers[key];

    try {
      await api.submitOnboarding({
        organizationType: resolved("organizationType"),
        recruiterRole: resolved("recruiterRole"),
        location: resolved("location"),
        programNotes: notes.trim() || undefined,
      });
      onComplete();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full justify-center overflow-y-auto bg-[#F5F5F0] px-8 py-12">
      <div className="w-full max-w-xl">
        <h1 className="mb-6 text-2xl font-bold text-[#1A1A1A]">Recruiter Onboarding</h1>

        {/* Billy's mini intro */}
        <div className="mb-8 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1A]">
            <span className="text-xs font-bold text-white">B</span>
          </div>
          <div className="rounded-2xl bg-[#EDEAE5] px-5 py-4">
            <p className="text-sm leading-relaxed text-[#4B4745]">
              Hi {recruiterName}. I&apos;m Billy — before we get started, I&apos;d like to
              understand how you recruit and what decisions you&apos;re responsible for, so I can
              support you with better context.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">{q.label}</label>
              <select
                value={answers[q.key] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                className="w-full rounded-xl border border-[#E4DDD7] bg-white px-4 py-3 text-sm text-[#1A1A1A] focus:border-[#3B6FE8] focus:outline-none"
              >
                <option value="" disabled>
                  Select an option
                </option>
                {q.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              {answers[q.key] === "Other" && (
                <input
                  type="text"
                  value={otherText[q.key] ?? ""}
                  onChange={(e) =>
                    setOtherText((prev) => ({ ...prev, [q.key]: e.target.value }))
                  }
                  placeholder="Please specify"
                  className="mt-2 w-full rounded-xl border border-[#E4DDD7] bg-white px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:border-[#3B6FE8] focus:outline-none"
                />
              )}
            </div>
          ))}

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">
              Feel free to add something more about the program you offer
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
              className="w-full resize-none rounded-xl border border-[#E4DDD7] bg-white px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:border-[#3B6FE8] focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">
            Something went wrong saving your answers. Please try again.
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isComplete || submitting}
          className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-[#1A1A1A] text-sm font-medium text-white transition-opacity disabled:opacity-30"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
