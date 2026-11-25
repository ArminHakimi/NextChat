"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export interface CallPeer {
  id: string;
  user: string;
  audio: boolean;
  video: boolean;
  stream: MediaStream | null;
}

export interface IncomingRing {
  roomId: string;
  roomName: string;
  user: string;
}

export type CallStatus = "idle" | "joining" | "in-call";

interface ParticipantInfo {
  id: string;
  user: string;
  audio: boolean;
  video: boolean;
}

interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface PeerLink {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  queue: Promise<void>;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const getLocalMedia = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Calls need a secure connection (HTTPS or localhost) and a browser with camera/mic support.",
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
  } catch {
    // No camera (or camera denied): fall back to a voice-only call.
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
};

const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const response = await fetch("/api/ice", { cache: "no-store" });
    const body = (await response.json()) as { iceServers?: RTCIceServer[] };
    return body.iceServers?.length ? body.iceServers : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
};

const playRingtone = (): void => {
  try {
    const context = new AudioContext();
    void context.resume();
    const start = context.currentTime;

    [0, 0.35, 1.2, 1.55].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + offset;

      oscillator.frequency.value = index % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.32);
    });

    window.setTimeout(() => void context.close(), 2500);
  } catch {
    // Audio may be blocked until the user interacts with the page.
  }
};

const requestNotificationPermission = (): void => {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
};

const showRingNotification = async (ring: IncomingRing): Promise<void> => {
  if (
    !document.hidden ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const title = `${ring.user} started a call`;
  const options: NotificationOptions = {
    body: `Join the call in ${ring.roomName}.`,
    tag: `call-${ring.roomId}`,
    icon: "/pwa-icons/192",
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();

    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall back to a page-level notification below.
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

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

    const sendSignal = (to: string, data: SignalData) => {
      socket.emit("call:signal", { to, data });
    };

    const getLink = (peerId: string): PeerLink => {
      const existing = linksRef.current.get(peerId);

      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const link: PeerLink = {
        pc,
        // Deterministic roles for "perfect negotiation": exactly one side yields on glare.
        polite: (socket.id ?? "") > peerId,
        makingOffer: false,
        ignoreOffer: false,
        queue: Promise.resolve(),
      };

      linksRef.current.set(peerId, link);

      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onnegotiationneeded = async () => {
        try {
          link.makingOffer = true;
          await pc.setLocalDescription();

          if (pc.localDescription) {
            sendSignal(peerId, { description: pc.localDescription.toJSON() });
          }
        } catch (negotiationError) {
          console.error("Call negotiation failed:", negotiationError);
        } finally {
          link.makingOffer = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendSignal(peerId, { candidate: candidate.toJSON() });
        }
      };

      pc.ontrack = ({ track, streams }) => {
        upsertPeer(peerId, { stream: streams[0] ?? new MediaStream([track]) });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          pc.restartIce();
        }
      };

      return link;
    };

    const processSignal = async (link: PeerLink, peerId: string, data: SignalData) => {
      const { pc } = link;

      if (data.description) {
        const offerCollision =
          data.description.type === "offer" &&
          (link.makingOffer || pc.signalingState !== "stable");

        link.ignoreOffer = !link.polite && offerCollision;

        if (link.ignoreOffer) {
          return;
        }

        await pc.setRemoteDescription(data.description);

        if (data.description.type === "offer") {
          await pc.setLocalDescription();

          if (pc.localDescription) {
            sendSignal(peerId, { description: pc.localDescription.toJSON() });
          }
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (candidateError) {
          if (!link.ignoreOffer) {
            throw candidateError;
          }
        }
      }
    };

    const onSignal = ({ from, data }: { from: string; data: SignalData }) => {
      if (statusRef.current !== "in-call" || !data) {
        return;
      }

      const link = getLink(from);

      // Serialize per peer so ICE candidates never race ahead of their description.
      link.queue = link.queue
        .then(() => processSignal(link, from, data))
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
