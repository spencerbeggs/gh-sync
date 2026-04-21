/* v8 ignore start -- TaggedError class declarations, covered via errors.test.ts */
import { Data } from "effect";

export class ResolveError extends Data.TaggedError("ResolveError")<{
	readonly message: string;
}> {}

export class OnePasswordError extends Data.TaggedError("OnePasswordError")<{
	readonly message: string;
}> {}

export class GitHubApiError extends Data.TaggedError("GitHubApiError")<{
	readonly message: string;
	readonly status?: number;
}> {}

export class SyncError extends Data.TaggedError("SyncError")<{
	readonly message: string;
}> {}
/* v8 ignore stop */
