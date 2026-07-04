// Server-side validation for user-submitted community levels.
// Mirrors the in-engine RuntimeLevelBuilder caps (src/src/runtime_level_builder.gd)
// so a payload the server accepts is one the game can safely build. A level is
// just data (no code), so the only risk is an oversized/malformed payload.

export const THEMES = ["forest", "glacial", "cidade", "caverna"] as const;
export const DEFAULT_THEME = "forest";

export const MAX_NAME_LEN = 80;
export const MAX_JSON_BYTES = 512 * 1024; // 512 KB raw map JSON
export const MAX_TERRAIN = 6000; // platforms + ramps
export const MAX_OBJECTS = 12000; // rings + springs + pads + enemies + spikes + goals
export const SCHEMA_VERSION = 1;

const TERRAIN_KEYS = ["platforms", "ramps_up", "ramps_down"] as const;
const OBJECT_KEYS = [
	"rings",
	"springs_vert",
	"springs_diag",
	"dash_pads",
	"enemies",
	"cactus_enemies",
	"spikes",
	"goals",
] as const;
const ARRAY_KEYS = [...TERRAIN_KEYS, ...OBJECT_KEYS];

export interface CleanLevel {
	name: string;
	theme: string;
	author_name: string | null;
	map: Record<string, unknown>;
	map_json: string;
}

export type ValidationResult =
	| { ok: true; value: CleanLevel }
	| { ok: false; error: string };

// Validates and normalizes a publish payload: { name, theme, map, author_name? }.
export function validatePublish(body: unknown): ValidationResult {
	if (typeof body !== "object" || body === null) {
		return { ok: false, error: "body must be a JSON object" };
	}
	const b = body as Record<string, unknown>;

	const name = typeof b.name === "string" ? b.name.trim() : "";
	if (name.length === 0) return { ok: false, error: "name is required" };
	if (name.length > MAX_NAME_LEN) {
		return { ok: false, error: `name too long (max ${MAX_NAME_LEN})` };
	}

	let theme = typeof b.theme === "string" ? b.theme.trim().toLowerCase() : DEFAULT_THEME;
	if (!(THEMES as readonly string[]).includes(theme)) theme = DEFAULT_THEME;

	let author_name: string | null = null;
	if (typeof b.author_name === "string" && b.author_name.trim().length > 0) {
		author_name = b.author_name.trim().slice(0, MAX_NAME_LEN);
	}

	if (typeof b.map !== "object" || b.map === null || Array.isArray(b.map)) {
		return { ok: false, error: "map must be a JSON object" };
	}
	const map = b.map as Record<string, unknown>;

	const mapResult = validateMap(map);
	if (!mapResult.ok) return mapResult;

	// The map's own theme/name are informational; the row's columns are the
	// source of truth. Keep them in sync so the built level matches the listing.
	map.theme = theme;
	map.name = name;

	const map_json = JSON.stringify(map);
	if (byteLength(map_json) > MAX_JSON_BYTES) {
		return { ok: false, error: `map too large (max ${MAX_JSON_BYTES} bytes)` };
	}

	return { ok: true, value: { name, theme, author_name, map, map_json } };
}

// Validates the structured map: every known collection must be an array, and
// the total terrain/object counts must stay within the builder's caps.
export function validateMap(map: Record<string, unknown>): ValidationResult {
	let terrain = 0;
	let objects = 0;

	for (const key of ARRAY_KEYS) {
		const v = map[key];
		if (v === undefined) continue;
		if (!Array.isArray(v)) return { ok: false, error: `${key} must be an array` };
		if ((TERRAIN_KEYS as readonly string[]).includes(key)) terrain += v.length;
		else objects += v.length;
	}

	if (terrain > MAX_TERRAIN) {
		return { ok: false, error: `too much terrain (${terrain}; limit ${MAX_TERRAIN})` };
	}
	if (objects > MAX_OBJECTS) {
		return { ok: false, error: `too many objects (${objects}; limit ${MAX_OBJECTS})` };
	}

	// Cheap dummy result — callers that only need the counts ignore `value`.
	return { ok: true, value: { name: "", theme: DEFAULT_THEME, author_name: null, map, map_json: "" } };
}

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}
