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

export interface ParticipantInfo {
  id: string;
  user: string;
  audio: boolean;
  video: boolean;
}

export interface SignalData {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
