import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { JsonSchemaExporter, JsonSchemaValidator, tombi } from "xdg-effect";
import { ConfigSchema } from "../../src/schemas/config.js";
import { CredentialsSchema } from "../../src/schemas/credentials.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "../../schemas");

const entries = [
	{
		name: "Config",
		schema: ConfigSchema,
		rootDefName: "Config",
		$id: "https://raw.githubusercontent.com/spencerbeggs/reposets/main/package/schemas/reposets.config.schema.json",
		annotations: tombi({ tomlVersion: "v1.1.0" }),
	},
	{
		name: "Credentials",
		schema: CredentialsSchema,
		rootDefName: "Credentials",
		$id: "https://raw.githubusercontent.com/spencerbeggs/reposets/main/package/schemas/reposets.credentials.schema.json",
		annotations: tombi({ tomlVersion: "v1.1.0" }),
	},
] as const;

const program = Effect.gen(function* () {
	const exporter = yield* JsonSchemaExporter;
	const validator = yield* JsonSchemaValidator;

	const outputs = yield* exporter.generateMany(entries);
	const validated = yield* validator.validateMany(outputs, { strict: true });
	yield* exporter.writeMany(
		validated.map((output) => ({
			output,
			path: join(outputDir, `reposets.${output.name.toLowerCase()}.schema.json`),
		})),
	);
});

const MainLayer = Layer.mergeAll(JsonSchemaExporter.Live, JsonSchemaValidator.Live).pipe(
	Layer.provide(NodeFileSystem.layer),
);

Effect.runPromise(program.pipe(Effect.provide(MainLayer)));
