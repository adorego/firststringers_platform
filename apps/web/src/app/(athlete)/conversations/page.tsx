"use client";

export default function ConversationsPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Conversations</h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Active recruiting discussions
        </p>
      </header>

      <div className="mx-6 mt-2 h-px bg-[#E8E8E4]" />

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#EDEDEA]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0E0DC]">
            <div className="h-2 w-2 rounded-full bg-[#C0C0BC]" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#2D2D2D]">
          No active conversations yet
        </h2>
        <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#A0A0A0]">
          When coaches request an introduction and you accept, your
          conversations will appear here.
        </p>
      </div>
    </div>
  );
}
