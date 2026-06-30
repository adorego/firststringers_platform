"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "recruiter" | "athlete";
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface DirectConversation {
  id: string;
  athleteId: string;
  recruiterId: string;
  status: "pending" | "accepted" | "declined";
  athlete?: {
    id: string;
    name: string;
    sport: string | null;
    position: string | null;
    dossier?: { data: Record<string, unknown> } | null;
  };
  recruiter?: {
    id: string;
    name: string;
    email: string;
    organization?: { name: string } | null;
  };
  messages?: DirectMessage[];
  updatedAt: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── REST helpers ──────────────────────────────────────────────────────────────

export async function fetchRecruiterConversations(
  recruiterId: string,
): Promise<DirectConversation[]> {
  try {
    const res = await fetch(`${API_URL}/conversations/recruiter/${recruiterId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createOrGetConversation(
  recruiterId: string,
  athleteId: string,
): Promise<DirectConversation | null> {
  try {
    const res = await fetch(`${API_URL}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruiterId, athleteId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchPendingRequests(
  token: string,
): Promise<DirectConversation[]> {
  try {
    const res = await fetch(`${API_URL}/conversations/me/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function acceptConnectionRequest(
  conversationId: string,
  token: string,
): Promise<DirectConversation | null> {
  try {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/accept`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function declineConnectionRequest(
  conversationId: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/conversations/${conversationId}/decline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

export function useDirectChat(
  conversationId: string | null,
  userId: string,
  role: "recruiter" | "athlete",
) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const query =
      role === "recruiter" ? { recruiterId: userId } : { athleteId: userId };

    const socket = io(`${API_URL}/conversations`, {
      query,
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("history", (msgs: DirectMessage[]) => {
      setMessages(msgs);
    });

    socket.on("message", (msg: DirectMessage) => {
      setMessages((prev) => {
        // Deduplicate: replace optimistic message with server message if same content + sender
        const isDupe = prev.some(
          (m) =>
            m.id === msg.id ||
            (m.senderId === msg.senderId &&
              m.content === msg.content &&
              Math.abs(
                new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime(),
              ) < 5000),
        );
        if (isDupe) {
          return prev.map((m) =>
            m.senderId === msg.senderId &&
            m.content === msg.content &&
            m.id !== msg.id
              ? msg
              : m,
          );
        }
        return [...prev, msg];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, role]);

  // Join a conversation room and load its history.
  // setMessages([]) removed — clearing state synchronously in an effect
  // body causes cascading renders. The server's "history" event replaces
  // stale messages once the room is joined.
  useEffect(() => {
    if (!conversationId || !socketRef.current?.connected) return;
    socketRef.current.emit("join_conversation", { conversationId });
  }, [conversationId]);

  // Re-join after reconnect
  useEffect(() => {
    if (!connected || !conversationId || !socketRef.current) return;
    socketRef.current.emit("join_conversation", { conversationId });
  }, [connected, conversationId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!socketRef.current || !conversationId || !content.trim()) return;

      // Optimistic
      const optimistic: DirectMessage = {
        id: crypto.randomUUID(),
        conversationId,
        senderId: userId,
        senderRole: role,
        content: content.trim(),
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      socketRef.current.emit("send_message", {
        conversationId,
        content: content.trim(),
      });
    },
    [conversationId, userId, role],
  );

  return { messages, connected, sendMessage };
}
