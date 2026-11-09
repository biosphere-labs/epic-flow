# Prior art

Collected Oct 12, 2026. Literature entries are from general knowledge; web results were checked on
that date where a link is given.

## Dependence graphs and slicing

- **Program slicing:** Mark Weiser, "Program Slicing", ICSE 1981; IEEE TSE 1984. A slice is everything
  a chosen point depends on.
- **Program Dependence Graph (PDG):** Ferrante, Ottenstein and Warren, ACM TOPLAS 1987. Control and data
  dependence inside one procedure.
- **System Dependence Graph (SDG):** Horwitz, Reps and Binkley, "Interprocedural Slicing Using
  Dependence Graphs", ACM TOPLAS 1990. PDGs joined by call and parameter edges, with summary edges and a
  two-phase walk that keeps calling context, so a slice does not enter a function from one caller and
  leave into another.
- **IFDS:** Reps, Horwitz and Sagiv, POPL 1995. Interprocedural data-flow problems solved as graph
  reachability in polynomial time.
- **Code Property Graph:** Yamaguchi et al., IEEE S&P 2014; implemented in Joern. AST, control flow and
  dependence in one queryable graph.
- **Tools:** Joern, CodeQL (data flow for JavaScript and TypeScript among others), IBM WALA, Jelly
  (call graphs for JavaScript and TypeScript), and the TypeScript language service's call hierarchy,
  which `scripts/slice.mjs` uses.

## LLM decomposition and parallel generation

- **Skeleton-of-Thought** (Microsoft and Tsinghua, ICLR 2024): outline first, expand points in parallel.
  Reported weakness: points that depend on each other. https://arxiv.org/pdf/2307.15337
- **Parsel** (Stanford, NeurIPS 2023): hierarchical function descriptions, several implementations per
  function, tests choose a combination that works together. https://arxiv.org/abs/2212.10561v3
- **Self-Organized Agents** (2024): parent agents spawn child agents, one function each, from docstrings.
  Tested on small benchmark problems only. https://www.arxiv.org/abs/2404.02183
- **CodePlan** (Microsoft, 2023): repository edits as an adaptive plan, re-running an incremental
  dependency analysis after each change.
  https://www.microsoft.com/en-us/research/publication/codeplan-repository-level-coding-using-llms-and-planning/
- **CAID** (2026): manager agent, dependency graph, one worktree per engineer agent, git merge. Reports
  branches correct in isolation whose integration fails to run. https://arxiv.org/html/2603.21489v1
- **AlphaEvolve** (DeepMind, 2025) and FunSearch: model-proposed changes kept or dropped by an automatic
  evaluator; works where the evaluator is machine-checkable.
- **Mergiraf:** syntax-aware git merge driver; merges on the syntax tree, leaves conflicts of meaning to
  a person or agent. https://docs.rs/mergiraf

## Checked and not found, or different from how they were described

- "Pact" at pact.tools with the tagline "Contracts Before Code": no such page found. The Pact usually
  meant (pact.io) is consumer-driven contract testing between services, a related but different job.
- SpecDD: exists, keeps small spec files next to the code (https://www.producthunt.com/p/specdd). It does
  not replace file grouping with compiler-enforced contracts.
- contract4agents: exists on PyPI as a typed contract language for agent behaviour
  (https://pypi.org/project/contract4agents/0.13.0/); the GitHub owner it was attributed to was not
  confirmed.
- Claims that contract-first splitting cuts semantic conflicts by a stated percentage: no study found
  behind them.
