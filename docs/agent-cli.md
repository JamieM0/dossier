# Dossier CLI reference

The Dossier CLI manages encrypted profiles through a local Unix socket service. CLI profiles stay in a separate directory from the GUI library. The GUI does not list or open CLI profiles.

## Build and run the CLI

Build the shared packages and CLI from the repository root:

```sh
pnpm install
pnpm --filter @dossier/domain build
pnpm --filter @dossier/store build
pnpm --filter @dossier/cli build
pnpm cli profile create research
```

The last command starts the local service and prints the new profile as JSON. Run `pnpm cli help --json` for the current action list and argument names.

The macOS release includes a CLI zip. Extract it, then run `./bin/dossier.js help` from the extracted directory. The CLI zip requires Node.js 20 or later.

The CLI stores data under `~/Library/Application Support/Dossier/cli` by default. Set `DOSSIER_CLI_HOME` to use another dedicated directory. The CLI refuses a directory that overlaps the GUI data directory.

## Manage a profile

Use these commands to select and inspect a CLI profile:

```sh
pnpm cli profile list
pnpm cli profile use research
pnpm cli profile show
pnpm cli profile rename research experiments
pnpm cli profile archive experiments
pnpm cli profile unarchive experiments
```

Each write checks the profile revision. If another client writes first, the service returns `STALE_REVISION`. Refresh the profile and retry. The CLI reads the current revision before each write.

Use `--dry-run` to preview deletion or reset. Use `--yes` to run either action:

```sh
pnpm cli profile delete experiments --dry-run
pnpm cli profile delete experiments --yes
```

## Rate and discover titles

Store a TMDB read token through a hidden prompt. The CLI also accepts an API key as a fallback. You can pipe either credential through standard input.

```sh
pnpm cli tmdb set
pnpm cli tmdb set-key
pnpm cli tmdb validate
pnpm cli tmdb validate-key
pnpm cli rate queue --mode active --limit 5
pnpm cli rate set movie:27205 --value 3
pnpm cli taste claims --limit 10
pnpm cli suggest --medium movie --limit 8
pnpm cli suggest explain movie:157336
```

The rating values are `-3`, `-2`, `-1`, `-0.5`, `0`, `0.5`, `1`, `2`, and `3`. Use `0.5` for a watchlist item and `-0.5` for an excluded item. The queue modes are `standard`, `active`, `focused`, and `challenge`.

Use `--filters` for a JSON object with `genres`, `yearFrom`, `yearTo`, or `minVoteAverage`. Use `--dials` for shared recommender parameters. For example:

```sh
pnpm cli suggest --filters '{"yearFrom":2000,"genres":["Science Fiction"]}' --limit 5
```

## Inspect personal learning

Ordinary recommendations learn distinctions from ratings, descriptive metadata, and saved Refine comparisons.
They retain the existing public-rating weight.
Recent feedback adjusts recommendations only when it predicts subsequent observed ratings better than older evidence.
The learner uses no mood questionnaire.

```sh
pnpm cli taste distinctions --limit 10
pnpm cli suggest explain movie:157336
pnpm cli suggest --learned-taste clusters --limit 8
```

`taste distinctions` returns signed conditional associations and support counts.
Support counts do not measure accuracy or establish causes.
`suggest explain` includes personal influence and the current recent-feedback adjustment.
Use `--learned-taste clusters` to inspect the historical cluster baseline.
Experimental modes include `axes`, `descriptive`, `comparisons`, `balanced_descriptive`, `balanced_comparisons`, and `adaptive_comparisons`.
Read the [personal learning review](../reports/personal-learning-review-v1.md) for results and limitations.

## Inspect and change the library

Use item IDs from a queue, search result, or library list:

```sh
pnpm cli library list --filter watchlist --limit 20
pnpm cli library inspect movie:27205
pnpm cli rate clear movie:27205
pnpm cli rate skip movie:27205
pnpm cli refine queue --size 2
pnpm cli refine choose movie:27205 movie:157336
pnpm cli taste claim confirm CLAIM_ID
```

`CLAIM_ID` is an ID from `taste claims`. Use `taste claim reject` or `taste claim correct` to change claim feedback. Use `taste areas` and `taste coverage` to inspect the taste model.

## Export, import, and back up data

The CLI reads export and import passphrases from a hidden prompt or standard input. Do not pass secrets as command arguments.

```sh
pnpm cli library export ./research.dossier
pnpm cli library import ./research.dossier --dry-run
pnpm cli library import ./research.dossier --yes
pnpm cli backup create
pnpm cli backup list
pnpm cli backup restore BACKUP_FILE --dry-run
pnpm cli backup restore BACKUP_FILE --yes
```

`BACKUP_FILE` is the file name returned by `backup create`. The service stores encrypted backups in the CLI data directory. An import or restore creates a recovery copy of the prior encrypted vault.

## Control output size

The CLI writes compact JSON to standard output and diagnostics to standard error. Use `--readable` for a table when a result contains items. Use `--ndjson` for one JSON item per line. Use `--fields id,title` to select item fields. Use `--limit` and `--cursor` to page through lists.

The local service uses a private socket and client token. It does not listen on a network interface. Remote CLI enrollment remains deferred under the [CLI decision record](agent-cli-decision.html).
