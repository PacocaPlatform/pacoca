// Paçoca community levels API (Cloudflare Worker + D1).
//
// Publishes and serves user-created levels as the canonical structured JSON that
// the in-engine RuntimeLevelBuilder consumes. Anonymous publishing today; the
// schema reserves author_id for when user login is added.
//
// Routes:
//   GET  /api/health
//   GET  /api/config                                  -> { google_client_id }
//   POST /api/auth/google   { id_token }              -> sets session cookie, { user }
//   POST /api/auth/logout                             -> clears session cookie
//   GET  /api/me                                      -> { user (incl is_admin) } | null
//   GET  /api/me/levels     (login required)          -> caller's own levels
//   GET  /api/me/collection (login required)          -> levels in caller's collection
//   GET  /api/me/interactions                          -> { liked:[ids], collected:[ids] }
//   GET  /api/admin/levels?status=  (admin required)  -> all levels for moderation
//   GET  /api/levels?sort=new|popular|liked&difficulty=&author=&limit=&offset=  -> listing (no map_json)
//   GET  /api/authors?limit=                           -> author leaderboard by plays
//   GET  /api/levels/:id                               -> full level incl. map, liked
//   POST /api/levels        { name, theme, difficulty, map, source? }  (login required) -> { id }
//   PUT  /api/levels/:id     { name, theme, difficulty, map, source? }  (author only) -> { id }
//   POST /api/levels/:id/play                          -> { play_count }
//   POST|DELETE /api/levels/:id/like   (login required) -> { liked, like_count }
//   POST|DELETE /api/levels/:id/collect (login required) -> { collected }
//   POST /api/levels/:id/moderate { status }  (admin) -> { id, status }
//   DELETE /api/levels/:id      (author or admin)     -> soft-remove -> { ok }

import { validatePublish, SCHEMA_VERSION, DIFFICULTIES } from "./validation";
import {
	verifyGoogleIdToken,
	mintSession,
	readSession,
	readCookie,
	sessionCookieHeader,
	clearSessionCookieHeader,
	SESSION_COOKIE,
	type SessionUser,
} from "./auth";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

interface LevelRow {
	id: string;
	name: string;
	theme: string;
	difficulty: string;
	author_id: string | null;
	author_name: string | null;
	map_json: string;
	source_text: string | null;
	play_count: number;
	like_count: number;
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
		// Pretty level links /l/<id> (no file extension) render the level page;
		// the client reads the id from the path. Real files under /l/ (index.html,
		// play.html, level.js) still resolve normally.
		if (/^\/l\/[^/.]+$/.test(path)) {
			return serveStatic(request, env, new URL("/l/index.html", url));
		}
		return serveStatic(request, env, url);
	}

	if (method === "GET" && path === "/api/health") {
		return json({ ok: true });
	}

	// Public config for the frontend (the Google client id is public by design —
	// it also ships in the Sign-In button). Lets the editor init GIS without
	// hardcoding the id in HTML.
	if (method === "GET" && path === "/api/config") {
		return json({ google_client_id: env.GOOGLE_CLIENT_ID ?? "" });
	}

	if (method === "POST" && path === "/api/auth/google") {
		return authGoogle(request, env);
	}

	if (method === "POST" && path === "/api/auth/logout") {
		return json({ ok: true }, 200, { "set-cookie": clearSessionCookieHeader() });
	}

	if (method === "GET" && path === "/api/me") {
		const user = await currentUser(request, env);
		return json({ user: user ? { ...user, is_admin: isAdmin(user, env) } : null });
	}

	if (method === "GET" && path === "/api/me/levels") {
		return listMyLevels(request, env);
	}

	if (method === "GET" && path === "/api/me/collection") {
		return listMyCollection(request, env);
	}

	if (method === "GET" && path === "/api/me/interactions") {
		return listMyInteractions(request, env);
	}

	// Moderation: admins list all levels (any status) and can hide/remove/restore.
	if (method === "GET" && path === "/api/admin/levels") {
		return adminListLevels(request, env, url);
	}

	if (method === "GET" && path === "/api/levels") {
		return listLevels(env, url);
	}

	if (method === "POST" && path === "/api/levels") {
		return publishLevel(request, env);
	}

	if (method === "GET" && path === "/api/authors") {
		return listAuthors(env, url);
	}

	const playMatch = path.match(/^\/api\/levels\/([^/]+)\/play$/);
	if (method === "POST" && playMatch) {
		return incrementPlay(env, decodeURIComponent(playMatch[1]));
	}

	const likeMatch = path.match(/^\/api\/levels\/([^/]+)\/like$/);
	if (likeMatch && (method === "POST" || method === "DELETE")) {
		return toggleLike(request, env, decodeURIComponent(likeMatch[1]), method === "POST");
	}

	const collectMatch = path.match(/^\/api\/levels\/([^/]+)\/collect$/);
	if (collectMatch && (method === "POST" || method === "DELETE")) {
		return toggleCollect(request, env, decodeURIComponent(collectMatch[1]), method === "POST");
	}

	const moderateMatch = path.match(/^\/api\/levels\/([^/]+)\/moderate$/);
	if (method === "POST" && moderateMatch) {
		return moderateLevel(request, env, decodeURIComponent(moderateMatch[1]));
	}

	const deleteMatch = path.match(/^\/api\/levels\/([^/]+)$/);
	if (method === "DELETE" && deleteMatch) {
		return deleteLevel(request, env, decodeURIComponent(deleteMatch[1]));
	}

	const updateMatch = path.match(/^\/api\/levels\/([^/]+)$/);
	if ((method === "PUT" || method === "PATCH") && updateMatch) {
		return updateLevel(request, env, decodeURIComponent(updateMatch[1]));
	}

	const itemMatch = path.match(/^\/api\/levels\/([^/]+)$/);
	if (method === "GET" && itemMatch) {
		return getLevel(request, env, decodeURIComponent(itemMatch[1]));
	}

	return json({ error: "not found" }, 404);
}

