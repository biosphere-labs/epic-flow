# Epic Flow

**Keep the insight. Delegate the craft. Understand both.**

From an idea to verified, tested code. You answer the questions once, and Epic Flow does the rest.

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-D97757)](https://code.claude.com/docs/en/plugins)
[![Version](https://img.shields.io/github/v/release/biosphere-labs/epic-flow?include_prereleases&label=version)](https://github.com/biosphere-labs/epic-flow/releases)
[![GitHub stars](https://img.shields.io/github/stars/biosphere-labs/epic-flow?style=flat)](https://github.com/biosphere-labs/epic-flow/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/biosphere-labs/epic-flow)](https://github.com/biosphere-labs/epic-flow/commits)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

```
/plugin marketplace add biosphere-labs/epic-flow
/plugin install epic-flow@epic-flow
```

## Why

Building with coding agents, I kept having to stay through every stage: the plan, the task breakdown, the review, the build, the final check. My presence was required, but beyond steering I wasn't adding much, and the steering turned out to be the easiest part to automate. So I automated it.

## How it works

```mermaid
flowchart LR
    S[Idea] --> B[Brainstorm]
    B --> P[Technical plan]
    P --> D[Decompose]
    D --> G[Gaps]
    G --> BU[Build]
    BU --> V[Verify]
    V -- a criterion failed --> BU
    classDef you fill:#FCE9E1,stroke:#D97757,color:#000
    class S,B you
```

You take part in the shaded stages. Everything after them runs unattended, and an independent checker tests each stage's output from the files before the next one starts.

- **One question session, then walk away.** Every open question across every feature is asked up front. Nothing needs your input halfway through.
- **Sequential or parallel, your call.** Before the build, you get both options, each with a time estimate, a risk level and the reasons behind that risk.
- **Nothing waits that doesn't have to.** Work starts the moment its inputs exist. Even a sequential build prepares the next task, tests the last one and writes the acceptance tests while the current task is being built.
- **Plans grounded in your code.** It reads your base branch and follows the libraries and patterns you already use.
- **Specified by example.** Every acceptance criterion carries concrete examples with real values, edge cases included, and those examples become the unit and acceptance tests.
- **Proof, not claims.** Every criterion is tested through its real entry point. The test must then fail with the implementation disabled, and fail again with the entry point cut.
- **Built for big work.** Several features or a whole app at once, ordered by what depends on what, and it can resume any time.
- **Safe with your repo.** Work happens on feature branches in worktrees. It never pushes or opens a PR unless you say so.

## Commands

| Command | What it does |
| --- | --- |
| `/epic-flow:idea` | Parks an idea in seconds |
| `/epic-flow:run` | Takes features through the stages, or runs one stage ("only gaps") |
| `/epic-flow:status` | Shows where every feature is and what to run next |

That's the whole interface: three commands.

**[How it works in detail →](docs/how-it-works.md)**

## Status

This is an early release (0.1.1). MIT licensed.
