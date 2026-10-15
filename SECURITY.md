# Security

## If you leaked a key

1. Revoke it now: OpenRouter at https://openrouter.ai/settings/keys, Anthropic at https://console.anthropic.com/settings/keys.
2. Create a new key with a credit limit.
3. Removing the key from git history is not enough on its own; a pushed key must be treated as public.

If you find a key committed to this repository, do not use it. Report it privately (below) so the owner can revoke it.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**. Please do not open a public issue. You will get a reply within 7 days.

## What this project does to keep keys safe

- `.env` is in `.gitignore`; `.env.example` has empty values.
- CI runs gitleaks on every push and pull request.
- The site never ships a key. Live mode keeps the visitor's own keys in the tab's memory only (never `localStorage`) and sends them only to `openrouter.ai` and `api.anthropic.com`.
- The owner should enable secret scanning and push protection under Settings > Code security.
