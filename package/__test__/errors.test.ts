import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubApiError, OnePasswordError, ResolveError, SyncError } from "../src/errors.js";

describe("Error types", () => {
	it("ResolveError has correct tag", () => {
		const error = new ResolveError({ message: "File not found: ./private/key" });
		expect(error._tag).toBe("ResolveError");
	});

	it("OnePasswordError has correct tag", () => {
		const error = new OnePasswordError({ message: "Failed to resolve op://vault/item" });
		expect(error._tag).toBe("OnePasswordError");
	});

	it("GitHubApiError has correct tag and status", () => {
		const error = new GitHubApiError({ message: "Unauthorized", status: 401 });
		expect(error._tag).toBe("GitHubApiError");
		expect(error.status).toBe(401);
	});

	it("SyncError has correct tag", () => {
		const error = new SyncError({ message: "Unknown group: missing-group" });
		expect(error._tag).toBe("SyncError");
	});

	it("errors work in Effect.fail", () => {
		const program = Effect.fail(new ResolveError({ message: "bad resolve" }));
		const result = Effect.runSyncExit(program);
		expect(result._tag).toBe("Failure");
	});
});
