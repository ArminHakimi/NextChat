import type { IncomingRing } from "@/lib/roomCallTypes";

export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export const getLocalMedia = async (): Promise<MediaStream> => {
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
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
};

export const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const response = await fetch("/api/ice", { cache: "no-store" });
    const body = (await response.json()) as { iceServers?: RTCIceServer[] };
    return body.iceServers?.length ? body.iceServers : FALLBACK_ICE_SERVERS;
  } catch {
    return FALLBACK_ICE_SERVERS;
  }
};

export const playRingtone = (): void => {
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

export const requestNotificationPermission = (): void => {
  if ("Notification" in window && Notification.permission === "default") {
    void Notification.requestPermission();
  }
};

export const showRingNotification = async (ring: IncomingRing): Promise<void> => {
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
