import { create } from "zustand";
import { connectSocket, disconnectSocket, getSocket, updateSocketToken } from "@/lib/socket";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  isConnected: boolean;
  isTyping: boolean;
  error: string | null;
  connect: (token: string) => void;
  reconnect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  clearError: () => void;
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

  connect: (token: string) => {
    const socket = connectSocket(token);

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
}));
