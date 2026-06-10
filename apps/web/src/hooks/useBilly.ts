"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface BillyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  searchResults?: AthleteResult[];
  options?: MessageOption[];
  athleteId?: string;
}

export interface MessageOption {
  label: string;
  action: "contact_athlete" | "search_again";
  athleteId?: string;
  athleteName?: string;
}

export interface AthleteResult {
  id: string;
  fullName: string;
  sport: string;
  position: string;
  leagueLevel?: string;
  gpa?: number;
  ncaaEligible: boolean;
  completenessScore: number;
  dossier?: { summary?: string; recruiterPitch?: string };
}

export interface SearchCriteria {
  sport?: string;
  position?: string;
  leagueLevel?: string;
  minGpa?: number;
  ncaaEligible?: boolean;
  inTransferPortal?: boolean;
  preferredRegions?: string[];
  graduationYear?: number;
}

export interface BillyConversationSummary {
  id: string;
  recruiterId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: { role: string; content: string; timestamp: string } | null;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// Use || so an empty string (Next.js sometimes replaces undefined vars with "")
// also falls back to the default, preventing relative-URL fetches.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── REST helpers ──────────────────────────────────────────────────────────────

export async function listBillyConversations(
  recruiterId: string,
): Promise<BillyConversationSummary[]> {
  try {
    const res = await fetch(`${API_URL}/billy/conversations?recruiterId=${recruiterId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createBillyConversation(
  recruiterId: string,
): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${API_URL}/billy/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruiterId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

export function useBilly(recruiterId: string, conversationId: string) {
  const [messages, setMessages] = useState<BillyMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!recruiterId || !conversationId) return;

    const socket = io(`${API_URL}/billy`, {
      query: { recruiterId, conversationId },
      withCredentials: true,
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("error"));

    socket.on("message", (msg: Omit<BillyMessage, "id">) => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date(msg.timestamp) },
      ]);
    });

    socket.on(
      "session_resumed",
      (data: { messages: BillyMessage[]; searchCriteria: SearchCriteria }) => {
        setMessages(
          data.messages.map((m) => ({
            ...m,
            id: crypto.randomUUID(),
            timestamp: new Date(m.timestamp),
          })),
        );
        setSearchCriteria(data.searchCriteria || {});
        setSessionLoaded(true);
      },
    );

    socket.on("status", (data: { status: string }) => {
      if (data.status === "typing") setIsTyping(true);
    });

    socket.on("criteria_updated", (data: { criteria: SearchCriteria }) => {
      setSearchCriteria(data.criteria);
    });

    socket.on("search_results", (data: { results: AthleteResult[] }) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, searchResults: data.results }];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [recruiterId, conversationId]);

  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current || !content.trim()) return;

    const optimisticMsg: BillyMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    socketRef.current.emit("message", { content });
  }, []);

  const handleOption = useCallback((option: MessageOption) => {
    if (!socketRef.current) return;

    if (option.action === "contact_athlete") {
      const msg: BillyMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: `I want to contact ${option.athleteName}.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, msg]);
      socketRef.current.emit("initiate_contact", {
        athleteId: option.athleteId,
        athleteName: option.athleteName,
      });
    }

    if (option.action === "search_again") {
      const msg: BillyMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: "Show me other options.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, msg]);
      socketRef.current.emit("message", {
        content: "I'd like to see other athlete options.",
      });
    }
  }, []);

  return { messages, status, isTyping, sessionLoaded, searchCriteria, sendMessage, handleOption };
}
