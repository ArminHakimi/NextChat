import type { Socket } from "socket.io-client";
import type { CallPeer, SignalData } from "@/lib/roomCallTypes";

export interface PeerLink {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  queue: Promise<void>;
}

interface PeerLinkOptions {
  socket: Socket;
  peerId: string;
  iceServers: RTCIceServer[];
  localStream: MediaStream | null;
  upsertPeer: (id: string, patch: Partial<CallPeer>) => void;
}

export const sendSignal = (socket: Socket, to: string, data: SignalData) => {
  socket.emit("call:signal", { to, data });
};

export const createPeerLink = ({
  socket,
  peerId,
  iceServers,
  localStream,
  upsertPeer,
}: PeerLinkOptions): PeerLink => {
  const pc = new RTCPeerConnection({ iceServers });
  const link: PeerLink = {
    pc,
    polite: (socket.id ?? "") > peerId,
    makingOffer: false,
    ignoreOffer: false,
    queue: Promise.resolve(),
  };

  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onnegotiationneeded = async () => {
    try {
      link.makingOffer = true;
      await pc.setLocalDescription();

      if (pc.localDescription) {
        sendSignal(socket, peerId, {
          description: pc.localDescription.toJSON(),
        });
      }
    } catch (negotiationError) {
      console.error("Call negotiation failed:", negotiationError);
    } finally {
      link.makingOffer = false;
    }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      sendSignal(socket, peerId, { candidate: candidate.toJSON() });
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

export const processSignal = async (
  socket: Socket,
  link: PeerLink,
  peerId: string,
  data: SignalData,
) => {
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
        sendSignal(socket, peerId, {
          description: pc.localDescription.toJSON(),
        });
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
