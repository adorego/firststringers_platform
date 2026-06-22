"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { RecruiterSidebar } from "@/components/ui/Sidebar";
import { PipelineDrawer } from "@/components/recruiter/PipelineDrawer";
import { ConnectionsDrawer } from "@/components/recruiter/ConnectionsDrawer";
import { DirectChatPanel } from "@/components/recruiter/DirectChatPanel";
import { DirectConversation } from "@/hooks/useDirectChat";
import { IntroductionsDrawer } from "@/components/recruiter/IntroductionsDrawer";
import { DossierPanel } from "@/components/recruiter/DossierPanel";
import { AthleteResult } from "@/hooks/useBilly";
import { api } from "@/lib/api";

export function RecruiterShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const recruiterId = session?.user?.recruiterId ?? "e0b6c0c8-2b27-4521-9b26-46ace16b4983";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [introductionsOpen, setIntroductionsOpen] = useState(false);
  const [dossierAthlete, setDossierAthlete] = useState<AthleteResult | null>(null);
  const [dossierOpenToIntro, setDossierOpenToIntro] = useState(false);
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
  const [activeConversation, setActiveConversation] =
    useState<DirectConversation | null>(null);

  const handleAddToPipeline = async (athlete: AthleteResult) => {
    if (pipelineIds.has(athlete.id)) return;
    setPipelineIds((prev) => new Set(prev).add(athlete.id));
    try {
      await api.addToPipeline(athlete.id);
    } catch {
      setPipelineIds((prev) => {
        const next = new Set(prev);
        next.delete(athlete.id);
        return next;
      });
    }
  };

  const handleRequestIntro = async (athlete: AthleteResult) => {
    try {
      await api.requestIntroduction(athlete.id);
    } catch {
      // DossierPanel already shows a "sent" confirmation optimistically
    }
  };

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

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F0EB]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={closeSidebar}
        />
      )}

      <RecruiterSidebar
        recruiterId={recruiterId}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onPipelineClick={() => {
          setConnectionsOpen(false);
          setIntroductionsOpen(false);
          setPipelineOpen(true);
          closeSidebar();
        }}
        onConnectionsClick={() => {
          setPipelineOpen(false);
          setIntroductionsOpen(false);
          setConnectionsOpen(true);
          closeSidebar();
        }}
        onIntroductionsClick={() => {
          setPipelineOpen(false);
          setConnectionsOpen(false);
          setIntroductionsOpen(true);
          closeSidebar();
        }}
      />

      <main className="relative flex-1 overflow-y-auto">
        {/* Hamburger — mobile only, shown when sidebar is closed */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F0EB] shadow-md transition-colors hover:bg-[#EDE8E3] sm:hidden"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
          aria-label="Open menu"
        >
          <Menu size={20} className="text-[#1A1A1A]" />
        </button>
        {children}
      </main>

      <PipelineDrawer
        isOpen={pipelineOpen}
        onClose={() => setPipelineOpen(false)}
        onViewDossier={(athlete) => {
          setPipelineIds((prev) => new Set(prev).add(athlete.id));
          setDossierOpenToIntro(false);
          setDossierAthlete(athlete);
        }}
        onRequestIntro={(athlete) => {
          setPipelineIds((prev) => new Set(prev).add(athlete.id));
          setDossierOpenToIntro(true);
          setDossierAthlete(athlete);
        }}
      />

      <ConnectionsDrawer
        isOpen={connectionsOpen && !activeConversation}
        onClose={handleCloseConnections}
        recruiterId={recruiterId}
        onSelectConversation={handleSelectConversation}
      />

      <IntroductionsDrawer
        isOpen={introductionsOpen}
        onClose={() => setIntroductionsOpen(false)}
        onViewDossier={(athlete) => {
          setDossierOpenToIntro(false);
          setDossierAthlete(athlete);
        }}
      />

      <DossierPanel
        athlete={dossierAthlete}
        openToIntro={dossierOpenToIntro}
        onClose={() => {
          setDossierAthlete(null);
          setDossierOpenToIntro(false);
        }}
        onAddToPipeline={handleAddToPipeline}
        onRequestIntro={handleRequestIntro}
        isInPipeline={dossierAthlete ? pipelineIds.has(dossierAthlete.id) : false}
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
