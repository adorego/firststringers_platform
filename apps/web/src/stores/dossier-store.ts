import { create } from "zustand";
import { getSocket } from "@/lib/socket";

interface DossierData {
  identity?: {
    sport?: string;
    position?: string;
    nationality?: string;
    graduationYear?: number;
  };
  performance?: {
    stats?: Record<string, number>;
    leagueLevel?: string;
    highlightUrls?: string[];
  };
  academic?: {
    gpa?: number;
    satAct?: number;
    intendedMajor?: string;
    ncaaEligibility?: boolean;
  };
  availability?: {
    transferPortal?: boolean;
    preferredRegions?: string[];
    scholarshipNeed?: boolean;
  };
}

interface DossierState {
  data: DossierData | null;
  completeness: number;
  lastUpdated: string | null;
  subscribed: boolean;
  subscribe: () => void;
  setDossier: (data: DossierData, completeness: number) => void;
}

export const useDossierStore = create<DossierState>((set, get) => ({
  data: null,
  completeness: 0,
  lastUpdated: null,
  subscribed: false,

  subscribe: () => {
    const socket = getSocket();

    // Remove previous listener to avoid duplicates after reconnect
    socket.off("dossier_updated");

    socket.on(
      "dossier_updated",
      (payload: { data: DossierData; completeness: number }) => {
        set({
          data: payload.data,
          completeness: payload.completeness,
          lastUpdated: new Date().toISOString(),
        });
      },
    );

    set({ subscribed: true });
  },

  setDossier: (data: DossierData, completeness: number) => {
    set({ data, completeness, lastUpdated: new Date().toISOString() });
  },
}));
