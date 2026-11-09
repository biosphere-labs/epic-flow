---
name: build
description: >
  Build an Epic Flow plan from its tasks once the gap review is clear, in
  the shape the user chose up front: sequential (one worktree, tasks in
  dependency order, one fresh agent per task) or parallel (groups from the
  dependence graph, one agent per group in its own worktree, then a merge
  train). Offers both with time estimates, risk and reasons when no shape
  was chosen. Sixth stage of Epic Flow. Use when the user wants to build,
  implement or start the epic, run the tasks, or runs /epic-flow:build.
  Does not replan.
---

# Epic Flow: Build

Read `conventions.md` in the plugin root, two levels up from this skill's base directory, before anything else.

Build the tasks against the contract commit, or, with `contract: none`, against the seams the tasks write out. The technical plan and the task files are the spec.

## Before you start

1. `gaps.md` has verdict `clear`. If not, stop and name `epic-flow:gaps`.
2. No question in `questions.md` is `open`.
3. Check every Delivery prerequisite in the brief with a command that shows it is there: reach the registry, reach the service, see that the variable is set without printing its value. A missing one becomes an `open` question naming what is missing. Set `status.md` to `waiting` and stop.
4. `<repo>/.worktrees/<slug>/` is on the Delivery branch, and `contract:` is `none` or names a commit the branch contains. If not, stop and name `epic-flow:decompose`.
5. If the user said how to shape the build (two tasks per agent, a number of agents, an order), follow it. If the dependence graph makes it wrong, say why before deviating: alone, ask; under the run, write the reason to `status.md` and the report.
6. Set the technical plan's status to `in-progress`.

## Choose the shape

Build the dependence graph and the groups as **Groups** below says. Both shapes need them: sequential takes its order from them.

- **Alone**: do the shape analysis in the conventions' **Build shape** with the real tasks, and offer both options with their time, risk and reasons, putting the Delivery **Build shape** first when there is one. Write the user's choice to Delivery.
- **Under the run**: follow Delivery **Build shape** without asking. When it is missing, run sequentially and write that reason.
- Either way, when `parallel` was chosen but there is one group, or a dependence between groups is unknown, run sequentially and write the reason to `status.md`.
- With `contract: none`, parallel needs a contract wave first. Alone, the Parallel option includes it: its time is added to the estimate, and choosing it runs decompose's parallel level 2 for the open tasks' seams before the groups start. Under the run, build stays sequential and writes the reason.

Write `build shape: <sequential|parallel>, <n> tasks, <n> groups, <reason when it differs from Delivery>` to `status.md`.

## Groups

- Run `scripts/slice.mjs` from `contract-first-parallel-build` with each `open` task's entry points and the frozen contract declarations, where the language allows. Elsewhere, group by calls and the data they pass, and say which edges you added by hand.
- Build the dependence graph from the slices, `builds_against` and `depends_on`. A group that needs another group's result (an output no frozen contract covers) runs after it. When you cannot tell whether two groups depend on each other, write "dependence unknown".
- Tasks whose slices share an unfrozen node are one group with one writer. Never group by file, by task id order, or in fixed pairs.
- Write `notes/build-groups.md`: the shape, each group's name, its task ids, the contracts it imports, and the groups it runs after (or "dependence unknown"). For a sequential build, also the task order.
- On a rerun after verify reopened tasks, build only the `open` tasks, in the shape already in Delivery.

## Sequential

- Work only in `<repo>/.worktrees/<slug>/` on the feature branch. No group worktrees, no group branches, no merge train.
- Order: a topological order of the groups, and inside each group of its tasks by `depends_on`; ties by task id.
- One fresh agent per task, one at a time, with the Agent tool. Its brief carries everything inline: the task's text, its criteria, the contract files to import, the paths it may edit, and the check. When the Agent tool is not available, do the tasks yourself in the same order.
- Write `task <id> started` before the agent starts and `task <id> closed` when its check holds.
- Each task: change bodies and private helpers, and, with `contract: none`, add the declarations it produces exactly as its **Change** writes them. Run its check and its falsification probe (the check fails with the implementation disabled and passes with it in place), then commit on the feature branch.
- A task whose check fails stays `open`. Skip every task that depends on it, directly or through its group, and go on with the rest.
- A task that needs a seam changed: set it `blocked` with `contract change: <declaration>: <why>`. With a contract commit, run a small contract wave for that declaration only. With `contract: none`, rewrite the seam in its producing task and in every task that quotes it, and reopen any `closed` one that it changes. Then continue from that task.
- After the last task: the compile or type check, the contract tests, and the full suite on the feature branch. A failure reopens the tasks whose code it points to, with the diagnostic under **Check**.

