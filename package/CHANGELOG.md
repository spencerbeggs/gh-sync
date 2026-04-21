# repo-sync

## 0.1.0

### Minor Changes

* c2214c2: ## Features

  ### Sync command logging with SyncLogger service

  A new `SyncLogger` service instruments the entire sync pipeline with structured, tiered output.

  * Added a `--log-level` flag to the root `repo-sync` command. Accepted values: `silent`, `info`, `verbose`, `debug`.
  * Added a `log_level` field to `repo-sync.config.toml` that sets the default verbosity. The `--log-level` flag overrides it at runtime.
  * `info` (default) prints per-group and per-repo summaries with counts of synced resources.
  * `verbose` adds per-operation lines showing exactly which secret, variable, or ruleset was created or updated.
  * `debug` extends `verbose` output with the source of each resolved value (file path, credential label, or 1Password reference).
  * In dry-run mode, all verbs are prefixed with `would` so it is immediately clear no changes were made.
  * Errors caught during a sync run are accumulated rather than aborting the run. A final summary is printed after all repos are processed, listing every failure by repo and context.

  ```text
  group: personal (3 repos)
    repo: spencerbeggs/repo-one
      synced  3 secrets (actions)
      synced  2 variables (actions)
      applied settings
    repo: spencerbeggs/repo-two
      error   secrets: Failed to read file for 'DEPLOY_KEY': no such file
  Sync complete with 1 error:
    spencerbeggs/repo-two: secrets — Failed to read file for 'DEPLOY_KEY': no such file
  ```

  ### Inline ruleset schema — 22 GitHub rule types in TOML

  Rulesets are now defined entirely inline in `repo-sync.config.toml` using an Effect Schema that covers all 22 GitHub repository rule types. JSON file references are no longer required.

  * Supported rule types: `creation`, `update`, `deletion`, `required_linear_history`, `required_signatures`, `non_fast_forward`, `pull_request`, `required_status_checks`, `required_deployments`, `merge_queue`, `commit_message_pattern`, `commit_author_email_pattern`, `committer_email_pattern`, `branch_name_pattern`, `tag_name_pattern`, `file_path_restriction`, `file_extension_restriction`, `max_file_path_length`, `max_file_size`, `workflows`, `code_scanning`, and `copilot_code_review`.
  * Bypass actor `actor_id`, status check `integration_id`, and workflow `repository_id` fields accept either a literal integer or a `{ resolved = "LABEL" }` reference that is substituted from the active credential profile at runtime.
  * The top-level config key for repository groups is now `groups` (previously `repos`). Within each group the list of repository names uses the key `repos` (previously `names`).

  ```toml
  [rulesets.branch-protection]
  name = "branch-protection"
  enforcement = "active"
  target = "branch"

  [rulesets.branch-protection.conditions.ref_name]
  include = ["~DEFAULT_BRANCH"]

  [[rulesets.branch-protection.rules]]
  type = "pull_request"

  [rulesets.branch-protection.rules.parameters]
  dismiss_stale_reviews_on_push = true
  require_code_owner_review = false
  require_last_push_approval = true
  required_approving_review_count = 1
  required_review_thread_resolution = true
  ```

  ### Resolved template system for distributable configs

  Config files can now be committed to version control as distributable templates by moving all environment-specific values into the credentials file.

  * Credential profiles in `repo-sync.credentials.toml` gain a `[profiles.<name>.resolve]` section with three sub-groups: `op` (1Password references), `file` (file paths), and `value` (inline strings or JSON objects). Each entry is a named label.
  * Secret and variable groups in `repo-sync.config.toml` are now typed by kind: `file`, `value`, or `resolved`. A `resolved` group maps secret or variable names to credential labels, indirecting the actual values through the active profile.
  * The `ValueResolver` service has been replaced by `CredentialResolver`. It resolves all labels in the active credential profile's `[resolve]` section up front, producing a map used throughout the sync run.
  * Ruleset fields that hold GitHub integer IDs (bypass actor IDs, integration IDs, workflow repository IDs) accept `{ resolved = "LABEL" }` to pull the integer at runtime from the credential map.

  ```toml
  # repo-sync.credentials.toml
  [profiles.personal]
  github_token = "ghp_xxxx"

  [profiles.personal.resolve.op]
  DEPLOY_TOKEN = "op://Private/deploy-token/credential"

  [profiles.personal.resolve.value]
  REGISTRY_URL = "https://registry.npmjs.org"
  ```

  ```toml
  # repo-sync.config.toml — no secrets committed here
  [secrets.deploy]
  resolved = { DEPLOY_TOKEN = "DEPLOY_TOKEN", REGISTRY_URL = "REGISTRY_URL" }
  ```

