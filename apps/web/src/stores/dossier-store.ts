import { create } from "zustand";
import { getSocket } from "@/lib/socket";
import axios from "axios";

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
});

interface DossierData {
  identity?: {
    sport?: string;
    position?: string;
    location?: string;
    school?: string;
    club?: string;
    competitiveLevel?: string;
    graduationYear?: number;
    nationality?: string;
  };
  performance?: {
    stats?: Record<string, number>;
    leagueLevel?: string;
    physicalProfile?: {
      height?: string;
      weight?: string;
      speed?: string;
      vertical?: string;
      dominantSide?: string;
    };
    strengths?: string[];
    physicalStatus?: string;
    archetype?: string;
    highlightUrls?: string[];
  };
  academic?: {
    gpa?: number;
    satAct?: number;
    intendedMajor?: string;
    ncaaEligibility?: boolean;
    academicInterests?: string[];
  };
  availability?: {
    transferPortal?: boolean;
    preferredRegions?: string[];
    scholarshipNeed?: boolean;
    timeline?: string;
    competitiveLevelGoal?: string;
    goals?: string[];
    limitations?: string[];
    relocationOpenness?: string;
    nonNegotiables?: string[];
  };
  media?: {
    highlightUrls?: string[];
    clipUrls?: string[];
    socialMedia?: {
      instagram?: string;
      twitter?: string;
      hudl?: string;
      other?: string;
    };
    references?: string[];
  };
  character?: {
    mentality?: string;
    leadership?: string;
    coachability?: string;
    resilience?: string;
    motivation?: string;
    growthAreas?: string[];
    selfRepresentation?: string;
  };
}

interface DossierState {
  data: DossierData | null;
  completeness: number;
  lastUpdated: string | null;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => void;
  fetchDossier: (token: string) => Promise<void>;
  setDossier: (data: DossierData, completeness: number) => void;
}

export const useDossierStore = create<DossierState>((set, get) => ({
  data: null,
  completeness: 0,
  lastUpdated: null,
  subscribed: false,
  loading: false,

  fetchDossier: async (token: string) => {
    set({ loading: true });
    try {
      const { data } = await http.get<{
        data: DossierData;
        completeness: number;
      }>("/dossier/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({
        data: data.data,
        completeness: data.completeness,
        lastUpdated: new Date().toISOString(),
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

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
