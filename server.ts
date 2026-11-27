import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { hasValidSession, isAuthRequired } from "./src/lib/auth";

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

interface MediaState {
  audio: boolean;
  video: boolean;
}

interface CallParticipant extends MediaState {
  id: string;
  user: string;
}

interface ClientToServerEvents {
  "chat:join": (user: string) => void;
  "chat:create-room": (roomName: string) => void;
  "chat:switch-room": (roomId: string) => void;
  "chat:message": (payload: ChatPayload) => void;
  "call:join": (media: MediaState) => void;
  "call:signal": (payload: { to: string; data: unknown }) => void;
  "call:media-state": (media: MediaState) => void;
  "call:leave": () => void;
}

interface ServerToClientEvents {
  "chat:history": (history: ChatMessage[]) => void;
  "chat:message": (message: ChatMessage) => void;
  "chat:rooms": (rooms: RoomSummary[]) => void;
  "chat:room": (room: RoomSummary) => void;
  "chat:error": (message: string) => void;
  "call:participants": (participants: CallParticipant[]) => void;
  "call:peer-joined": (participant: CallParticipant) => void;
  "call:peer-left": (id: string) => void;
  "call:peer-media": (participant: CallParticipant) => void;
  "call:signal": (payload: { from: string; data: unknown }) => void;
  "call:ring": (payload: {
    roomId: RoomId;
    roomName: string;
    user: string;
  }) => void;
  "call:state": (payload: { roomId: RoomId; count: number }) => void;
  "call:error": (message: string) => void;
}

interface SocketData {
  user?: string;
  roomId?: RoomId;
  callRoomId?: RoomId;
}

type ChatServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

type ChatSocket = import("socket.io").Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const mode = process.argv[2] ?? "dev";
const dev = mode !== "start";
const hostname = "localhost";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const MAX_HISTORY_PER_ROOM = 30;
const MAX_CALL_PARTICIPANTS = 6;
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
const calls = new Map<RoomId, Map<string, CallParticipant>>();

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

const syncSocketRoomState = (socket: ChatSocket, room: ChatRoom): void => {
  socket.emit("chat:room", {
    id: room.id,
    name: room.name,
  });
  socket.emit("chat:history", room.history);
  socket.emit("call:state", {
    roomId: room.id,
    count: calls.get(room.id)?.size ?? 0,
  });
};

const callChannel = (roomId: RoomId): string => `call:${roomId}`;

const leaveCall = (io: ChatServer, socket: ChatSocket): void => {
  const roomId = socket.data.callRoomId;

  if (!roomId) {
    return;
  }

  socket.data.callRoomId = undefined;
  socket.leave(callChannel(roomId));

  const participants = calls.get(roomId);

  if (!participants?.delete(socket.id)) {
    return;
  }

  if (participants.size === 0) {
    calls.delete(roomId);
  }

  io.to(callChannel(roomId)).emit("call:peer-left", socket.id);
  io.to(roomId).emit("call:state", { roomId, count: participants.size });
};

const moveSocketToRoom = (
  io: ChatServer,
  socket: ChatSocket,
  nextRoom: ChatRoom,
): void => {
  const currentRoomId = socket.data.roomId || DEFAULT_ROOM_ID;
  const currentRoom = rooms.get(currentRoomId);
  const user = socket.data.user || "Guest";

  if (currentRoom?.id === nextRoom.id) {
    syncSocketRoomState(socket, nextRoom);
    return;
  }

  leaveCall(io, socket);
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

  const io: ChatServer = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.use((socket, nextSocket) => {
    const origin = socket.handshake.headers.origin;
    const host = socket.handshake.headers.host;

    if (origin) {
      try {
        if (new URL(origin).host !== host) {
          nextSocket(new Error("Origin not allowed."));
          return;
        }
      } catch {
        nextSocket(new Error("Origin not allowed."));
        return;
      }
    }

    if (
      isAuthRequired() &&
      !hasValidSession(socket.handshake.headers.cookie)
    ) {
      nextSocket(new Error("Authentication required."));
      return;
    }

    nextSocket();
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

      const callParticipant = socket.data.callRoomId
        ? calls.get(socket.data.callRoomId)?.get(socket.id)
        : undefined;

      if (callParticipant && socket.data.callRoomId) {
        callParticipant.user = nextUser;
        io.to(callChannel(socket.data.callRoomId)).emit(
          "call:peer-media",
          callParticipant,
        );
      }

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

      moveSocketToRoom(io, socket, roomResult.room);
    });

    socket.on("chat:switch-room", (roomId) => {
      const nextRoomId = typeof roomId === "string" ? roomId.trim() : "";
      const room = rooms.get(nextRoomId);

      if (!room) {
        socket.emit("chat:error", "That group no longer exists.");
        return;
      }

      moveSocketToRoom(io, socket, room);
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

    socket.on("call:join", (media) => {
      const room = rooms.get(socket.data.roomId || DEFAULT_ROOM_ID);

      if (!room || socket.data.callRoomId === room.id) {
        return;
      }

      leaveCall(io, socket);

      const participants =
        calls.get(room.id) ?? new Map<string, CallParticipant>();

      if (participants.size >= MAX_CALL_PARTICIPANTS) {
        socket.emit(
          "call:error",
          `This call is full (max ${MAX_CALL_PARTICIPANTS} people).`,
        );
        return;
      }

      const isFirstParticipant = participants.size === 0;
      const participant: CallParticipant = {
        id: socket.id,
        user: socket.data.user || "Guest",
        audio: Boolean(media?.audio),
        video: Boolean(media?.video),
      };

      socket.emit("call:participants", Array.from(participants.values()));

      participants.set(socket.id, participant);
      calls.set(room.id, participants);
      socket.data.callRoomId = room.id;

      socket.to(callChannel(room.id)).emit("call:peer-joined", participant);
      socket.join(callChannel(room.id));

      io.to(room.id).emit("call:state", {
        roomId: room.id,
        count: participants.size,
      });

      if (isFirstParticipant) {
        socket.to(room.id).emit("call:ring", {
          roomId: room.id,
          roomName: room.name,
          user: participant.user,
        });
      }
    });

    socket.on("call:signal", (payload) => {
      const callRoomId = socket.data.callRoomId;
      const target = typeof payload?.to === "string" ? payload.to : "";

      // Only relay between sockets that share the same call.
      if (!callRoomId || !calls.get(callRoomId)?.has(target)) {
        return;
      }

      io.to(target).emit("call:signal", {
        from: socket.id,
        data: payload.data,
      });
    });

    socket.on("call:media-state", (media) => {
      const callRoomId = socket.data.callRoomId;
      const participant = callRoomId
        ? calls.get(callRoomId)?.get(socket.id)
        : undefined;

      if (!callRoomId || !participant) {
        return;
      }

      participant.audio = Boolean(media?.audio);
      participant.video = Boolean(media?.video);

      socket.to(callChannel(callRoomId)).emit("call:peer-media", participant);
    });

    socket.on("call:leave", () => {
      leaveCall(io, socket);
    });

    socket.on("disconnect", () => {
      leaveCall(io, socket);

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