* e8c8607: ## Features

  ### Settings parity

  `SettingsGroupSchema` now covers 20+ typed, annotated fields replacing the previous untyped passthrough:

  * Repository visibility and feature toggles: `is_template`, `has_wiki`, `has_issues`, `has_projects`, `has_discussions`, `allow_forking`
  * `has_sponsorships` and `has_pull_requests` are synced via GraphQL mutation (these fields are not available on the REST API)
  * Full merge strategy configuration: `allow_merge_commit`, `allow_squash_merge`, `allow_rebase_merge`, `allow_auto_merge`, `allow_update_branch`, `delete_branch_on_merge`
  * Merge commit title/message enums: `merge_commit_title`, `merge_commit_message`, `squash_merge_commit_title`, `squash_merge_commit_message`
  * `web_commit_signoff_required`
  * Merge commit title/message fields are automatically stripped from the API payload when their corresponding strategy is disabled

  Unknown fields are still passed through to the API, so any settings not yet typed continue to work without changes.

  ### Ruleset ergonomic shorthands

  Several shorthand fields are now available on both `BranchRulesetSchema` and `TagRulesetSchema` to reduce boilerplate for common rule patterns. All shorthands are normalized to full API format by `normalizeRuleset()` before being sent to GitHub.

  **Boolean flags** — set any of these to `true` to enable the corresponding parameterless rule: `creation`, `deletion`, `non_fast_forward`, `required_linear_history`, `required_signatures`, `update`

  **`targets` shorthand** — replaces manual `conditions.ref_name` construction:

  ```toml
  # Target only the default branch
  targets = "default"

  # Target all branches
  targets = "all"

  # Custom include/exclude patterns
  targets = [{ include = "refs/heads/release/*" }, { exclude = "refs/heads/skip-*" }]
  ```

  **`deployments` shorthand** — a string array of environment names that converts to a `required_deployments` rule:

  ```toml
  deployments = ["staging", "production"]
  ```

  **`pull_requests` shorthand** (branch rulesets only) — flattened fields that map to a single `pull_request` rule: `approvals`, `dismiss_stale_reviews`, `code_owner_review`, `last_push_approval`, `resolve_threads`, `merge_methods`, `reviewers`

  **`status_checks` shorthand** — simplified required status check configuration with `required` (array of check contexts), `update_branch`, `on_creation`, and `default_integration_id` (applied to all checks that do not specify their own)

  ### Discriminated ruleset union

  `RulesetSchema` is now a discriminated union of `BranchRulesetSchema` and `TagRulesetSchema` keyed on the required `type` field. This replaces the previous single flat schema.

  * `type = "branch"` — enables `pull_requests` shorthand, `pull_request`, `merge_queue`, `code_scanning`, `copilot_code_review`, and `branch_name_pattern` rules
  * `type = "tag"` — enables `tag_name_pattern` rule; branch-only rules are not available

  The `type` field is required in all ruleset definitions. Configs using the previous schema that did not include `type` must add it.

  ### Deployment environments

  A new top-level `[environments]` section allows defining named deployment environment configurations that can be referenced from `[groups.*]`.

  ```toml
  [environments.production]
  wait_timer = 10
  prevent_self_review = true

  [[environments.production.reviewers]]
  type = "Team"
  id = 12345

  deployment_branches = "protected"
  ```

  `EnvironmentSchema` supports `wait_timer` (0–43200 minutes), `prevent_self_review`, `reviewers` (users or teams), and `deployment_branches` (`"all"`, `"protected"`, or an array of custom branch/tag name policies).

  Nine new `GitHubClient` methods handle environment CRUD, environment secrets, and environment variables. The `SyncEngine` syncs environments before secrets and variables so that environment scopes are available when secrets and variables are written.

  Groups reference environments by name:

  ```toml
  [groups.my-repos]
  repos = ["repo-one", "repo-two"]
  environments = ["staging", "production"]
  ```

  ### Cleanup redesign

  Cleanup configuration has moved from a single global block to a per-group `[groups.<name>.cleanup]` section. This allows different cleanup policies for different groups.

  The `CleanupScope` type is a three-way union:

  * `false` — cleanup disabled for this scope (default)
  * `true` — delete all resources not declared in config
  * `{ preserve = ["NAME_ONE", "NAME_TWO"] }` — delete undeclared resources except those listed

  Scopes are now nested by resource type:

  ```toml
  [groups.my-repos.cleanup]
  rulesets = true
  environments = false

  [groups.my-repos.cleanup.secrets]
  actions = true
  dependabot = false
  codespaces = false
  environments = { preserve = ["LEGACY_SECRET"] }

  [groups.my-repos.cleanup.variables]
  actions = true
  environments = false
  ```

  ### Expanded secret and variable scoping

  `SecretScopesSchema` and `VariableScopesSchema` now support an `environments` map that assigns secret or variable groups to specific named deployment environments:

  ```toml
  [groups.my-repos.secrets]
  actions = ["deploy", "app"]

  [groups.my-repos.secrets.environments]
  staging = ["staging-secrets"]
  production = ["prod-secrets"]

  [groups.my-repos.variables.environments]
  staging = ["staging-vars"]
  production = ["prod-vars"]
  ```

