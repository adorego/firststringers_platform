import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(
      `${process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001"}/jerry`,
      {
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      },
    );
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function updateSocketToken(token: string): void {
  if (socket) {
    socket.auth = { token };
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
