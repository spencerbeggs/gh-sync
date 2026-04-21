import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Layer, Option } from "effect";
import type { ConfigFileService, ConfigSource } from "xdg-effect";
import {
	AppDirsConfig,
	FirstMatch,
	TomlCodec,
	UpwardWalk,
	XdgConfig,
	ConfigError as XdgConfigError,
	XdgConfigLive,
	makeConfigFileLive,
	makeConfigFileTag,
} from "xdg-effect";
import type { Config } from "../schemas/config.js";
import { ConfigSchema } from "../schemas/config.js";
import type { Credentials } from "../schemas/credentials.js";
import { CredentialsSchema } from "../schemas/credentials.js";

const CONFIG_FILENAME = "repo-sync.config.toml";
const CREDENTIALS_FILENAME = "repo-sync.credentials.toml";

export const RepoSyncConfigFile = makeConfigFileTag<Config>("repo-sync/Config");

export const RepoSyncCredentialsFile = makeConfigFileTag<Credentials>("repo-sync/Credentials");

const xdgLayer = XdgConfigLive({
	app: new AppDirsConfig({ namespace: "repo-sync", fallbackDir: Option.none(), dirs: Option.none() }),
	config: {
		tag: RepoSyncConfigFile,
		schema: ConfigSchema,
		codec: TomlCodec,
		strategy: FirstMatch,
		resolvers: [UpwardWalk({ filename: CONFIG_FILENAME }), XdgConfig({ filename: CONFIG_FILENAME })],
	},
});

const credentialsLayer = makeConfigFileLive({
	tag: RepoSyncCredentialsFile,
	schema: CredentialsSchema,
	codec: TomlCodec,
	strategy: FirstMatch,
	resolvers: [UpwardWalk({ filename: CREDENTIALS_FILENAME }), XdgConfig({ filename: CREDENTIALS_FILENAME })],
}).pipe(Layer.provide(xdgLayer));

export const ConfigFilesLive = Layer.mergeAll(xdgLayer, credentialsLayer);

/**
 * Resolves a --config flag to a file path. If the flag points to a directory,
 * appends the config filename. If omitted, returns undefined.
 */
export function resolveConfigFlag(configFlag: Option.Option<string>): string | undefined {
	if (Option.isNone(configFlag)) return undefined;
	const flag = configFlag.value;
	if (existsSync(flag) && statSync(flag).isDirectory()) {
		return join(flag, CONFIG_FILENAME);
	}
	return flag;
}

/**
 * Load config using the ConfigFileService. When a --config flag is provided,
 * uses loadFrom with the resolved path. Otherwise uses discover to get both
 * the config value and the file path (for configDir derivation).
 *
 * Returns config and configDir where configDir is the directory containing
 * the config file.
 */
export function loadConfigWithDir(
	configFile: ConfigFileService<Config>,
	configFlag: Option.Option<string>,
): Effect.Effect<{ config: Config; configDir: string }, XdgConfigError> {
	const resolved = resolveConfigFlag(configFlag);
	if (resolved) {
		return Effect.map(configFile.loadFrom(resolved), (config) => ({
			config,
			configDir: dirname(resolved),
		}));
	}
	return Effect.flatMap(configFile.discover, (sources: ReadonlyArray<ConfigSource<Config>>) => {
		if (sources.length === 0) {
			return Effect.fail(new XdgConfigError({ operation: "discover", reason: "No config file found" }));
		}
		return Effect.succeed({ config: sources[0].value, configDir: dirname(sources[0].path) });
	});
}
