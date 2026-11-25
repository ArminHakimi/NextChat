"use client";

import { useEffect, useRef } from "react";
import type { CallPeer } from "@/lib/useRoomCall";

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  audioOn: boolean;
  videoOn: boolean;
  isLocal?: boolean;
}

function VideoTile({ stream, name, audioOn, videoOn, isLocal }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const showVideo = Boolean(stream) && videoOn;

  return (
    <figure className={`call-tile${isLocal ? " local" : ""}`}>
      {/* Kept mounted even when hidden so remote audio keeps playing. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={showVideo ? "" : "hidden"}
      />
      {!showVideo && (
        <div className="call-avatar" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <figcaption>
        <span>{isLocal ? `${name} (you)` : name}</span>
        {!audioOn && <span className="call-badge">Muted</span>}
        {!stream && !isLocal && <span className="call-badge">Connecting…</span>}
      </figcaption>
    </figure>
  );
}

interface CallPanelProps {
  displayName: string;
  localStream: MediaStream | null;
  peers: CallPeer[];
  audioEnabled: boolean;
  videoEnabled: boolean;
  hasCamera: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}

export default function CallPanel({
  displayName,
  localStream,
  peers,
  audioEnabled,
  videoEnabled,
  hasCamera,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: CallPanelProps) {
  return (
    <section className="call-panel" aria-label="Call">
      <div className="call-grid">
        <VideoTile
          stream={localStream}
          name={displayName}
          audioOn={audioEnabled}
          videoOn={videoEnabled}
          isLocal
        />
        {peers.map((peer) => (
          <VideoTile
            key={peer.id}
            stream={peer.stream}
            name={peer.user}
            audioOn={peer.audio}
            videoOn={peer.video}
          />
        ))}
      </div>
      {peers.length === 0 && (
        <p className="call-hint">Waiting for others in this group to join…</p>
      )}
      <div className="call-controls">
        <button
          type="button"
          className={`call-control${audioEnabled ? "" : " off"}`}
          onClick={onToggleMic}
          aria-pressed={!audioEnabled}
        >
          {audioEnabled ? "Mute" : "Unmute"}
        </button>
        <button
          type="button"
          className={`call-control${videoEnabled ? "" : " off"}`}
          onClick={onToggleCamera}
          disabled={!hasCamera}
          aria-pressed={!videoEnabled}
        >
          {!hasCamera ? "No camera" : videoEnabled ? "Camera off" : "Camera on"}
        </button>
        <button type="button" className="call-control leave" onClick={onLeave}>
          Leave call
        </button>
      </div>
    </section>
  );
}
