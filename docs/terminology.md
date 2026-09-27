# Dossier terminology

Use these terms in CLI documentation and error messages.

| Concept | Term | Avoid |
| --- | --- | --- |
| A CLI-owned library and settings | CLI profile | account, workspace |
| The desktop app library | GUI library | CLI profile |
| The process that owns CLI data | local service | backend, daemon |
| The number used to reject stale writes | revision | version, generation |
| The shared CLI TMDB bearer credential | TMDB read token | access token |
| The shared CLI TMDB short credential | TMDB API key | token |
| A passphrase-encrypted data file | export | dump, snapshot |
