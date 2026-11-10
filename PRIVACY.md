# Privacy policy

Epic Flow is a Claude Code plugin published by Biosphere Labs. Last updated 2026-11-10.

## What Biosphere Labs collects

Nothing. Epic Flow has no server, no telemetry, no analytics and no account. It sends nothing to Biosphere Labs.

## What it handles on your machine

Epic Flow runs inside Claude Code, in the repository you run it in, through Claude Code's own tools and permission prompts.

- It reads your repository's files and git history to plan and build.
- It writes its records under `.epic-flow/` and works in git worktrees under `.worktrees/`.
- It runs your project's own checks and tests, `git`, and its bundled `scripts/slice.mjs`, and reads the machine's core count and load.

All of this stays on your machine.

## What leaves your machine

- **Claude:** your prompts, files and command output go to Anthropic's models through Claude Code, as with any Claude Code session. Anthropic's own terms and privacy policy cover that.
- **Your git remote:** `git fetch` when the repository has a remote; `git push` and a pull request only when you say so in delivery.
- **The web:** a lookup when a brief names a reference product to follow.

Epic Flow sends nothing anywhere else, and keeps no data after a run beyond the files it writes in your repository, which you can delete at any time.

## Contact

Questions: open an issue at https://github.com/biosphere-labs/epic-flow/issues.
