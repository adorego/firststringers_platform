"use client";

import { signOut } from "next-auth/react";
import { User, HelpCircle, LogOut } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile card */}
          <div className="flex items-center gap-4 rounded-2xl bg-[#EDEDEA] px-5 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E0E0DC] text-[#6B6B6B]">
              <User size={24} />
            </div>
            <div>
              <p className="text-lg font-semibold text-[#2D2D2D]">Athlete</p>
              <p className="text-sm text-[#A0A0A0]">First Stringers Member</p>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
              Account
            </h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-4 rounded-2xl bg-[#EDEDEA] px-5 py-4 text-left transition-colors hover:bg-[#E8E8E4]">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E0E0DC] text-[#6B6B6B]">
                  <User size={18} />
                </div>
                <div>
                  <p className="font-medium text-[#2D2D2D]">Profile details</p>
                  <p className="text-sm text-[#A0A0A0]">Manage your athlete profile</p>
                </div>
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[#A0A0A0]">
              Support
            </h3>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-4 rounded-2xl bg-[#EDEDEA] px-5 py-4 text-left transition-colors hover:bg-[#E8E8E4]">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E0E0DC] text-[#6B6B6B]">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <p className="font-medium text-[#2D2D2D]">Help & Support</p>
                  <p className="text-sm text-[#A0A0A0]">Get assistance</p>
                </div>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/welcome" })}
                className="flex w-full items-center gap-4 rounded-2xl bg-[#EDEDEA] px-5 py-4 text-left transition-colors hover:bg-[#E8E8E4]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E0E0DC] text-[#6B6B6B]">
                  <LogOut size={18} />
                </div>
                <p className="font-medium text-[#2D2D2D]">Log out</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