## Parallel

Load `contract-first-parallel-build` with the Skill tool and follow its phases 2 to 4. This section says what Epic Flow adds to them.

### Infill

- A group starts as soon as every contract it imports has merged and every group it depends on has merged. Nothing waits for a wave, and nothing starts before its dependencies.
- One agent per group, in `<repo>/.worktrees/<slug>-<group>/` on branch `<branch>-<group>`, cut from the feature branch tip.
- The brief carries everything inline: the tasks' text, their criteria, the contract files to import, the paths it may edit, and the checks.
- The writer writes `task <id> started` and `task <id> closed` lines to `status.md` in the main checkout, or returns their times for you to write.
- Writers change function bodies and private helpers. A writer that needs a contract change stops and reports `contract change: <declaration>: <why>`. Set that task `blocked` with the line, run a small contract wave for that declaration only, re-run the slices, and restart only the groups that reach it.
- Each writer runs its own tasks' checks and their falsification probe. It does not run the full suite.
- A test that holds a fixed port or a shared service (a mail server on a fixed port, a shared database, a fixed container name) cannot run in two groups at once. Hold it for the train.
- Concurrency is the number of agents the shape analysis allowed, lowered when the account quota or the machine's load requires it.

### Merge train

- Line up finished groups. Test each on top of the ones ahead of it, each in its own scratch worktree, all at once. Merge onto the feature branch in order as each passes. Drop a failure, send its exact diagnostic to its group, and retest the ones behind it.
- Checks at the train: the merge, the compile or type check, the contract tests, the tests held back from the groups, the full suite.
- A textual conflict inside one function means two groups owned the same node. Regroup; do not patch it at the join.

## The contract holds

With `contract: none`, every seam in the code matches the signature its producing task wrote, as last rewritten. With a contract commit, in both shapes, by the marks in `notes/contract-gate.md`: `git diff <contract>` is empty for each `whole` file, and for each `declarations` file it touches only stub bodies (no exported declaration, signature or type changes). Any other change came from a contract wave.

## Task status

- A task closes only when its check holds on the feature branch (after its merge, when parallel). Write the command, the exit code and the result under **Check** in the task file.
- A failed check leaves the task `open`, with the failure under **Check**.
- When the code and a task disagree, leave the task `open`, write what disagrees, and send it back to `epic-flow:gaps` before building it.

## Time budget

When the Delivery time budget is spent, counted from the `build started` line in `status.md`, start no new task or group. Let running ones finish and merge. Write `budget spent` and the `open` task ids to `status.md`.

## Delivery

- Commit on the feature branch, and on group branches when parallel. Never on the base branch.
- Push and open a PR only when Delivery says so, against the branch it names. The PR body lists each acceptance criterion, the tasks that serve it, and their check results.

## Progress

Report only what has finished, from `status.md` and git: tasks closed and groups merged, with times. Never describe a task or group as running unless its agent is running.

## When the build ends

When every task is `closed`, leave the technical plan `in-progress`. Alone, stop and name `epic-flow:verify`. Under the run, return `done`. If tasks stay `open` because a check failed or the budget ran out, return `error` with their ids.

## Done when

- [ ] The technical plan's status is `in-progress`.
- [ ] `status.md` has a `build shape:` line, and it matches Delivery **Build shape** or gives the reason it does not.
- [ ] Every task has status `closed`, with a command, an exit code and a result under **Check**.
- [ ] Every task has `task <id> started` and `task <id> closed` lines in `status.md`.
- [ ] `notes/build-groups.md` names the shape and lists every task id in exactly one group, and gives the task order when sequential.
- [ ] When sequential, no `<repo>/.worktrees/<slug>-*` worktree or `<branch>-*` branch was created by this build.
- [ ] With a contract commit: the feature branch in `<repo>/.worktrees/<slug>/` contains it and has commits after it; `git diff <contract>` is empty for each `whole` contract file and touches only stub bodies in each `declarations` file, or `status.md` records a contract wave for each changed declaration.
- [ ] With `contract: none`: the feature branch has a commit for each closed task, and each seam a task produced exists in the code with the signature that task wrote.
- [ ] No commit this build made on the feature branch is on the base branch.
- [ ] If Delivery says no push, the feature branch has no upstream. If a PR was opened, its URL is in `status.md`.
- [ ] `status.md` has a `build finished` line.
