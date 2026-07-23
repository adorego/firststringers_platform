"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Question {
  key: string;
  question: string;
  type: "single" | "multi";
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    key: "sport",
    question: "What sport are you recruiting for?",
    type: "single",
    options: ["Football", "Baseball", "Basketball", "Soccer", "Volleyball", "Other"],
  },
  {
    key: "organizationType",
    question: "What type of organization do you work with?",
    type: "single",
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
    question: "What is your role within the program?",
    type: "single",
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
    question: "What region or area do you primarily recruit from?",
    type: "single",
    options: ["Florida", "Southeast", "Texas", "Midwest", "Nationwide", "International"],
  },
  {
    key: "positions",
    question: "What types of athletes are you typically responsible for evaluating?",
    type: "multi",
    options: [
      "Quarterbacks",
      "Wide Receivers",
      "Offensive Line",
      "Defensive Backs",
      "All Positions",
      "Other",
    ],
  },
  {
    key: "graduatingClasses",
    question: "Which graduating classes are you actively recruiting?",
    type: "multi",
    options: ["2027", "2028", "2029", "2030"],
  },
  {
    key: "evaluationPriority",
    question: "When evaluating an athlete for the first time, what usually matters most to you?",
    type: "single",
    options: [
      "Athleticism",
      "Academics",
      "Character",
      "Coachability",
      "Physical Traits",
      "Development Potential",
      "Film",
      "Other",
    ],
  },
  {
    key: "filterCriteria",
    question:
      "Are there any specific criteria or limitations you typically use to filter athletes?",
    type: "multi",
    options: [
      "Minimum GPA",
      "Location",
      "Position",
      "Height / Weight",
      "Academic Standards",
      "Program Fit",
      "Other",
    ],
  },
];

interface Props {
  recruiterName: string;
  onComplete: (suggestedSearches: string[]) => void;
}

export function OnboardingWizard({ recruiterName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const q = QUESTIONS[step];
  const currentAnswer = answers[q.key];
  const hasAnswer =
    q.type === "multi"
      ? Array.isArray(currentAnswer) && currentAnswer.length > 0
      : !!currentAnswer;

  const toggleSingle = (option: string) => {
    setAnswers((prev) => ({ ...prev, [q.key]: option }));
  };

  const toggleMulti = (option: string) => {
    setAnswers((prev) => {
      const current = (prev[q.key] as string[] | undefined) ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [q.key]: next };
    });
  };

  const handleContinue = async () => {
    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    setLoading(true);
    try {
      const profileData: Record<string, string> = {};
      for (const [key, val] of Object.entries(answers)) {
        profileData[key] = Array.isArray(val) ? val.join(", ") : val;
      }
      const result = await api.completeOnboarding(profileData);
      setDone(true);
      setTimeout(() => onComplete(result.suggestedSearches ?? []), 3000);
    } catch {
      onComplete([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F5F5F0] px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1A]">
              <span className="text-xs font-bold text-white">B</span>
            </div>
            <div className="rounded-2xl bg-[#EDEAE5] px-5 py-4">
              <p className="text-sm leading-relaxed text-[#4B4745]">
                Perfect. I have enough context to start helping you identify athletes that fit your
                program. As we work together, I&apos;ll continue learning more about your recruiting
                needs and preferences. Let&apos;s get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-[#F5F5F0]">
      {/* Centered column — all sections share the same max-width */}
      <div className="flex w-full max-w-sm flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="px-2 pt-10 pb-4">
          {step === 0 && (
            <div className="mb-6 flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1A]">
                <span className="text-xs font-bold text-white">B</span>
              </div>
              <div className="rounded-2xl bg-[#EDEAE5] px-5 py-4">
                <p className="text-sm leading-relaxed text-[#4B4745]">
                  Hi {recruiterName}. Before we get started, I&apos;d like to learn a little about
                  your recruiting responsibilities so I can better assist you.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="mr-1 text-xs text-[#ADA8A5] hover:text-[#1A1A1A]"
              >
                ← Back
              </button>
            )}
            <div className="h-1 flex-1 rounded-full bg-[#E4DDD7]">
              <div
                className="h-1 rounded-full bg-[#1A1A1A] transition-all duration-300"
                style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-xs text-[#ADA8A5]">
              {step + 1} of {QUESTIONS.length}
            </span>
          </div>
        </div>

        {/* Question + options */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-5 text-[17px] font-semibold leading-snug text-[#1A1A1A]">
            {q.question}
          </p>

          {q.type === "single" && (
            <div className="flex flex-col gap-2">
              {q.options.map((option) => {
                const selected = currentAnswer === option;
                return (
                  <button
                    key={option}
                    onClick={() => toggleSingle(option)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm text-left transition-colors ${
                      selected
                        ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                        : "border-[#E4DDD7] bg-white text-[#4B4745] hover:border-[#ADA8A5]"
                    }`}
                  >
                    <span>{option}</span>
                    {selected && (
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8l3.5 3.5L13 5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "multi" && (
            <div className="flex flex-col gap-2">
              {q.options.map((option) => {
                const selected =
                  (currentAnswer as string[] | undefined)?.includes(option) ?? false;
                return (
                  <button
                    key={option}
                    onClick={() => toggleMulti(option)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-colors ${
                      selected
                        ? "border-[#1A1A1A] bg-[#EDEAE5]"
                        : "border-[#E4DDD7] bg-white hover:border-[#ADA8A5]"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        selected ? "border-[#1A1A1A] bg-[#1A1A1A]" : "border-[#C4BDBA] bg-white"
                      }`}
                    >
                      {selected && (
                        <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-[#4B4745]">{option}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue button */}
        <div className="px-2 pb-10 pt-4">
          <button
            onClick={handleContinue}
            disabled={!hasAnswer || loading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1A1A1A] text-sm font-medium text-white transition-all disabled:opacity-30"
          >
            {loading ? "Saving…" : step === QUESTIONS.length - 1 ? "Finish" : "Continue"}
          </button>
        </div>

      </div>
    </div>
  );
}
