"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import "./page.css";

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

interface ChatRoom {
  id: string;
  name: string;
}

let socket: Socket | null = null;

export default function Home() {
  const [displayName, setDisplayName] = useState("Guest");
  const [draftName, setDraftName] = useState("Guest");
  const [roomName, setRoomName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [serverNotice, setServerNotice] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket = io({
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setIsConnected(true);
      socket?.emit("chat:join", displayName);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("chat:rooms", (availableRooms: ChatRoom[]) => {
      setRooms(availableRooms);
    });

    socket.on("chat:room", (nextRoom: ChatRoom) => {
      setActiveRoom(nextRoom);
    });

    socket.on("chat:history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on("chat:message", (incomingMessage: ChatMessage) => {
      setMessages((currentMessages) => [...currentMessages, incomingMessage]);
    });

    socket.on("chat:error", (notice: string) => {
      setServerNotice(notice);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, []);

  const presenceLabel = useMemo(() => {
    if (isConnected) {
      return "Live now";
    }

    return "Reconnecting";
  }, [isConnected]);

  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftName.trim() || "Guest";
    setDraftName(nextName);
    setDisplayName(nextName);

    if (socket?.connected) {
      socket.emit("chat:join", nextName);
    }
  };

  const handleCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextRoomName = roomName.trim();

    if (!nextRoomName || !socket?.connected) {
      return;
    }

    socket.emit("chat:create-room", nextRoomName);
    setRoomName("");
    setServerNotice("");
  };

  const handleRoomSwitch = (roomId: string) => {
    if (!socket?.connected || activeRoom?.id === roomId) {
      return;
    }

    socket.emit("chat:switch-room", roomId);
    setServerNotice("");
  };

  const handleMessageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !socket) {
      return;
    }

    socket.emit("chat:message", {
      user: displayName,
      text: trimmedMessage,
    });

    setMessage("");
  };

  const lastMessage = messages[messages.length - 1];

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const totalMessages = messages.filter(
    (entry) => entry.user !== "System",
  ).length;

  return (
    <div className="chat-shell">
      <section className="hero-panel">
        <div>
          <span className="hero-kicker">NextChat</span>
          <h1>
            Simple realtime chat built with Next.js and WebSocket transport.
          </h1>
          <p className="hero-copy">
            Join the room, set a name, and send messages that broadcast to every
            connected client instantly.
          </p>
        </div>

        <div className="status-strip">
          <article className="status-card">
            <span>Status</span>
            <strong>{presenceLabel}</strong>
          </article>
          <article className="status-card">
            <span>You are</span>
            <strong>{displayName}</strong>
          </article>
          <article className="status-card">
            <span>Groups</span>
            <strong>{rooms.length}</strong>
          </article>
        </div>
      </section>

      <section className="chat-layout">
        <aside className="sidebar-panel">
          <div className="card chat-card">
            <h2>Profile</h2>
            <p>Choose the name that will appear beside your messages.</p>
            <form className="stack-form" onSubmit={handleNameSubmit}>
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={20}
                placeholder="Your name"
              />
              <button className="button" type="submit">
                Update name
              </button>
            </form>
          </div>

          <div className="card chat-card accent-card">
            <h2>Groups</h2>
            <p>
              Create a private chat group or switch between existing groups.
            </p>
            <form className="stack-form" onSubmit={handleCreateGroup}>
              <label htmlFor="room-name">New group name</label>
              <input
                id="room-name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                maxLength={40}
                placeholder="Product Team"
              />
              <button className="button" type="submit" disabled={!isConnected}>
                Create group
              </button>
            </form>
            <div className="room-list">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  className={`room-button${room.id === activeRoom?.id ? " active" : ""}`}
                  type="button"
                  onClick={() => handleRoomSwitch(room.id)}
                >
                  {room.name}
                </button>
              ))}
            </div>
            {serverNotice && <p className="notice-text">{serverNotice}</p>}
          </div>
        </aside>

        <section className="card chat-card transcript-panel">
          <div className="transcript-header">
            <div>
              <h2>{activeRoom?.name ?? "Lobby"}</h2>
              <p>Messages are scoped to your selected group.</p>
            </div>
            {lastMessage && (
              <span className="message-meta">
                Last event at {formatTime(lastMessage.timestamp)}
              </span>
            )}
          </div>

          <div className="message-list">
            {messages.map((entry) => {
              const isOwnMessage = entry.user === displayName;
              const isSystemMessage = entry.user === "System";

              return (
                <article
                  key={entry.id}
                  className={`message-row${isOwnMessage ? " own" : ""}${isSystemMessage ? " system" : ""}`}
                >
                  <div className="message-bubble">
                    <div className="message-header">
                      <strong>{entry.user}</strong>
                      <span>{formatTime(entry.timestamp)}</span>
                    </div>
                    <p>{entry.text}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <form className="composer" onSubmit={handleMessageSubmit}>
            <input
              aria-label="Type a message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message"
            />
            <button className="button" type="submit" disabled={!isConnected}>
              Send
            </button>
          </form>
          <p className="message-summary">
            {totalMessages} user messages in this group.
          </p>
        </section>
      </section>
    </div>
  );
}
