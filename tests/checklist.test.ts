import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http } from "../src/server/index.ts";
const placeId = "11111111-1111-4111-8111-111111111111";
const otherPlace = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
test("checklists persist and are isolated by actor and place", async () => {
	const dataDir = mkdtempSync(join(tmpdir(), "want-to-try-"));
	const hostFetch = async () => Response.json({ deletedAt: null });
	async function call(actor: string, body: object, access = hostFetch) {
		const response = await http(
			new Request("http://localhost/items", {
				method: "POST",
				body: JSON.stringify(body),
			}),
			{ ownerId: actor, dataDir, pathSuffix: "/items", hostFetch: access },
		);
		return { status: response.status, body: await response.json() };
	}
	try {
		const add = { action: "add", placeId, id, name: "  Soup  " };
		assert.deepEqual((await call("alice", add)).body, [
			{ id, name: "Soup", done: false },
		]);
		assert.equal((await call("alice", add)).body.length, 1);
		assert.deepEqual((await call("bob", { action: "list", placeId })).body, []);
		assert.deepEqual(
			(await call("alice", { action: "list", placeId: otherPlace })).body,
			[],
		);
		await call("bob", { action: "toggle", placeId, id, done: true });
		assert.equal(
			(await call("alice", { action: "list", placeId })).body[0].done,
			false,
		);
		assert.equal(
			(await call("alice", { action: "toggle", placeId, id, done: true }))
				.body[0].done,
			true,
		);
		assert.deepEqual(
			(await call("alice", { action: "delete", placeId, id })).body,
			[],
		);
		assert.equal(
			(
				await call(
					"alice",
					add,
					async () => new Response(null, { status: 404 }),
				)
			).status,
			404,
		);
		assert.equal((await call("alice", { ...add, name: " " })).status, 400);
	} finally {
		rmSync(dataDir, { recursive: true, force: true });
	}
});
