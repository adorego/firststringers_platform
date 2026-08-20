import axios from "axios";
import type { Athlete, ChatMessage, DossierSection, MatchResult } from "@/types";
import {
  mockAthletes,
  getAthleteById,
  mockConversation,
  mockMatchResults,
  dossiersByAthleteId,
  mockFullDossier,
} from "@/lib/mocks";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true"; // false by default

// ── Axios instance (used when USE_MOCKS is false) ──────────────────────────
const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});

// Token is set from the next-auth session via setAccessToken()
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

http.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Simulated delay for mocks ──────────────────────────────────────────────
function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  // Auth — registration is a direct HTTP call (before session exists)
  async register(data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const { data: tokens } = await http.post<{ access_token: string; refresh_token: string }>("/auth/register", data);
    return tokens;
  },

  // Athletes
  async getAthletes(): Promise<Athlete[]> {
    if (USE_MOCKS) return delay(mockAthletes);
    const { data } = await http.get<Athlete[]>("/athletes");
    return data;
  },

  async getAthlete(id: string): Promise<Athlete | undefined> {
    if (USE_MOCKS) return delay(getAthleteById(id));
    const { data } = await http.get<Athlete>(`/athletes/${id}`);
    return data;
  },

  // Dossier
  async getDossier(athleteId: string): Promise<DossierSection[]> {
    if (USE_MOCKS) return delay(dossiersByAthleteId[athleteId] ?? mockFullDossier);
    const { data } = await http.get<DossierSection[]>(`/athletes/${athleteId}/dossier`);
    return data;
  },

  // Chat
  async getMessages(athleteId: string): Promise<ChatMessage[]> {
    if (USE_MOCKS) return delay(mockConversation);
    const { data } = await http.get<ChatMessage[]>(`/chat/${athleteId}/messages`);
    return data;
  },

  async sendMessage(athleteId: string, content: string): Promise<ChatMessage> {
    if (USE_MOCKS) {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: "athlete",
        content,
        timestamp: new Date().toISOString(),
      };
      return delay(msg, 100);
    }
    const { data } = await http.post<ChatMessage>(`/chat/${athleteId}/messages`, { content });
    return data;
  },

  // Matches
  async getMatches(): Promise<MatchResult[]> {
    if (USE_MOCKS) return delay(mockMatchResults);
    const { data } = await http.get<MatchResult[]>("/matches");
    return data;
  },

  async getRecruiterProfile(): Promise<{
    id: string;
    name: string;
    email: string;
    university: string | null;
    location: string | null;
    scholarshipType: string | null;
    sport: string | null;
    division: string | null;
    gender: string | null;
    openings: number | null;
    organizationType: string | null;
    recruiterRole: string | null;
    positions: string | null;
    graduatingClasses: string | null;
    evaluationPriority: string | null;
    filterCriteria: string | null;
    programNotes: string | null;
    onboardingCompleted: boolean;
    pitch: string | null;
  }> {
    const { data } = await http.get("/recruiter/profile");
    return data;
  },

  async completeOnboarding(answers: {
    sport?: string;
    organizationType?: string;
    recruiterRole?: string;
    location?: string;
    positions?: string;
    graduatingClasses?: string;
    evaluationPriority?: string;
    filterCriteria?: string;
  }): Promise<{ suggestedSearches: string[] }> {
    const { data } = await http.post<{ suggestedSearches: string[] }>(
      "/recruiter/onboarding/complete",
      answers,
    );
    return data;
  },

  // Short mini-form onboarding (sport, organization, role, region, evaluation
  // priority, optional notes) — replaces the old chat-driven onboarding intro.
  async submitOnboarding(answers: {
    sport: string;
    organizationType: string;
    recruiterRole: string;
    location: string;
    evaluationPriority: string;
    programNotes?: string;
  }): Promise<{ ok: true }> {
    const { data } = await http.post<{ ok: true }>("/recruiter/onboarding/complete", answers);
    return data;
  },

  async searchAthletes(query: string): Promise<MatchResult[]> {
    if (USE_MOCKS) {
      const q = query.toLowerCase();
      const filtered = mockMatchResults.filter(
        (m) =>
          m.athlete.name.toLowerCase().includes(q) ||
          m.athlete.sport.toLowerCase().includes(q) ||
          m.athlete.position.toLowerCase().includes(q),
      );
      return delay(filtered, 500);
    }
    const { data } = await http.get<MatchResult[]>("/search", { params: { q: query } });
    return data;
  },

  // Pipeline
  async getPipeline(): Promise<PipelineEntry[]> {
    const { data } = await http.get<PipelineEntry[]>("/pipeline");
    return data;
  },

  async addToPipeline(athleteId: string): Promise<void> {
    await http.post("/pipeline", { athleteId });
  },

  async removeFromPipeline(athleteId: string): Promise<void> {
    await http.delete(`/pipeline/${athleteId}`);
  },

  async requestIntroduction(athleteId: string): Promise<void> {
    await http.post("/conversations/request-intro", { athleteId });
  },
};

export interface PipelineEntry {
  pipelineId: string;
  athleteId: string;
  fullName: string;
  sport: string | null;
  position: string | null;
  school: string | null;
  graduationYear: number | null;
  completenessScore: number;
  addedAt: string;
  latestUpdate: { content: string; publishedAt: string; source: "athlete" | "jerry_pitch" } | null;
}

export default api;
