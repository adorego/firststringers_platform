"use client";

import { useState } from "react";
import { Send, Video, Upload } from "lucide-react";
import { Avatar } from "@/components/ui";
import { Badge } from "@/components/ui";

const MOCK_MESSAGES = [
  {
    id: "1",
    sender: "jerry" as const,
    content:
      "Hey! I'm Jerry, your recruiting AI agent. I'm here to help organize your athletic career, track opportunities, and connect you with the right programs. Let's get started—tell me about yourself!",
    time: "9:00 AM",
  },
  {
    id: "2",
    sender: "athlete" as const,
    content:
      "Hey Jerry! I'm a point guard from Austin, Texas. Just finished my junior year averaging 18 points and 7 assists.",
    time: "9:05 AM",
  },
  {
    id: "3",
    sender: "jerry" as const,
    content:
      "That's awesome! Those are solid numbers. I'm updating your profile with that info. Have you started thinking about what kind of program you're looking for? Division I, II, III? Any specific region or style of play you prefer?",
    time: "9:06 AM",
  },
];

export default function ChatPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-fs-border-gray px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fs-light-gray text-xs font-bold text-[#111827]">
            JR
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Jerry</h1>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-fs-green" />
              <span className="text-xs text-fs-green">Active</span>
            </div>
          </div>
        </div>
        <Avatar name="Marcus Johnson" size="md" />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {MOCK_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "athlete" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-md rounded-2xl px-4 py-3 ${
                  msg.sender === "athlete"
                    ? "bg-fs-black text-white"
                    : "bg-fs-light-gray text-[#111827]"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p
                  className={`mt-1.5 text-xs ${
                    msg.sender === "athlete" ? "text-white/50" : "text-fs-muted"
                  }`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          ))}

          {/* Notification bubble */}
          <div className="flex justify-start">
            <div className="max-w-md rounded-2xl bg-fs-light-gray px-4 py-3">
              <p className="text-sm text-[#111827]">
                <Badge variant="ai" className="mr-1.5">AI</Badge>
                A coach from University of Miami viewed your profile
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-fs-border-gray px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Jerry..."
              className="h-12 w-full rounded-full border border-fs-border-gray bg-white pl-5 pr-12 text-sm text-[#111827] placeholder:text-fs-muted focus:border-fs-black focus:outline-none focus:ring-1 focus:ring-fs-black"
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-fs-muted hover:text-[#111827]">
              <Upload size={18} />
            </button>
          </div>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-fs-black text-white transition-colors hover:bg-[#1a1a1a]">
            <Video size={20} />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-fs-black text-white transition-colors hover:bg-[#1a1a1a]">
            <Send size={20} />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-fs-muted">
          Jerry is your AI recruiting agent. Share updates, ask questions, or
          just check in.
        </p>
      </div>
    </div>
  );
}
