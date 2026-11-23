# Reliability validation, 23 November 2026

The automated tests exercise the scheduler with controlled agent responses. They do not prove that a real host wrote a file or resumed after a process exit. The live checks below are reported separately.

## Automated checks

`node --test tests/*.test.mjs` passes. The scheduler harness contains 51 cases, including distinct contract recovery requests, repeated requests, the configurable recovery limit, checker exceptions, and draining outstanding workers before return. All seven real-Git delivery integration cases also pass, including rejection of hidden tracked edits under assume-unchanged and skip-worktree flags in the main repository and initialized submodules at two depths. It checks the exact clean commit and configured push destination with disposable repositories.

The scheduler now allows distinct contract-recovery waves up to a default limit of four per build invocation (`contractRounds` can override it). Repeated identical requests stop early. Rejected host-agent promises follow the missing-agent failure path, allowing outstanding work to drain. An interrupted stage retains its stage identity and requests a persisted stop record.

## PR review scope

The cross-model panel was dispatched against the PR revision before these follow-up changes. Codex used `gpt-6-astra` at high reasoning. Claude and Antigravity could not participate because their accounts reported quota exhaustion. The panel reviewed `1963757a4b4ac1cf167b3b6a732366d27629a99a` and returned **request changes**. Two model families (OpenAI and xAI) counted, satisfying its quorum, with a Codex verifier confirming the blocking findings. These results apply to that pinned revision; they are not approval of later changes.

An independent GPT-6 high-reasoning verifier exercised the follow-up scheduler changes, including varying contract diagnostics and an exception while another group was still running. Its probes stopped at the recovery limit and observed no active work or late merges after return. This is controlled scheduler evidence, not a complete live project build.

## Claude host test: blocked

The live test attempted Claude Code with this candidate loaded through `--plugin-dir`, using `claude-opus-5-5`, high effort, and real writers/checkers. The first model request returned HTTP 429, `usage_limit_reached`, reporting a weekly usage limit and no remaining usage credits. No live rejection or restart behavior was observed in Claude Code.

After host access is restored, repeat the procedure below in a disposable Git project with no remote delivery:

1. Load this candidate plugin, start an unattended single-stage technical-plan run, and deliberately instruct only its writer and repair writer to omit the second example for every acceptance criterion. Use the unmodified independent checker instructions.
2. Let the actual scheduler and recorder stop the feature. Read `status.md`: it must identify `technical-plan`, `stopped`, and the rejection reason.
3. End the host process. Start a fresh process with the plugin and the same repository, remove the writer fault instruction, and request resume through technical-plan.
4. Check that the new process reads the persisted rejection, the real checker passes the repaired record, and the actual recorder writes `done`.
5. Repeat at verify with a seeded completed build, omitting probe evidence only from the candidate writers. On rejection the plan must remain in-progress. After a fresh-process resume, require the real checker and local finalizer to accept the clean feature commit before closure.

A successful Codex run of the corresponding scheduler is not evidence that Claude's Workflow host executes it correctly. Native Claude persistence/restart coverage remains outstanding. A complete live build and external PR delivery are also outside this validation.

## Additional panel findings addressed

- A checker must return both `pass: true` and an empty problems list to authorize stage completion.
- Pending contract changes stop new merge-retry writers. Other build failures no longer suppress the contract wave; those failures remain blocking after the wave.
- A finalizer's `failed` result is treated as a delivery error, without dispatching product build again. Missing and unsuccessful finalizers request a durable stop record.
- The delivery helper rejects assume-unchanged and skip-worktree index flags before any push. This deliberately also rejects sparse-checkout entries: clear those flags and repeat verification in a fully visible worktree before delivery.

The regression tests exercise each of these conditions. Real Git tests verify that a hidden dirty file cannot reach the configured remote. Controlled scheduler tests verify recorder dispatch; they do not substitute for the live-host evidence above.

## Persistence follow-up

The scheduler now requests and awaits a record of the first rejection before dispatching repair. If that recording fails, repair does not start. A repair-agent failure retains the original checker diagnosis. Every non-completed stage result, including scheduler-generated build validation errors, requests a stopped or waiting record before return. The controlled tests assert these dispatch and acknowledgment boundaries.

The hidden-index check also traverses initialized submodules recursively. Real Git tests cover both index flags in direct and nested submodules, with ordinary dirty edits rejected as a control and no remote ref created on rejection.

An independent targeted recheck confirmed the corrected rejection ordering, stopped records for scheduler-generated errors, and hidden-edit rejection in direct and nested submodules. It reran both suites and its own failure probes. The conclusion is limited to scheduler/helper behavior; native host coverage is described separately above.
