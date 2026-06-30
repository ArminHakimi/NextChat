import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

type RoomId = string;

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

interface ChatRoom {
  id: RoomId;
  name: string;
  history: ChatMessage[];
}

interface RoomSummary {
  id: RoomId;
  name: string;
}

interface ChatPayload {
  user?: string;
  text?: string;
}

interface ClientToServerEvents {
  "chat:join": (user: string) => void;
  "chat:create-room": (roomName: string) => void;
  "chat:switch-room": (roomId: string) => void;
  "chat:message": (payload: ChatPayload) => void;
}

interface ServerToClientEvents {
  "chat:history": (history: ChatMessage[]) => void;
  "chat:message": (message: ChatMessage) => void;
  "chat:rooms": (rooms: RoomSummary[]) => void;
  "chat:room": (room: RoomSummary) => void;
  "chat:error": (message: string) => void;
}

interface SocketData {
  user?: string;
  roomId?: RoomId;
}

const mode = process.argv[2] ?? "dev";
const dev = mode !== "start";
const hostname = "localhost";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const MAX_HISTORY_PER_ROOM = 30;
const DEFAULT_ROOM_ID: RoomId = "lobby";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const createSystemMessage = (
  text: string,
  idSuffix = "system",
): ChatMessage => ({
  id: `${Date.now()}-${idSuffix}`,
  user: "System",
  text,
  timestamp: new Date().toISOString(),
});

const toRoomId = (name: string): RoomId =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || DEFAULT_ROOM_ID;

const rooms = new Map<RoomId, ChatRoom>();

rooms.set(DEFAULT_ROOM_ID, {
  id: DEFAULT_ROOM_ID,
  name: "Lobby",
  history: [
    {
      id: "welcome-message",
      user: "System",
      text: "Welcome to NextChat. Messages update live over WebSocket.",
      timestamp: new Date().toISOString(),
    },
  ],
});

const listRooms = (): RoomSummary[] =>
  Array.from(rooms.values()).map(({ id, name }) => ({
    id,
    name,
  }));

const ensureRoom = (
  roomName: string,
): { room: ChatRoom; created: boolean } | null => {
  const trimmedName = typeof roomName === "string" ? roomName.trim() : "";

  if (!trimmedName) {
    return null;
  }

  const nextRoomName = trimmedName.slice(0, 40);
  const nextRoomId = toRoomId(nextRoomName);
  const existingRoom = rooms.get(nextRoomId);

  if (existingRoom) {
    return { room: existingRoom, created: false };
  }

  const room: ChatRoom = {
    id: nextRoomId,
    name: nextRoomName,
    history: [
      createSystemMessage(
        `Room ${nextRoomName} is ready.`,
        `${nextRoomId}-ready`,
      ),
    ],
  };

  rooms.set(nextRoomId, room);

  return { room, created: true };
};

const addRoomMessage = (room: ChatRoom, message: ChatMessage): void => {
  room.history.push(message);

  if (room.history.length > MAX_HISTORY_PER_ROOM) {
    room.history.shift();
  }
};

const syncSocketRoomState = (
  socket: import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >,
  room: ChatRoom,
): void => {
  socket.emit("chat:room", {
    id: room.id,
    name: room.name,
  });
  socket.emit("chat:history", room.history);
};

const moveSocketToRoom = (
  socket: import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >,
  nextRoom: ChatRoom,
): void => {
  const currentRoomId = socket.data.roomId || DEFAULT_ROOM_ID;
  const currentRoom = rooms.get(currentRoomId);
  const user = socket.data.user || "Guest";

  if (currentRoom?.id === nextRoom.id) {
    syncSocketRoomState(socket, nextRoom);
    return;
  }

  if (currentRoom) {
    socket.leave(currentRoom.id);
    socket
      .to(currentRoom.id)
      .emit(
        "chat:message",
        createSystemMessage(
          `${user} left ${currentRoom.name}.`,
          `${socket.id}-left-room`,
        ),
      );
  }

  socket.join(nextRoom.id);
  socket.data.roomId = nextRoom.id;

  syncSocketRoomState(socket, nextRoom);

  socket
    .to(nextRoom.id)
    .emit(
      "chat:message",
      createSystemMessage(
        `${user} joined ${nextRoom.name}.`,
        `${socket.id}-joined-room`,
      ),
    );
};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    const lobbyRoom = rooms.get(DEFAULT_ROOM_ID);

    socket.data.user = "Guest";
    socket.data.roomId = DEFAULT_ROOM_ID;
    socket.join(DEFAULT_ROOM_ID);

    socket.emit("chat:rooms", listRooms());

    if (lobbyRoom) {
      syncSocketRoomState(socket, lobbyRoom);
    }

    socket.on("chat:join", (user) => {
      const nextUser =
        typeof user === "string" && user.trim() ? user.trim() : "Guest";
      socket.data.user = nextUser;

      const room = rooms.get(socket.data.roomId || DEFAULT_ROOM_ID);

      if (!room) {
        return;
      }

      socket
        .to(room.id)
        .emit(
          "chat:message",
          createSystemMessage(
            `${nextUser} joined ${room.name}.`,
            `${socket.id}-joined`,
          ),
        );
    });

    socket.on("chat:create-room", (roomName) => {
      const roomResult = ensureRoom(roomName);

      if (!roomResult) {
        socket.emit("chat:error", "Please enter a valid group name.");
        return;
      }

      if (roomResult.created) {
        io.emit("chat:rooms", listRooms());
      }

      moveSocketToRoom(socket, roomResult.room);
    });

    socket.on("chat:switch-room", (roomId) => {
      const nextRoomId = typeof roomId === "string" ? roomId.trim() : "";
      const room = rooms.get(nextRoomId);

      if (!room) {
        socket.emit("chat:error", "That group no longer exists.");
        return;
      }

      moveSocketToRoom(socket, room);
    });

    socket.on("chat:message", (payload) => {
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      const user =
        typeof payload?.user === "string" && payload.user.trim()
          ? payload.user.trim()
          : socket.data.user || "Guest";

      if (!text) {
        return;
      }

      const room = rooms.get(socket.data.roomId || DEFAULT_ROOM_ID);

      if (!room) {
        return;
      }

      const message = {
        id: `${Date.now()}-${socket.id}`,
        user,
        text,
        timestamp: new Date().toISOString(),
      };

      addRoomMessage(room, message);

      io.to(room.id).emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      const user = socket.data.user || "Guest";
      const room = rooms.get(socket.data.roomId || DEFAULT_ROOM_ID);

      if (!room) {
        return;
      }

      socket
        .to(room.id)
        .emit(
          "chat:message",
          createSystemMessage(
            `${user} left ${room.name}.`,
            `${socket.id}-left`,
          ),
        );
    });
  });

  httpServer
    .once("error", (error) => {
      console.error(error);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> NextChat ready on http://${hostname}:${port}`);
    });
});
