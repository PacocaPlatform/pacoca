// Paçoca community levels API (Cloudflare Worker + D1).
//
// Publishes and serves user-created levels as the canonical structured JSON that
// the in-engine RuntimeLevelBuilder consumes. Anonymous publishing today; the
// schema reserves author_id for when user login is added.
//
// Routes:
//   GET  /api/health
//   GET  /api/levels?sort=new|popular&limit=&offset=   -> listing (no map_json)
//   GET  /api/levels/:id                               -> full level incl. map
//   POST /api/levels        { name, theme, map, author_name? } -> { id }
//   POST /api/levels/:id/play                          -> { play_count }

import { validatePublish, SCHEMA_VERSION } from "./validation";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

interface LevelRow {
	id: string;
	name: string;
	theme: string;
	author_name: string | null;
	map_json: string;
	play_count: number;
	created_at: number;
	updated_at: number;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return corsPreflight(request);
		}

		try {
			const res = await route(request, env, url);
			return withCors(request, res);
		} catch (err) {
			console.error(JSON.stringify({ level: "error", msg: String(err) }));
			return withCors(request, json({ error: "internal error" }, 500));
		}
	},
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, url: URL): Promise<Response> {
	const path = url.pathname.replace(/\/+$/, "");
	const method = request.method;

	// Non-API paths are the static site (landing + game + editor), served from
	// the R2 bucket so the oversized game files (index.pck ~137MB, index.wasm
	// ~38MB) sidestep the 25 MiB/file limit of Pages/Static Assets.
	if (path !== "/api" && !path.startsWith("/api/")) {
		return serveStatic(request, env, url);
	}

	if (method === "GET" && path === "/api/health") {
		return json({ ok: true });
	}

	if (method === "GET" && path === "/api/levels") {
		return listLevels(env, url);
	}

	if (method === "POST" && path === "/api/levels") {
		return publishLevel(request, env);
	}

	const playMatch = path.match(/^\/api\/levels\/([^/]+)\/play$/);
	if (method === "POST" && playMatch) {
		return incrementPlay(env, decodeURIComponent(playMatch[1]));
	}

	const itemMatch = path.match(/^\/api\/levels\/([^/]+)$/);
	if (method === "GET" && itemMatch) {
		return getLevel(env, decodeURIComponent(itemMatch[1]));
	}

	return json({ error: "not found" }, 404);
}

// --- Static assets from R2 -------------------------------------------------
//
// The deploy bundle (build/dist/) is uploaded to the R2 bucket bound as ASSETS
// (see deploy_r2.sh). This keeps everything — site, game and API — on one origin,
// which the editor's localStorage handoff and the same-origin /api both need.

const CONTENT_TYPES: Record<string, string> = {
	html: "text/html; charset=utf-8",
	js: "text/javascript; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	css: "text/css; charset=utf-8",
	json: "application/json; charset=utf-8",
	wasm: "application/wasm", // must be exact for streaming compilation
	pck: "application/octet-stream",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	webp: "image/webp",
	txt: "text/plain; charset=utf-8",
	woff2: "font/woff2",
	wav: "audio/wav",
	mp3: "audio/mpeg",
	ogg: "audio/ogg",
};

// Maps a URL path to an R2 object key: strips the leading slash, resolves
// directories to index.html, and blocks `..` traversal.
function assetKey(pathname: string): string {
	let p = decodeURIComponent(pathname).replace(/^\/+/, "");
	if (p === "" || p.endsWith("/")) p += "index.html";
	return p.replace(/\.\.+/g, "").replace(/\/{2,}/g, "/");
}

