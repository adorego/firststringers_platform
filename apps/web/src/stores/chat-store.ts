import { create } from "zustand";
import { connectSocket, disconnectSocket, getSocket, updateSocketToken } from "@/lib/socket";
import { acceptConnectionRequest, declineConnectionRequest } from "@/hooks/useDirectChat";
import type { ChatMessage } from "@/types";

export interface ConnectionRequest {
  conversationId: string;
  recruiterName: string;
  organizationName?: string;
  pitch?: string;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  isConnected: boolean;
  isTyping: boolean;
  error: string | null;
  pendingRequests: ConnectionRequest[];
  connect: (token: string) => void;
  reconnect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  clearError: () => void;
  acceptRequest: (conversationId: string, token: string) => Promise<void>;
  declineRequest: (conversationId: string, token: string) => Promise<void>;
}

function mapBackendMessage(msg: {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender: msg.role === "user" ? "athlete" : "jerry",
    content: msg.content,
    timestamp: msg.timestamp,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessionId: crypto.randomUUID(),
  isConnected: false,
  isTyping: false,
  error: null,
  pendingRequests: [],

  connect: (token: string) => {
    const socket = connectSocket(token);

    socket
      .off("connected")
      .off("session_resumed")
      .off("message")
      .off("status")
      .off("error")
      .off("disconnect")
      .off("connection_request");

    socket.on("connected", (payload: { message: string }) => {
      set({
        isConnected: true,
        messages: [
          {
            id: crypto.randomUUID(),
            sender: "jerry",
            content: payload.message,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    });

    socket.on(
      "session_resumed",
      (payload: {
        messages: {
          role: "user" | "assistant";
          content: string;
          timestamp: string;
        }[];
      }) => {
        set({
          isConnected: true,
          messages: payload.messages.map(mapBackendMessage),
        });
      },
    );

    socket.on(
      "message",
      (payload: {
        role: "assistant";
        content: string;
        timestamp: string;
      }) => {
        set((state) => ({
          isTyping: false,
          messages: [...state.messages, mapBackendMessage(payload)],
        }));
      },
    );

    socket.on("status", (payload: { status: string }) => {
      if (payload.status === "typing") {
        set({ isTyping: true });
      }
    });

    socket.on("error", (payload: { code: string; message: string }) => {
      set({ error: payload.message, isTyping: false });
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on(
      "connection_request",
      (payload: { conversationId: string; recruiterName: string; organizationName?: string; pitch?: string }) => {
        set((state) => ({
          pendingRequests: [
            ...state.pendingRequests.filter((r) => r.conversationId !== payload.conversationId),
            payload,
          ],
        }));
      },
    );
  },

  reconnect: (token: string) => {
    updateSocketToken(token);
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
  },

  disconnect: () => {
    const socket = getSocket();
    socket.removeAllListeners();
    disconnectSocket();
    set({ isConnected: false, isTyping: false });
  },

  sendMessage: (content: string) => {
    const socket = getSocket();
    const { sessionId } = get();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "athlete",
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({ messages: [...state.messages, userMessage] }));
    socket.emit("message", { content, sessionId });
  },

  clearError: () => set({ error: null }),

  acceptRequest: async (conversationId: string, token: string) => {
    const result = await acceptConnectionRequest(conversationId, token);
    if (result) {
      set((state) => ({
        pendingRequests: state.pendingRequests.filter(
          (r) => r.conversationId !== conversationId,
        ),
      }));
    }
  },

  declineRequest: async (conversationId: string, token: string) => {
    await declineConnectionRequest(conversationId, token);
    set((state) => ({
      pendingRequests: state.pendingRequests.filter(
        (r) => r.conversationId !== conversationId,
      ),
    }));
  },
}));
