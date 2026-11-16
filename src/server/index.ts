import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const uuid = z.string().uuid();
const input = z.discriminatedUnion("action", [
	z.object({ action: z.literal("list"), placeId: uuid }).strict(),
	z
		.object({
			action: z.literal("add"),
			placeId: uuid,
			id: uuid,
			name: z.string().trim().min(1).max(200),
		})
		.strict(),
	z
		.object({
			action: z.literal("toggle"),
			placeId: uuid,
			id: uuid,
			done: z.boolean(),
		})
		.strict(),
	z.object({ action: z.literal("delete"), placeId: uuid, id: uuid }).strict(),
]);
type Context = {
	ownerId: string;
	dataDir: string;
	pathSuffix: string;
	hostFetch?: (path: string) => Promise<Response>;
};
export async function http(request: Request, ctx: Context): Promise<Response> {
	if (ctx.pathSuffix.replace(/^\//, "") !== "items")
		return Response.json({ error: "Not found" }, { status: 404 });
	if (request.method !== "POST")
		return Response.json({ error: "Use POST" }, { status: 405 });
	let raw: unknown;
	try {
		const body = await request.text();
		if (body.length > 4096)
			return Response.json({ error: "Request too large" }, { status: 413 });
		raw = JSON.parse(body);
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const parsed = input.safeParse(raw);
	if (!parsed.success)
		return Response.json({ error: "Invalid request" }, { status: 400 });
	if (!ctx.ownerId || !ctx.hostFetch)
		return Response.json(
			{ error: "Place access unavailable" },
			{ status: 503 },
		);
	try {
		const access = await ctx.hostFetch(
			`/api/places/${encodeURIComponent(parsed.data.placeId)}`,
		);
		if (!access.ok)
			return Response.json(
				{ error: "Place unavailable" },
				{ status: access.status === 404 ? 404 : 403 },
			);
		const place: unknown = await access.json();
		if (
			typeof place !== "object" ||
			place === null ||
			("deletedAt" in place && place.deletedAt)
		)
			return Response.json({ error: "Place unavailable" }, { status: 404 });
		mkdirSync(ctx.dataDir, { recursive: true });
		const db = new DatabaseSync(join(ctx.dataDir, "want-to-try.sqlite"));
		try {
			db.exec(
				"PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS items (actor_id TEXT NOT NULL, place_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(actor_id, place_id, id))",
			);
			const value = parsed.data;
			if (value.action === "add")
				db.prepare(
					"INSERT OR IGNORE INTO items (actor_id, place_id, id, name) VALUES (?, ?, ?, ?)",
				).run(ctx.ownerId, value.placeId, value.id, value.name);
			if (value.action === "toggle")
				db.prepare(
					"UPDATE items SET done = ? WHERE actor_id = ? AND place_id = ? AND id = ?",
				).run(value.done ? 1 : 0, ctx.ownerId, value.placeId, value.id);
			if (value.action === "delete")
				db.prepare(
					"DELETE FROM items WHERE actor_id = ? AND place_id = ? AND id = ?",
				).run(ctx.ownerId, value.placeId, value.id);
			const rows = db
				.prepare(
					"SELECT id, name, done FROM items WHERE actor_id = ? AND place_id = ? ORDER BY rowid",
				)
				.all(ctx.ownerId, value.placeId);
			return Response.json(
				rows.map((row) => ({
					id: row.id,
					name: row.name,
					done: row.done === 1,
				})),
			);
		} finally {
			db.close();
		}
	} catch {
		return Response.json(
			{ error: "Could not access checklist" },
			{ status: 500 },
		);
	}
}
export const createModule = () => ({ createHttpApp: http });
