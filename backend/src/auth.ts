// Google Sign-In verification + our own session cookie, for the Paçoca Worker.
//
// Flow: the browser gets a Google ID token (a JWT) from Google Identity Services
// and POSTs it to /api/auth/google. We verify that JWT's RS256 signature against
// Google's public keys (JWKS), check aud/iss/exp, upsert the user, then mint our
// OWN session token — an HMAC-signed cookie — so later requests don't re-verify
// against Google. Everything uses Web Crypto (available in Workers); no libraries.

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export const SESSION_COOKIE = "pacoca_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface GoogleClaims {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
	aud: string;
	iss: string;
	exp: number;
}

export interface SessionUser {
	id: string;
	name: string | null;
}

// --- base64url helpers -----------------------------------------------------

function b64urlToBytes(s: string): Uint8Array {
	const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function bytesToB64url(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToJson<T>(s: string): T {
	return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

// --- Google ID token verification ------------------------------------------

interface Jwk {
	kid: string;
	n: string;
	e: string;
	[k: string]: unknown;
}

// Small in-isolate cache for Google's signing keys (they rotate slowly).
let jwksCache: { keys: Jwk[]; expires: number } | null = null;

async function fetchGoogleKeys(): Promise<Jwk[]> {
	if (jwksCache && jwksCache.expires > Date.now()) return jwksCache.keys;
	const resp = await fetch(GOOGLE_JWKS_URL);
	if (!resp.ok) throw new Error("failed to fetch Google JWKS");
	const data = (await resp.json()) as { keys: Jwk[] };
	// Respect Cache-Control max-age when present; default 1h.
	const cc = resp.headers.get("cache-control") ?? "";
	const m = cc.match(/max-age=(\d+)/);
	const ttl = m ? Number.parseInt(m[1], 10) * 1000 : 3600_000;
	jwksCache = { keys: data.keys, expires: Date.now() + ttl };
	return data.keys;
}

// Verifies a Google ID token and returns its claims, or null if invalid.
export async function verifyGoogleIdToken(
	idToken: string,
	clientId: string,
): Promise<GoogleClaims | null> {
	const parts = idToken.split(".");
	if (parts.length !== 3) return null;
	const [headerB64, payloadB64, sigB64] = parts;

	let header: { kid?: string; alg?: string };
	let claims: GoogleClaims;
	try {
		header = b64urlToJson(headerB64);
		claims = b64urlToJson<GoogleClaims>(payloadB64);
	} catch {
		return null;
	}
	if (header.alg !== "RS256" || !header.kid) return null;

	const keys = await fetchGoogleKeys();
	const jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) return null;

	const key = await crypto.subtle.importKey(
		"jwk",
		{ kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const ok = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		b64urlToBytes(sigB64),
		signed,
	);
	if (!ok) return null;

	// Claim checks: audience is our app, issuer is Google, not expired.
	if (claims.aud !== clientId) return null;
	if (!GOOGLE_ISSUERS.includes(claims.iss)) return null;
	if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
	if (!claims.sub) return null;

	return claims;
}

// --- our session cookie (HMAC-signed, stateless) ---------------------------

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

// Signs { uid, exp } into "<payload>.<sig>" (both base64url).
export async function mintSession(userId: string, secret: string): Promise<string> {
	const payload = { uid: userId, exp: Date.now() + SESSION_TTL_MS };
	const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
	const key = await hmacKey(secret);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
	return `${payloadB64}.${bytesToB64url(new Uint8Array(sig))}`;
}

// Verifies a session token and returns its user id, or null.
export async function readSession(token: string, secret: string): Promise<string | null> {
	const dot = token.indexOf(".");
	if (dot < 0) return null;
	const payloadB64 = token.slice(0, dot);
	const sigB64 = token.slice(dot + 1);
	const key = await hmacKey(secret);
	const ok = await crypto.subtle.verify(
		"HMAC",
		key,
		b64urlToBytes(sigB64),
		new TextEncoder().encode(payloadB64),
	);
	if (!ok) return null;
	try {
		const { uid, exp } = b64urlToJson<{ uid: string; exp: number }>(payloadB64);
		if (typeof exp !== "number" || exp <= Date.now() || !uid) return null;
		return uid;
	} catch {
		return null;
	}
}

// --- cookie header plumbing ------------------------------------------------

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("Cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const [k, ...v] = part.trim().split("=");
		if (k === name) return decodeURIComponent(v.join("="));
	}
	return null;
}

export function sessionCookieHeader(token: string): string {
	const maxAge = Math.floor(SESSION_TTL_MS / 1000);
	return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
	return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