async function serveStatic(request: Request, env: Env, url: URL): Promise<Response> {
	if (!env.ASSETS) return json({ error: "not found (no ASSETS bucket bound)" }, 404);
	if (request.method !== "GET" && request.method !== "HEAD") {
		return json({ error: "method not allowed" }, 405);
	}

	let key = assetKey(url.pathname);
	let obj = await env.ASSETS.get(key);

	// Bare directory path without a trailing slash (e.g. /editor) -> its index.
	if (!obj && !key.includes(".")) {
		key = key.replace(/\/+$/, "") + "/index.html";
		obj = await env.ASSETS.get(key);
	}
	if (!obj || !obj.body) return json({ error: "not found" }, 404);

	const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
	const headers = new Headers();
	// Trust our own extension map first so .wasm is always application/wasm.
	headers.set("content-type", CONTENT_TYPES[ext] ?? obj.httpMetadata?.contentType ?? "application/octet-stream");
	headers.set("etag", obj.httpEtag);
	// index.html changes on every deploy; other assets keep the fixed names Godot
	// emits, so revalidate them too but allow a short cache.
	headers.set("cache-control", ext === "html" ? "public, max-age=60" : "public, max-age=3600");

	return new Response(request.method === "HEAD" ? null : obj.body, { headers });
}

// GET /api/levels — public listing (no heavy map_json payload).
async function listLevels(env: Env, url: URL): Promise<Response> {
	const sort = url.searchParams.get("sort") === "popular" ? "popular" : "new";
	const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
	const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1_000_000);

	const orderBy = sort === "popular" ? "play_count DESC, created_at DESC" : "created_at DESC";
	const stmt = env.DB.prepare(
		`SELECT id, name, theme, author_name, play_count, created_at
		 FROM levels
		 WHERE is_public = 1 AND status = 'active'
		 ORDER BY ${orderBy}
		 LIMIT ? OFFSET ?`,
	).bind(limit, offset);

	const { results } = await stmt.all<Omit<LevelRow, "map_json" | "updated_at">>();
	return json({ levels: results ?? [], limit, offset, sort });
}

// GET /api/levels/:id — full level including the structured map.
async function getLevel(env: Env, id: string): Promise<Response> {
	const row = await env.DB.prepare(
		`SELECT id, name, theme, author_name, map_json, play_count, created_at, updated_at
		 FROM levels WHERE id = ? AND status != 'removed'`,
	)
		.bind(id)
		.first<LevelRow>();

	if (!row) return json({ error: "not found" }, 404);

	let map: unknown;
	try {
		map = JSON.parse(row.map_json);
	} catch {
		return json({ error: "corrupt level data" }, 500);
	}

	return json({
		id: row.id,
		name: row.name,
		theme: row.theme,
		author_name: row.author_name,
		play_count: row.play_count,
		created_at: row.created_at,
		map,
	});
}

// POST /api/levels — publish a new level (anonymous for now).
async function publishLevel(request: Request, env: Env): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: "invalid JSON body" }, 400);
	}

	const result = validatePublish(body);
	if (!result.ok) return json({ error: result.error }, 400);

	const now = Date.now();
	const id = crypto.randomUUID();
	const { name, theme, author_name, map_json } = result.value;

	await env.DB.prepare(
		`INSERT INTO levels
		 (id, name, theme, author_id, author_name, map_json, schema_version,
		  play_count, is_public, status, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, ?, ?, ?, 0, 1, 'active', ?, ?)`,
	)
		.bind(id, name, theme, author_name, map_json, SCHEMA_VERSION, now, now)
		.run();

	return json({ id, name, theme, created_at: now }, 201);
}

// POST /api/levels/:id/play — best-effort play counter.
async function incrementPlay(env: Env, id: string): Promise<Response> {
	const row = await env.DB.prepare(
		`UPDATE levels SET play_count = play_count + 1
		 WHERE id = ? AND status = 'active'
		 RETURNING play_count`,
	)
		.bind(id)
		.first<{ play_count: number }>();

	if (!row) return json({ error: "not found" }, 404);
	return json({ play_count: row.play_count });
}

// --- helpers ---------------------------------------------------------------

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
	const n = raw === null ? NaN : Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

// CORS: the editor and game run in the browser and may be on a different origin
// during local dev. Reflect the request origin so credentials-free fetches work.
function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("Origin") ?? "*";
	return {
		"access-control-allow-origin": origin,
		"access-control-allow-methods": "GET, POST, OPTIONS",
		"access-control-allow-headers": "content-type",
		"access-control-max-age": "86400",
		vary: "Origin",
	};
}

function corsPreflight(request: Request): Response {
	return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function withCors(request: Request, res: Response): Response {
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
