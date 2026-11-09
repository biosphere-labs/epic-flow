---
name: contract-first-parallel-build
description: >
  How to split software work across agents that build at the same time without paying for it at the
  seams: contracts and compiling stubs first, groups computed from the dependence graph (calls plus the
  data they pass), parallel infill against real stubs, then mechanical linking through a merge train.
  Use it whenever you plan, decompose or orchestrate a build that more than one agent, SDK session,
  subagent, headless CLI or worktree will write at once: tree builds, leaf groups, joins, merge trains,
  software-factory runs, epic decomposition, briefing build agents, or deciding what may run in parallel.
  Use it too when joins or seams keep failing, when two agents disagree about an interface, or when
  anyone proposes grouping work by file, by task id order or in fixed pairs, when contracts must be
  designed from requirements with domain-driven design (aggregates, bounded contexts, value objects),
  or when tuning group size against a benchmark. It replaces file-based grouping rules in other skills.
---

# Contract-first parallel build

## Why this exists

Writing code is the front end of compilation. A model writes by continuing the code it can see, and it
predicts whatever it cannot see. Two agents that build against a prose description of the same seam
each fill its gaps their own way: a field name, an argument order, `null` against an empty list, an
object against an array. The join then pays for every difference, and a join agent negotiating two
diffs can cost as much as the two tasks did. For example, a server
function returned `{ path, ref, sha, entries }`, the page called `.map` on the whole answer, the two
sides were built and tested apart, and a mock hid the mismatch until the page crashed.

Parallel compilation works for three reasons. Headers fix every seam before any unit compiles. Each
unit's output depends only on its inputs. Linking is mechanical, and a missing symbol fails at once
with an exact message. Get the same properties before you fan out: seams exist as compiling code
before any parallel writer starts, groups come from what depends on what, and the join is a compiler
run plus tests.

Files are storage. A file groups code by where someone put it, so it says little about which code has
to agree. Two functions in one file can be unrelated, and a function and its caller usually live in
different files. Do not group, order or split parallel work by file, by task id order, or in fixed-size
pairs. The unit is the dependence slice: an entry point, everything it calls, and the data shapes that
flow along those calls. Program analysis calls this graph the System Dependence Graph (SDG); see
`references/prior-art.md`.

## The pipeline

### Phase 0: what goes in

- The requirements in any form (stories, a spec, tickets), each outcome with its acceptance criteria:
  given, or derived by planning to cover the full functionality. The build is done when every
  criterion's test passes.
- For work on existing code, the code itself: its dependence graph is the first step of the contract
  wave. For other languages see "Other stacks" below.

### Phase 1: the contract wave (in sequence)

**The contracts are an input, not a design session.** By the time a build fans out, its contracts
should already exist, or a good-enough approximation of them:
- given with the work (a spec, an OpenAPI or Avro file, an existing interface), or
- decided earlier in planning, or
- borrowed from a **reference system**: a well-known, higher-quality system in the same domain whose
  terminology, data model and interfaces are adopted as defaults ("do what Jenkins would do" can give a
  project its domain model without answering every question from scratch). Offer those defaults to the
  person with progressive disclosure: accept them, or open a choice and give specifics. Every borrowed
  decision names its reference.
- designed in planning with domain-driven design when the input carries only requirements and
  criteria: language, subdomains, bounded contexts, aggregates, value objects, events and ports, under
  rules a machine can check. See `references/ddd-design.md`.

If none of these exists, stop and get them before fanning out; parallel writers will otherwise invent
them, each differently.

**Then check the list covers every seam.** Run `scripts/slice.mjs` over the existing code with each
outcome's entry points as one task. Every node in its `sharedNodes` is reached by more than one
outcome and must be on the contract list. Add the new seams the outcomes name that no code has yet (a
new route, a new record, a new callback), and every seam that crosses an untyped boundary (below). That
list is what this wave freezes; the rest belongs to one group or another.

Then one writer, or one per area that shares nothing with the others, materializes every seam on that
list as code that compiles. This wave writes decisions down; it does not make them:

- **Data shapes:** records, DTOs, wire shapes, branded identifier types.
- **Edges of behaviour:** the error taxonomy and return convention (throw, or a result type), and
  nullability (`null`, `undefined` or empty, decided per field).
- **Seam signatures:** every function where two groups will meet, every entry point, sync or async,
  stream or batch.
