import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "nextchat_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

interface AuthConfig {
  password: string;
  secret: string;
}

export function isAuthRequired(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.APP_PASSWORD || process.env.APP_AUTH_SECRET)
  );
}

export function getAuthConfig(): AuthConfig | null {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.APP_AUTH_SECRET;

  if (!password || !secret || Buffer.byteLength(secret, "utf8") < 32) {
    return null;
  }

  return { password, secret };
}

export function verifyPassword(password: string, config: AuthConfig): boolean {
  const provided = createHmac("sha256", config.secret)
    .update(password)
    .digest();
  const expected = createHmac("sha256", config.secret)
    .update(config.password)
    .digest();

  return timingSafeEqual(provided, expected);
}

function getSessionKey(config: AuthConfig): Buffer {
  return createHmac("sha256", config.secret)
    .update("nextchat-session-v1:")
    .update(config.password)
    .digest();
}

export function createSessionToken(config: AuthConfig): string {
  const issuedAt = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const payload = `${issuedAt}.${nonce}`;
  const signature = createHmac("sha256", getSessionKey(config))
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

function isValidSessionToken(token: string, config: AuthConfig): boolean {
  const [issuedAtValue, nonce, signature, extra] = token.split(".");
  const issuedAt = Number(issuedAtValue);

  if (
    extra !== undefined ||
    !Number.isSafeInteger(issuedAt) ||
    !/^[a-f0-9]{32}$/.test(nonce ?? "") ||
    !/^[a-f0-9]{64}$/.test(signature ?? "") ||
    issuedAt > Date.now() ||
    Date.now() - issuedAt > SESSION_MAX_AGE_MS
  ) {
    return false;
  }

  const payload = `${issuedAtValue}.${nonce}`;
  const expected = createHmac("sha256", getSessionKey(config))
    .update(payload)
    .digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export function hasValidSession(cookieHeader: string | null | undefined): boolean {
  const config = getAuthConfig();
  if (!config || !cookieHeader) {
    return false;
  }

  const cookiePrefix = `${AUTH_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));

  return cookie
    ? isValidSessionToken(cookie.slice(cookiePrefix.length), config)
    : false;
}
