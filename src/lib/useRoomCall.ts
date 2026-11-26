"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  FALLBACK_ICE_SERVERS,
  fetchIceServers,
  getLocalMedia,
  playRingtone,
  requestNotificationPermission,
  showRingNotification,
} from "@/lib/roomCallMedia";
import {
  createPeerLink,
  processSignal,
  type PeerLink,
} from "@/lib/roomCallSignaling";
import type {
  CallPeer,
  CallStatus,
  IncomingRing,
  ParticipantInfo,
  SignalData,
} from "@/lib/roomCallTypes";

export type { CallPeer, CallStatus, IncomingRing } from "@/lib/roomCallTypes";

export function useRoomCall(socket: Socket | null, roomId: string | null) {
  const [status, setStatusState] = useState<CallStatus>("idle");
  const [peers, setPeers] = useState<Record<string, CallPeer>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [callCounts, setCallCounts] = useState<Record<string, number>>({});
  const [incomingRing, setIncomingRing] = useState<IncomingRing | null>(null);
  const [error, setError] = useState("");

  const statusRef = useRef<CallStatus>("idle");
  const roomIdRef = useRef(roomId);
  const linksRef = useRef(new Map<string, PeerLink>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);

  const setStatus = (next: CallStatus) => {
    statusRef.current = next;
    setStatusState(next);
  };

  const upsertPeer = (id: string, patch: Partial<CallPeer>) => {
    setPeers((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          id,
          user: "Guest",
          audio: true,
          video: true,
          stream: null,
        }),
        ...patch,
      },
    }));
  };

  const removePeer = (id: string) => {
    linksRef.current.get(id)?.pc.close();
    linksRef.current.delete(id);
    setPeers((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  };

  const cleanup = useCallback(
    (notifyServer: boolean) => {
      linksRef.current.forEach((link) => link.pc.close());
      linksRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setPeers({});

      if (notifyServer && statusRef.current !== "idle" && socket?.connected) {
        socket.emit("call:leave");
      }

      setStatus("idle");
    },
    [socket],
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const getLink = (peerId: string): PeerLink => {
      const existing = linksRef.current.get(peerId);

      if (existing) {
        return existing;
      }

      const link = createPeerLink({
        socket,
        peerId,
        iceServers: iceServersRef.current,
        localStream: localStreamRef.current,
        upsertPeer,
      });

      linksRef.current.set(peerId, link);
      return link;
    };

    const onSignal = ({ from, data }: { from: string; data: SignalData }) => {
      if (statusRef.current !== "in-call" || !data) {
        return;
      }

      const link = getLink(from);

      // Serialize per peer so ICE candidates never race ahead of their description.
      link.queue = link.queue
        .then(() => processSignal(socket, link, from, data))
        .catch((signalError) => console.error("Call signal failed:", signalError));
    };

    const onParticipants = (participants: ParticipantInfo[]) => {
      participants.forEach((participant) => {
        upsertPeer(participant.id, participant);
        // The newcomer initiates; adding tracks triggers onnegotiationneeded.
        getLink(participant.id);
      });
    };

    const onPeerJoined = (participant: ParticipantInfo) => {
      if (statusRef.current === "in-call") {
        upsertPeer(participant.id, participant);
      }
    };

    const onPeerLeft = (id: string) => {
      removePeer(id);
    };

    const onPeerMedia = (participant: ParticipantInfo) => {
      if (statusRef.current === "in-call" && participant.id !== socket.id) {
        upsertPeer(participant.id, participant);
      }
    };

    const onCallState = ({ roomId: stateRoomId, count }: { roomId: string; count: number }) => {
      setCallCounts((current) => ({ ...current, [stateRoomId]: count }));

      if (count === 0) {
        setIncomingRing((ring) => (ring?.roomId === stateRoomId ? null : ring));
      }
    };

    const onRing = (ring: IncomingRing) => {
      if (statusRef.current !== "idle" || ring.roomId !== roomIdRef.current) {
        return;
      }

      setIncomingRing(ring);
      playRingtone();
      void showRingNotification(ring);
    };

    const onCallError = (message: string) => {
      setError(message);
      cleanup(false);
    };

    const onDisconnect = () => {
      cleanup(false);
      setCallCounts({});
      setIncomingRing(null);
    };

    socket.on("call:signal", onSignal);
    socket.on("call:participants", onParticipants);
    socket.on("call:peer-joined", onPeerJoined);
    socket.on("call:peer-left", onPeerLeft);
    socket.on("call:peer-media", onPeerMedia);
    socket.on("call:state", onCallState);
    socket.on("call:ring", onRing);
    socket.on("call:error", onCallError);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("call:signal", onSignal);
      socket.off("call:participants", onParticipants);
      socket.off("call:peer-joined", onPeerJoined);
      socket.off("call:peer-left", onPeerLeft);
      socket.off("call:peer-media", onPeerMedia);
      socket.off("call:state", onCallState);
      socket.off("call:ring", onRing);
      socket.off("call:error", onCallError);
      socket.off("disconnect", onDisconnect);
      cleanup(true);
    };
  }, [socket, cleanup]);

  useEffect(() => {
    if (roomIdRef.current === roomId) {
      return;
    }

    roomIdRef.current = roomId;
    setIncomingRing(null);

    // The server already removed us from the old room's call when we switched rooms.
    if (statusRef.current !== "idle") {
      cleanup(false);
    }
  }, [roomId, cleanup]);

  const join = useCallback(async () => {
    if (!socket?.connected || statusRef.current !== "idle") {
      return;
    }

    setStatus("joining");
    setError("");
    setIncomingRing(null);
    requestNotificationPermission();

    try {
      const [stream, iceServers] = await Promise.all([
        getLocalMedia(),
        fetchIceServers(),
      ]);

      // Status can change while awaiting (e.g. room switch); re-read the ref.
      if ((statusRef.current as CallStatus) !== "joining") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const audio = stream.getAudioTracks().length > 0;
      const video = stream.getVideoTracks().length > 0;

      iceServersRef.current = iceServers;
      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(audio);
      setVideoEnabled(video);
      setStatus("in-call");

      socket.emit("call:join", { audio, video });
    } catch (joinError) {
      setError(
        joinError instanceof Error && joinError.message.startsWith("Calls need")
          ? joinError.message
          : "Could not access your camera or microphone. Check browser permissions.",
      );
      setStatus("idle");
    }
  }, [socket]);

  const leave = useCallback(() => cleanup(true), [cleanup]);

  const emitMediaState = (audio: boolean, video: boolean) => {
    socket?.emit("call:media-state", { audio, video });
  };

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];

    if (tracks.length === 0) {
      return;
    }

    const next = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = next;
    });
    setAudioEnabled(next);
    emitMediaState(next, videoEnabled);
  }, [videoEnabled, socket]);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];

    if (tracks.length === 0) {
      return;
    }

    const next = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = next;
    });
    setVideoEnabled(next);
    emitMediaState(audioEnabled, next);
  }, [audioEnabled, socket]);

  return {
    status,
    peers: Object.values(peers),
    localStream,
    audioEnabled,
    videoEnabled,
    hasCamera: (localStream?.getVideoTracks().length ?? 0) > 0,
    roomCallCount: roomId ? (callCounts[roomId] ?? 0) : 0,
    incomingRing,
    error,
    join,
    leave,
    toggleMic,
    toggleCamera,
    dismissRing: () => setIncomingRing(null),
    clearError: () => setError(""),
  };
}