- **Stub bodies** that throw the project's internal-gap marker (for example `FIXME[internal]`).
- **Contract tests:** preconditions, postconditions and invariants, written against the stubs. They
  compile, and they fail on the stub.

The contract wave also decides where each declaration lives (its path). That is the only place file
paths are chosen, and they are storage decisions, not grouping decisions.

What the contract writer needs, with a worked example: `references/contracts.md`.

**One gate, on the integration branch:** the type check passes, every contract test fails on the
stub (an assertion failure or the stub's throw, never a compile error), and, when the contracts were
designed with DDD, rules R1–R9 of `references/ddd-design.md` hold (every criterion owned by one group
and red, ids across aggregates, imports across contexts only through ports, no cycles, concrete
signatures). The gate is one script the pipeline runs; no writer runs or edits it. Merge the contract commit.
No parallel writer starts before it is merged, because a writer that cannot import a seam will invent
one.

**Untyped boundaries.** The compiler stops at HTTP, JSON files, database rows, CLI output and untyped
JavaScript. For each seam that crosses one, give both sides one shared schema or type they both import
(for plain JS, JSDoc types with `checkJs`), and a contract test on each side that reads the same
fixture, produced by running the real producer. A hand-written mock is not that fixture: it agrees with
whoever wrote it.

### Phase 2: compute the groups (from the stubs)

Run `scripts/slice.mjs` with each task's entry points and every node the contract wave froze
(`--frozen`). It walks a static approximation of the System Dependence Graph: calls, functions passed
or defaulted by name, module-level values read, and the types in signatures and their members. It
writes each task's slice, the nodes tasks still share, and the groups.

- Two tasks whose slices share a node that is **not** frozen go into one group with one writer.
- A frozen node is a boundary: it appears in every slice that reaches it, links no tasks, and the walk
  stops there, because a writer depends on the contract's signature and never on the code behind it.
  The task that owns the node still walks past it from its own entry point.
- When the script reports a large group, its `sharedNodes` are the candidates to freeze next. Freezing
  is how the contract wave buys parallelism.
- Group size comes out of the graph. Never force pairs or triples.
- The analysis does not see functions chosen at runtime through a variable, event emitters, RxJS
  subscriptions, dependency-injection containers, dynamic imports, or anything crossing HTTP, files or
  the database. Add those edges with `--edge`, and say in the plan which edges were added by hand.

Within a group, one writer works from the entry point downward, so each caller and its callee are
written in the same context.

**New projects.** Stubs have no bodies, so their call graph is empty and only type references link
them; `slice.mjs` on a fresh skeleton under-groups. Group by the DDD design instead: one group per
aggregate with the use cases that change it, merged or split by size thresholds that are tuning levers
(below). `slice.mjs` stays useful to check rules R3 and R8 and, once code exists, to regroup.

### Phase 3: wavefront infill (in parallel)

- **Start rule:** a group starts as soon as every contract it imports has merged. Nothing waits for a
  whole tier.
- **One agent per group,** in its own worktree cut from the integration tip. Never start a second
  builder on a group that has one; a usage limit means wait for that account or move the same session
  to another account.
- **The brief carries everything inline:** the group's outcomes and criteria, the contract files to
  import, the paths it may edit, and the tests that prove it. No pointers such as "as in the base spec",
  no prose stand-in for another group's code.
- **Scope:** the writer changes function bodies, private helpers, its own copies of convenience
  helpers, and additions to types its group owns (rule R6). It does not change another group's
  declaration, a port it consumes, the shared kernel, a shared schema or a contract test. There is no
  change-request channel: every open question was answered before the freeze (below), so the brief
  holds everything the writer needs and nothing waits on another group.
- **Tests:** its own tests and their falsification probes only. The full suite runs at the train.
- **Concurrency** follows the quota of the accounts in use and the machine's load at the time, not a
  fixed number. A loaded machine turns timing tests into noise for everyone.

### Phase 4: mechanical linking (merge train)

- Line up the finished groups. Test each on top of the ones ahead of it, each in its own scratch
  worktree, all at once. Merge in order as each passes; drop a failure and retest the ones behind it
  without it.
- Checks: merge, type check, contract tests, integration tests, the full suite.
- A failure goes back to the group that owns it with the exact diagnostic. No join agent reconciles two
  diffs.
- One check keeps contracts frozen: `git diff <contract commit> -- <contract files>` is empty for the
  branch, or the change arrived through a contract wave.
- A textual conflict inside one function means two groups owned the same node, so the grouping was
  wrong. Regroup; do not patch it at the join.

### Open questions close before the build

Nothing is deferred into the build, so nothing in the build stops for an answer. Before the contract
wave freezes, planning lists every open question the requirements leave (a missing field, an error
case, a paging rule, an ordering) and answers each one by researching similar apps and standards,
picking the most reasonable answer and recording it as a derived criterion with its source. The freeze
waits until the list is empty. Composable contracts (`references/ddd-design.md`) keep the remaining
detail inside one group, where the writer settles it in its own types.

If a writer still meets a gap, that is a planning miss, not a request to handle mid-build: the group
finishes within its scope, the train's failing test names the gap, and the miss is recorded so the
next decomposition asks that question up front. The benchmark counts these misses.

After the train, deduplicate convenience helpers that groups wrote separately: a mechanical refactor,
checked by the suite staying green before and after. Run it last.

## Measure it, and tune by measurement

Whether a group fits a model is about connectedness and complexity, not size, and static analysis alone
cannot tell. Measure on a benchmark with a deterministic oracle the agents never see (for example, the
RealWorld API scored by its Hurl suite). Per run, record:

1. Oracle pass rate after the train (quality).
2. Cycles to green per group; the distribution is the headline number. Where each repair is a new
   stateless call, a cycle is a call.
3. Planning misses: gaps a writer met that planning should have answered, and groups rerun (seam
   heat). This grades the plan itself, not the writers.
4. Wall-clock from intake to a green train; tokens and cost per stage.

Levers: group size thresholds, how much neighbouring context a brief carries, shared-kernel size,
modelling depth per subdomain class, model per stage. Change one lever at a time, repeat each setting
enough to see the spread (models are not deterministic), and keep the better distribution. A reasonable
first bar: oracle at 100% after the train, the typical group green in at most two cycles, and most
runs with no reruns.

## Worked example: what a file-based pair cost

A tree build paired two tasks because one listed the other in `depends_on`, and that edge existed only because both edited the same two files. The real dependency was a third task, built on another branch, that produced a proxy the second task called. The second task guessed the proxy's callback from the third task's prose, the proxy's allowlist missed a call the test library makes, the merge train failed, and a join agent had to add the route and the callback across four files. `slice.mjs` on the merged code gave one group of all three with nothing frozen, and three independent groups once five contract nodes were frozen. Those five should have been the contract wave.

## Editing by symbol

Where the tooling allows it (Serena's symbol tools, a language server's rename and replace), have
writers edit named symbols instead of line ranges. The model's knowledge is the same either way; the
gain is placement. A writer's scope is a set of symbols, symbol edits keep it there, and the merge
sees whole functions change. No measurement of the effect exists here yet.

## Other stacks

The pipeline is the same; the tools change. Java: the contract wave writes interfaces, records and
OpenAPI or schema files, and the gate is the compile (Gradle or Maven) plus the contract tests; slices
come from the IDE call hierarchy, Joern, CodeQL or WALA. Any HTTP seam gets a shared schema (OpenAPI)
and a contract test on each side.

## Signs the build has drifted back

| Sign | What it costs | Do instead |
|---|---|---|
| Groups by file, id order or fixed pairs | Splits a call stack; the seam becomes a negotiation | Slices from `slice.mjs` |
| A writer builds against a task file's prose description of another group's code | Two programs that disagree | Import the stub |
| A join agent reconciling two branches | The join costs as much as the tasks | Contract wave, then the train |
| Two builders on one group | Double quota, one result thrown away | One agent per group |
| Full suite in every leaf | Machine load, timing flakes | Own tests in the leaf, full suite at the train |
| A task that points to other documents for its content | The builder hunts and may build the wrong thing | Everything inline in the brief |
| Mock or fixture data the producer never produced | Hides the seam | Fixtures from the real producer |

## References

- `references/contracts.md`: the four inputs to a stub, an example contract commit, and a checklist.
- `references/ddd-design.md`: designing the contracts from requirements with domain-driven design: the
  kinds, helper kinds, seam kinds and rules R1–R9.
- `references/prior-art.md`: the SDG and slicing literature, the LLM work on decomposition and parallel
  generation, and what was checked and not found.
- `scripts/slice.mjs`: slices, shared nodes and groups for TypeScript projects. Run it with no
  arguments for its usage.