* fbdd993: ## Features

  * Rewrote CLI from Commander.js to `@effect/cli`, adding six commands: `sync`, `list`, `validate`, `doctor`, `init`, and `credentials` (with `create`, `list`, and `delete` subcommands).
  * Replaced the JSON config format with TOML. Config now lives in `repo-sync.config.toml` and credentials in `repo-sync.credentials.toml`.
  * Introduced composable named resource groups — settings, secrets, variables, and rulesets are defined as named groups and assigned to named repo groups, allowing the same group to be reused across multiple sets of repositories.
  * Added per-scope secret assignment: secrets groups can be assigned independently to `actions`, `dependabot`, and `codespaces` scopes within each repo group.
  * Integrated the 1Password SDK for resolving `op://` secret references at runtime, enabling secrets to be pulled directly from a 1Password vault without storing plaintext values locally.
  * Added XDG config path resolution (`$XDG_CONFIG_HOME/repo-sync/`) with a directory-walk fallback that searches parent directories from cwd, mirroring the lookup strategy used by tools like `git` and `eslint`.
  * Added JSON Schema generation for both config files, annotated with `x-tombi-*` hints for TOML LSP completion and key ordering in editors that support the Tombi language server.
  * Added credential profiles in `repo-sync.credentials.toml` for multi-account support. Each profile holds a GitHub fine-grained token and an optional 1Password service account token. A repo group can reference a named profile; if only one profile exists it is selected automatically.
  * Added a `cleanup` configuration block (global and per repo group) that controls deletion of secrets, variables, Dependabot secrets, Codespaces secrets, and rulesets not declared in config, with per-resource `preserve` lists to protect named resources from deletion.

  ### Value sources

  Every secret, variable, and ruleset entry accepts one of four value source shapes:

  ```toml
  # Inline string
  MY_SECRET = { value = "literal" }

  # File path (resolved relative to config dir)
  MY_SECRET = { file = "./private/my-secret.txt" }

  # Inline JSON object (serialized before upload)
  MY_SECRET = { json = { registry = "https://registry.npmjs.org" } }

  # 1Password reference (resolved via SDK at runtime)
  MY_SECRET = { op = "op://Private/npm-token/credential" }
  ```

  ### Minimal config example

  ```toml
  owner = "spencerbeggs"

  [repos.personal]
  names = ["repo-one", "repo-two"]
  secrets.actions = ["deploy"]
  rulesets = ["standard"]

  [secrets.deploy]
  DEPLOY_TOKEN = { op = "op://Private/deploy-token/credential" }

  [rulesets.standard]
  branch-protection = { file = "./rulesets/branch-protection.json" }
  ```

### Patch Changes

* e2f61c0: ## Documentation

  * Added comprehensive user-facing documentation across 12 new Markdown files: `README.md`, `package/README.md`, `CONTRIBUTING.md`, and nine pages under `docs/` covering commands, configuration, credentials, secrets and variables, rulesets, environments, cleanup, and token permissions.

  ## Maintenance

  * Renamed the project from `gh-sync` to `repo-sync` throughout the codebase: npm package name, CLI binary (`repo-sync`), config filenames (`repo-sync.config.toml`, `repo-sync.credentials.toml`), XDG config directory, GitHub Packages scope, all source files, tests, generated JSON schemas, and design docs.
  * Removed stale plan and spec files from `.claude/plans/` and `.claude/specs/` that covered the earlier redesign phase.
