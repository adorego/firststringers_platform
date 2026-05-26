"use client";

import { useState } from "react";
import { RecruiterSidebar } from "@/components/ui/Sidebar";
import { PipelineDrawer } from "@/components/recruiter/PipelineDrawer";
import { ConnectionsDrawer } from "@/components/recruiter/ConnectionsDrawer";
import { DirectChatPanel } from "@/components/recruiter/DirectChatPanel";
import { DirectConversation } from "@/hooks/useDirectChat";

const MOCK_RECRUITER_ID = "e0b6c0c8-2b27-4521-9b26-46ace16b4983";

export function RecruiterShell({ children }: { children: React.ReactNode }) {
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [activeConversation, setActiveConversation] =
    useState<DirectConversation | null>(null);

  const handleSelectConversation = (conv: DirectConversation) => {
    setActiveConversation(conv);
  };

  const handleBackToConnections = () => {
    setActiveConversation(null);
  };

  const handleCloseConnections = () => {
    setConnectionsOpen(false);
    setActiveConversation(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F0EB]">
      <RecruiterSidebar
        onPipelineClick={() => {
          setConnectionsOpen(false);
          setPipelineOpen(true);
        }}
        onConnectionsClick={() => {
          setPipelineOpen(false);
          setConnectionsOpen(true);
        }}
      />

      <main className="flex-1 overflow-y-auto">{children}</main>

      <PipelineDrawer
        isOpen={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
      />

      <ConnectionsDrawer
        isOpen={connectionsOpen && !activeConversation}
        onClose={handleCloseConnections}
        recruiterId={MOCK_RECRUITER_ID}
        onSelectConversation={handleSelectConversation}
      />

      {activeConversation && (
        <>
          {/* Backdrop for chat panel */}
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
            onClick={handleCloseConnections}
          />
          <DirectChatPanel
            conversation={activeConversation}
            onBack={handleBackToConnections}
          />
        </>
      )}
    </div>
  );
}
