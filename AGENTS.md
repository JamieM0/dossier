# Dossier agent notes

## GitHub CLI authentication

`gh` stores this repository's GitHub credential in macOS Keychain. Restricted
agent shells cannot read that keychain item or reach GitHub, and `gh auth status`
misleadingly reports the resulting failure as "The token in default is invalid."

Before asking the user to authenticate again, rerun the GitHub command with
host/keychain/network access. If the unrestricted `gh auth status` succeeds,
authentication is healthy and all subsequent `gh` or release commands should
use that access. Never copy the token into an environment variable and never
switch to `--insecure-storage` as a workaround.

See `CLAUDE.md` for the full build and release process.
