"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import CallPanel from "@/components/CallPanel";
import { useRoomCall } from "@/lib/useRoomCall";
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
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const call = useRoomCall(socketInstance, activeRoom?.id ?? null);

  useEffect(() => {
    socket = io({
      transports: ["websocket"],
    });
    setSocketInstance(socket);

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
      setSocketInstance(null);
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
            Simple realtime chat.
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
            <div className="transcript-actions">
              {lastMessage && (
                <span className="message-meta">
                  Last event at {formatTime(lastMessage.timestamp)}
                </span>
              )}
              {call.status === "idle" && (
                <button
                  className="button call-start"
                  type="button"
                  onClick={() => void call.join()}
                  disabled={!isConnected}
                >
                  {call.roomCallCount > 0
                    ? `Join call (${call.roomCallCount})`
                    : "Start call"}
                </button>
              )}
              {call.status === "joining" && (
                <span className="message-meta">Connecting call…</span>
              )}
            </div>
          </div>

          {call.incomingRing && call.status === "idle" && (
            <div className="call-ring" role="alert">
              <span>
                <strong>{call.incomingRing.user}</strong> started a call in{" "}
                {call.incomingRing.roomName}.
              </span>
              <div className="call-ring-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => void call.join()}
                >
                  Join
                </button>
                <button
                  className="call-control"
                  type="button"
                  onClick={call.dismissRing}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {call.error && (
            <p className="notice-text" role="alert">
              {call.error}{" "}
              <button
                className="link-button"
                type="button"
                onClick={call.clearError}
              >
                Dismiss
              </button>
            </p>
          )}

          {call.status === "in-call" && (
            <CallPanel
              displayName={displayName}
              localStream={call.localStream}
              peers={call.peers}
              audioEnabled={call.audioEnabled}
              videoEnabled={call.videoEnabled}
              hasCamera={call.hasCamera}
              onToggleMic={call.toggleMic}
              onToggleCamera={call.toggleCamera}
              onLeave={call.leave}
            />
          )}

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
