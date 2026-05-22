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

http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("fs_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Auto-refresh on 401 ──────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(http(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const tokens = await api.refresh();
      processQueue(null, tokens.access_token);
      originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
      return http(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh failed — clear tokens and redirect to welcome
      api.logout();
      if (typeof window !== "undefined") {
        window.location.href = "/welcome";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ── Simulated delay for mocks ──────────────────────────────────────────────
function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ── Auth types ─────────────────────────────────────────────────────────────
interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  // Auth
  async register(data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }): Promise<AuthTokens> {
    const { data: tokens } = await http.post<AuthTokens>("/auth/register", data);
    localStorage.setItem("fs_token", tokens.access_token);
    localStorage.setItem("fs_refresh_token", tokens.refresh_token);
    return tokens;
  },

  async refresh(): Promise<AuthTokens> {
    const refreshToken = localStorage.getItem("fs_refresh_token");
    if (!refreshToken) throw new Error("No refresh token");
    const { data: tokens } = await http.post<AuthTokens>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    localStorage.setItem("fs_token", tokens.access_token);
    localStorage.setItem("fs_refresh_token", tokens.refresh_token);
    return tokens;
  },

  logout() {
    localStorage.removeItem("fs_token");
    localStorage.removeItem("fs_refresh_token");
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
};

export default api;