// --- Auth (Google Sign-In -> our session cookie) ---------------------------

// POST /api/auth/google { id_token } — verify the Google token, upsert the user,
// and set our HttpOnly session cookie.
async function authGoogle(request: Request, env: Env): Promise<Response> {
	if (!env.SESSION_SECRET || !env.GOOGLE_CLIENT_ID) {
		return json({ error: "auth not configured" }, 500);
	}
	let body: { id_token?: unknown };
	try {
		body = (await request.json()) as { id_token?: unknown };
	} catch {
		return json({ error: "invalid JSON body" }, 400);
	}
	const idToken = typeof body.id_token === "string" ? body.id_token : "";
	if (!idToken) return json({ error: "id_token required" }, 400);

	const claims = await verifyGoogleIdToken(idToken, env.GOOGLE_CLIENT_ID);
	if (!claims) return json({ error: "invalid Google token" }, 401);

	// Upsert by google_sub; keep the display fields fresh on every login.
	const now = Date.now();
	const existing = await env.DB.prepare(`SELECT id FROM users WHERE google_sub = ?`)
		.bind(claims.sub)
		.first<{ id: string }>();

	let userId: string;
	if (existing) {
		userId = existing.id;
		await env.DB.prepare(
			`UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?`,
		)
			.bind(claims.email ?? null, claims.name ?? null, claims.picture ?? null, userId)
			.run();
	} else {
		userId = crypto.randomUUID();
		await env.DB.prepare(
			`INSERT INTO users (id, google_sub, email, name, picture, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(userId, claims.sub, claims.email ?? null, claims.name ?? null, claims.picture ?? null, now)
			.run();
	}

	const token = await mintSession(userId, env.SESSION_SECRET);
	const user = {
		id: userId,
		name: claims.name ?? null,
		email: claims.email ?? null,
		picture: claims.picture ?? null,
	};
	return json({ user }, 200, { "set-cookie": sessionCookieHeader(token) });
}

// Resolves the caller's session cookie to a user row, or null if not logged in.
async function currentUser(request: Request, env: Env): Promise<
	{ id: string; name: string | null; email: string | null; picture: string | null } | null
> {
	if (!env.SESSION_SECRET) return null;
	const token = readCookie(request, SESSION_COOKIE);
	if (!token) return null;
	const uid = await readSession(token, env.SESSION_SECRET);
	if (!uid) return null;
	return env.DB.prepare(`SELECT id, name, email, picture FROM users WHERE id = ?`)
		.bind(uid)
		.first();
}

// Lightweight variant for endpoints that only need id + display name.
async function requireUser(request: Request, env: Env): Promise<SessionUser | null> {
	const u = await currentUser(request, env);
	return u ? { id: u.id, name: u.name } : null;
}

// Admins are an allowlist of emails in the ADMIN_EMAILS env var (comma-separated).
// No schema change — moderation rights are config, not data.
function isAdmin(user: { email: string | null }, env: Env): boolean {
	if (!user.email || !env.ADMIN_EMAILS) return false;
	const email = user.email.trim().toLowerCase();
	return env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email);
}

async function requireAdmin(request: Request, env: Env): Promise<
	{ id: string; name: string | null; email: string | null; picture: string | null } | null
> {
	const u = await currentUser(request, env);
	return u && isAdmin(u, env) ? u : null;
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
	// Cache policy by role:
	//  - HTML: short cache, it changes every deploy.
	//  - Game payload under play/ (index.pck/.wasm/.js): keep the FIXED names Godot
	//    emits but change on every re-export, so a stale copy would silently run
	//    old game code (e.g. a missing on-screen joystick). Force revalidation via
	//    ETag (cheap 304 when unchanged) so a new build always wins immediately.
	//  - Other static assets (fonts, images, editor): short cache is fine.
	const isGamePayload = key.startsWith("play/") && ext !== "html";
	headers.set(
		"cache-control",
		ext === "html"
			? "public, max-age=60"
			: isGamePayload
				? "public, no-cache"
				: "public, max-age=3600",
	);

	// Cross-origin isolation for the game page (play/) so SharedArrayBuffer is
	// available — Godot's threaded web export needs it to run the audio mixer on
	// a worker thread (otherwise music stutters on the main thread). Scoped to
	// play/ only: the marketing site / editor may load cross-origin subresources
	// that COEP: require-corp would block. The game loads as a top-level document
	// (site/l/play.html does location.replace), so no parent iframe needs these.
	if (key.startsWith("play/")) {
		headers.set("cross-origin-opener-policy", "same-origin");
		headers.set("cross-origin-embedder-policy", "require-corp");
		headers.set("cross-origin-resource-policy", "same-origin");
	}

	// Honor conditional requests so `no-cache` revalidation is a cheap 304 instead
	// of re-streaming the (large) payload when the client already has the current
	// version. Etags here are the strong R2 object etags.
	const inm = request.headers.get("If-None-Match");
	if (inm && inm === obj.httpEtag) {
		return new Response(null, { status: 304, headers });
	}

	return new Response(request.method === "HEAD" ? null : obj.body, { headers });
}

// GET /api/levels — public listing (no heavy map_json payload).
// sort=new (default) | popular (most played) | liked (most liked).
const LEVEL_ORDER: Record<string, string> = {
	new: "created_at DESC",
	popular: "play_count DESC, created_at DESC",
	liked: "like_count DESC, created_at DESC",
};

async function listLevels(env: Env, url: URL): Promise<Response> {
	const rawSort = url.searchParams.get("sort") ?? "new";
	const sort = rawSort in LEVEL_ORDER ? rawSort : "new";
	const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
	const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1_000_000);

	// Optional filters: difficulty (validated against the canonical set) and a
	// free-text author name match. Unknown/blank values are simply ignored.
	const conditions = ["is_public = 1", "status = 'active'"];
	const binds: (string | number)[] = [];

	const rawDiff = (url.searchParams.get("difficulty") ?? "").trim().toLowerCase();
	if ((DIFFICULTIES as readonly string[]).includes(rawDiff)) {
		conditions.push("difficulty = ?");
		binds.push(rawDiff);
	}

	const author = (url.searchParams.get("author") ?? "").trim();
	if (author) {
		conditions.push("author_name LIKE ? ESCAPE '\\'");
		binds.push("%" + escapeLike(author) + "%");
	}

	const stmt = env.DB.prepare(
		`SELECT id, name, theme, difficulty, author_id, author_name, play_count, like_count, created_at
		 FROM levels
		 WHERE ${conditions.join(" AND ")}
		 ORDER BY ${LEVEL_ORDER[sort]}
		 LIMIT ? OFFSET ?`,
	).bind(...binds, limit, offset);

	const { results } = await stmt.all();
	return json({ levels: results ?? [], limit, offset, sort });
}

// GET /api/authors — leaderboard of authors by total plays across their levels.
async function listAuthors(env: Env, url: URL): Promise<Response> {
	const limit = clampInt(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
	const { results } = await env.DB.prepare(
		`SELECT author_id,
		        MAX(author_name) AS author_name,
		        SUM(play_count)  AS plays,
		        SUM(like_count)  AS likes,
		        COUNT(*)         AS levels
		 FROM levels
		 WHERE is_public = 1 AND status = 'active' AND author_id IS NOT NULL
		 GROUP BY author_id
		 ORDER BY plays DESC, levels DESC
		 LIMIT ?`,
	)
		.bind(limit)
		.all();
	return json({ authors: results ?? [], limit });
}

// GET /api/levels/:id — full level including the structured map. If the caller is
// logged in, `liked` reflects whether they have already liked this level.
async function getLevel(request: Request, env: Env, id: string): Promise<Response> {
	// Only 'active' levels are publicly viewable/playable — 'hidden' (moderated or
	// author-unlisted) and 'removed' both 404 here, killing their share links.
	const row = await env.DB.prepare(
		`SELECT id, name, theme, difficulty, author_id, author_name, map_json, source_text,
		        play_count, like_count, created_at, updated_at
		 FROM levels WHERE id = ? AND status = 'active'`,
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

	let liked = false;
	const user = await requireUser(request, env);
	if (user) {
		const like = await env.DB.prepare(
			`SELECT 1 FROM likes WHERE user_id = ? AND level_id = ?`,
		)
			.bind(user.id, id)
			.first();
		liked = like !== null;
	}

	// The editor's ASCII source is only handed back to the author, so they can
	// reopen and edit their own level; other viewers never receive it.
	const isOwner = user != null && row.author_id != null && row.author_id === user.id;

	return json({
		id: row.id,
		name: row.name,
		theme: row.theme,
		difficulty: row.difficulty,
		author_id: row.author_id,
		author_name: row.author_name,
		play_count: row.play_count,
		like_count: row.like_count,
		liked,
		can_edit: isOwner,
		source: isOwner ? row.source_text : null,
		created_at: row.created_at,
		map,
	});
}

// POST/DELETE /api/levels/:id/like — toggle the caller's like. Login required.
// Keeps likes.* and levels.like_count in sync; idempotent per user.
async function toggleLike(request: Request, env: Env, id: string, add: boolean): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required to like" }, 401);

	// Guard against liking a level that doesn't exist / was removed.
	const lvl = await env.DB.prepare(
		`SELECT 1 FROM levels WHERE id = ? AND status = 'active'`,
	)
		.bind(id)
		.first();
	if (!lvl) return json({ error: "not found" }, 404);

	const now = Date.now();
	if (add) {
		// INSERT OR IGNORE: a second like by the same user is a no-op, so we only
		// bump like_count when a row was actually inserted (changes > 0).
		const res = await env.DB.prepare(
			`INSERT OR IGNORE INTO likes (user_id, level_id, created_at) VALUES (?, ?, ?)`,
		)
			.bind(user.id, id, now)
			.run();
		if (res.meta.changes > 0) {
			await env.DB.prepare(`UPDATE levels SET like_count = like_count + 1 WHERE id = ?`)
				.bind(id)
				.run();
		}
	} else {
		const res = await env.DB.prepare(
			`DELETE FROM likes WHERE user_id = ? AND level_id = ?`,
		)
			.bind(user.id, id)
			.run();
		if (res.meta.changes > 0) {
			await env.DB.prepare(
				`UPDATE levels SET like_count = MAX(0, like_count - 1) WHERE id = ?`,
			)
				.bind(id)
				.run();
		}
	}

	const row = await env.DB.prepare(`SELECT like_count FROM levels WHERE id = ?`)
		.bind(id)
		.first<{ like_count: number }>();
	return json({ liked: add, like_count: row?.like_count ?? 0 });
}

// POST/DELETE /api/levels/:id/collect — toggle whether the level is in the
// caller's personal collection. Login required; idempotent per user. There's no
// denormalized count to keep in sync (a collection is a private bookmark).
async function toggleCollect(request: Request, env: Env, id: string, add: boolean): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required to collect" }, 401);

	const lvl = await env.DB.prepare(
		`SELECT 1 FROM levels WHERE id = ? AND status = 'active'`,
	)
		.bind(id)
		.first();
	if (!lvl) return json({ error: "not found" }, 404);

	if (add) {
		await env.DB.prepare(
			`INSERT OR IGNORE INTO collections (user_id, level_id, created_at) VALUES (?, ?, ?)`,
		)
			.bind(user.id, id, Date.now())
			.run();
	} else {
		await env.DB.prepare(`DELETE FROM collections WHERE user_id = ? AND level_id = ?`)
			.bind(user.id, id)
			.run();
	}
	return json({ collected: add });
}

// POST /api/levels — publish a new level. Login required; the author is taken
// from the session, never the request body.
async function publishLevel(request: Request, env: Env): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required to publish" }, 401);

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
	const { name, theme, difficulty, map_json, source_text } = result.value;
	const authorName = user.name ?? "Jogador";

	await env.DB.prepare(
		`INSERT INTO levels
		 (id, name, theme, difficulty, author_id, author_name, map_json, source_text, schema_version,
		  play_count, like_count, is_public, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, 'active', ?, ?)`,
	)
		.bind(id, name, theme, difficulty, user.id, authorName, map_json, source_text, SCHEMA_VERSION, now, now)
		.run();

	return json({ id, name, theme, difficulty, created_at: now }, 201);
}

// PUT /api/levels/:id — the author edits one of their own levels in place. Same
// validation as publishing; the id, author and counters are preserved. Only the
// owner may edit (admins moderate via status, they don't rewrite content).
async function updateLevel(request: Request, env: Env, id: string): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required to edit" }, 401);

	const row = await env.DB.prepare(`SELECT author_id, status FROM levels WHERE id = ?`)
		.bind(id)
		.first<{ author_id: string | null; status: string }>();
	if (!row || row.status === "removed") return json({ error: "not found" }, 404);
	if (row.author_id == null || row.author_id !== user.id) {
		return json({ error: "forbidden" }, 403);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: "invalid JSON body" }, 400);
	}

	const result = validatePublish(body);
	if (!result.ok) return json({ error: result.error }, 400);

	const now = Date.now();
	const { name, theme, difficulty, map_json, source_text } = result.value;

	await env.DB.prepare(
		`UPDATE levels
		 SET name = ?, theme = ?, difficulty = ?, map_json = ?, source_text = ?, updated_at = ?
		 WHERE id = ?`,
	)
		.bind(name, theme, difficulty, map_json, source_text, now, id)
		.run();

	return json({ id, name, theme, difficulty, updated_at: now });
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

// --- My levels & moderation ------------------------------------------------

const LEVEL_COLS =
	"id, name, theme, difficulty, author_id, author_name, play_count, like_count, status, created_at";

// GET /api/me/levels — the caller's own levels (any status but 'removed'), so the
// author sees drafts they may have hidden but not ones they deleted.
async function listMyLevels(request: Request, env: Env): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required" }, 401);

	const { results } = await env.DB.prepare(
		`SELECT ${LEVEL_COLS} FROM levels
		 WHERE author_id = ? AND status != 'removed'
		 ORDER BY created_at DESC`,
	)
		.bind(user.id)
		.all();
	return json({ levels: results ?? [] });
}

// GET /api/me/collection — full listing of the levels the caller has saved to
// their personal collection, newest-saved first. Only public+active levels show.
async function listMyCollection(request: Request, env: Env): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ error: "login required" }, 401);

	const { results } = await env.DB.prepare(
		`SELECT l.id, l.name, l.theme, l.difficulty, l.author_id, l.author_name,
		        l.play_count, l.like_count, l.status, l.created_at
		 FROM levels l
		 JOIN collections c ON c.level_id = l.id
		 WHERE c.user_id = ? AND l.is_public = 1 AND l.status = 'active'
		 ORDER BY c.created_at DESC`,
	)
		.bind(user.id)
		.all();
	return json({ levels: results ?? [] });
}

// GET /api/me/interactions — the id sets the caller has liked / collected, so a
// listing page can render each card's toggle state in one extra round-trip.
// Returns empty arrays (not 401) when logged out, so callers needn't branch.
async function listMyInteractions(request: Request, env: Env): Promise<Response> {
	const user = await requireUser(request, env);
	if (!user) return json({ liked: [], collected: [] });

	const [likes, collected] = await Promise.all([
		env.DB.prepare(`SELECT level_id FROM likes WHERE user_id = ?`).bind(user.id).all(),
		env.DB.prepare(`SELECT level_id FROM collections WHERE user_id = ?`).bind(user.id).all(),
	]);
	return json({
		liked: (likes.results ?? []).map((r) => (r as { level_id: string }).level_id),
		collected: (collected.results ?? []).map((r) => (r as { level_id: string }).level_id),
	});
}

// GET /api/admin/levels?status=all|active|hidden|removed — moderation listing.
async function adminListLevels(request: Request, env: Env, url: URL): Promise<Response> {
	const admin = await requireAdmin(request, env);
	if (!admin) return json({ error: "forbidden" }, 403);

	const status = url.searchParams.get("status") ?? "all";
	const limit = clampInt(url.searchParams.get("limit"), MAX_LIMIT, 1, MAX_LIMIT);
	const offset = clampInt(url.searchParams.get("offset"), 0, 0, 1_000_000);

	const validStatus = ["active", "hidden", "removed"];
	const where = validStatus.includes(status) ? "WHERE status = ?" : "";
	const binds: (string | number)[] = validStatus.includes(status) ? [status] : [];

	const { results } = await env.DB.prepare(
		`SELECT ${LEVEL_COLS} FROM levels
		 ${where}
		 ORDER BY created_at DESC
		 LIMIT ? OFFSET ?`,
	)
		.bind(...binds, limit, offset)
		.all();
	return json({ levels: results ?? [], status, limit, offset });
}

// POST /api/levels/:id/moderate { status } — admin sets a level's status.
async function moderateLevel(request: Request, env: Env, id: string): Promise<Response> {
	const admin = await requireAdmin(request, env);
	if (!admin) return json({ error: "forbidden" }, 403);

	let body: { status?: unknown };
	try {
		body = (await request.json()) as { status?: unknown };
	} catch {
		return json({ error: "invalid JSON body" }, 400);
	}
	const status = typeof body.status === "string" ? body.status : "";
	if (!["active", "hidden", "removed"].includes(status)) {
		return json({ error: "status must be active|hidden|removed" }, 400);
	}

	const row = await env.DB.prepare(
		`UPDATE levels SET status = ?, updated_at = ? WHERE id = ? RETURNING id`,
	)
		.bind(status, Date.now(), id)
		.first<{ id: string }>();
	if (!row) return json({ error: "not found" }, 404);
	return json({ id, status });
}

// DELETE /api/levels/:id — soft-remove. The author can delete their own level;
// admins can delete any. Soft (status='removed') keeps the row for audit and
// breaks shared links gracefully (404) rather than hard-deleting.
async function deleteLevel(request: Request, env: Env, id: string): Promise<Response> {
	const user = await currentUser(request, env);
	if (!user) return json({ error: "login required" }, 401);

	const row = await env.DB.prepare(`SELECT author_id FROM levels WHERE id = ?`)
		.bind(id)
		.first<{ author_id: string | null }>();
	if (!row) return json({ error: "not found" }, 404);

	const owns = row.author_id != null && row.author_id === user.id;
	if (!owns && !isAdmin(user, env)) return json({ error: "forbidden" }, 403);

	await env.DB.prepare(`UPDATE levels SET status = 'removed', updated_at = ? WHERE id = ?`)
		.bind(Date.now(), id)
		.run();
	return json({ ok: true });
}

// --- helpers ---------------------------------------------------------------

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
	const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
	if (extraHeaders) Object.assign(headers, extraHeaders);
	return new Response(JSON.stringify(data), { status, headers });
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
	const n = raw === null ? NaN : Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

// Escapes LIKE wildcards so an author filter of "50%" matches the literal text
// rather than "anything". Paired with `ESCAPE '\'` in the query.
function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

// CORS: the editor and game run in the browser and may be on a different origin
// during local dev. Reflect the request origin so credentials-free fetches work.
function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("Origin");
	const headers: Record<string, string> = {
		"access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"access-control-allow-headers": "content-type",
		"access-control-max-age": "86400",
		vary: "Origin",
	};
	// Session cookie requires a specific origin (never "*") plus allow-credentials.
	// Same-origin requests send no Origin header and ignore these anyway.
	if (origin) {
		headers["access-control-allow-origin"] = origin;
		headers["access-control-allow-credentials"] = "true";
	} else {
		headers["access-control-allow-origin"] = "*";
	}
	return headers;
}

function corsPreflight(request: Request): Response {
	return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function withCors(request: Request, res: Response): Response {
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
