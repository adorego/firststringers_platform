"use client";

import { TrendingUp, Eye, Users } from "lucide-react";

interface Update {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  time: string;
}

const mockUpdates: Update[] = [
  {
    id: "1",
    icon: <TrendingUp size={18} />,
    title: "Profile momentum building",
    description: "Your profile activity is up 18% this week",
    time: "2h ago",
  },
  {
    id: "2",
    icon: <Eye size={18} />,
    title: "Stanford coaching staff",
    description: "Viewed your profile three times this week",
    time: "5h ago",
  },
  {
    id: "3",
    icon: <Users size={18} />,
    title: "New recruiting interest",
    description: "UCLA recruiting team engaged with your sprint data",
    time: "1d ago",
  },
];

export default function UpdatesPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Updates</h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Recent activity and momentum
        </p>
      </header>

      <div className="mx-6 mt-2 h-px bg-[#E8E8E4]" />

      {/* Updates list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {mockUpdates.map((update) => (
            <div
              key={update.id}
              className="rounded-2xl bg-[#EDEDEA] px-5 py-4 transition-colors hover:bg-[#E8E8E4]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E0E0DC] text-[#6B6B6B]">
                  {update.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#2D2D2D]">
                    {update.title}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B6B6B]">
                    {update.description}
                  </p>
                  <p className="mt-1.5 text-xs text-[#A0A0A0]">
                    {update.time}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
