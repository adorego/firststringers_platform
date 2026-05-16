"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface BillyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  searchResults?: AthleteResult[];
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

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export function useBilly(recruiterId: string) {
  const [messages, setMessages] = useState<BillyMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [isTyping, setIsTyping] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!recruiterId) return;

    const socket = io("http://localhost:3001/billy", {
        query: { recruiterId },
        withCredentials: true,
        transports: ["websocket"],
      }
    );

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

    socket.on("session_resumed", (data: { messages: BillyMessage[]; searchCriteria: SearchCriteria }) => {
      setMessages(
        data.messages.map((m) => ({
          ...m,
          id: crypto.randomUUID(),
          timestamp: new Date(m.timestamp),
        }))
      );
      setSearchCriteria(data.searchCriteria || {});
    });

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
        return [
          ...prev.slice(0, -1),
          { ...last, searchResults: data.results },
        ];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [recruiterId]);

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

  return { messages, status, isTyping, searchCriteria, sendMessage };
}