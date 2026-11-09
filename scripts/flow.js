export const meta = {
  name: 'epic-flow',
  description: 'Epic Flow over many features at once: develop briefs with a questioner and an answerer, or run technical plan through verify unattended, each stage checked from the files',
  whenToUse: 'Started by /epic-flow:run, which passes the repo, the plugin root and each feature with its range of stages.',
  phases: [
    { title: 'Develop', detail: 'a questioner and an answerer draft each brief' },
    { title: 'Flow', detail: 'technical plan, decompose, gaps, build and verify for each feature, each stage checked' },
  ],
}

// Stages the unattended flow can run. Brainstorm runs as `develop` plus the question session in the main conversation.
const STAGES = ['technical-plan', 'decompose', 'gaps', 'build', 'verify']
const DEVELOP_ROUNDS = 2

const A = args || {}
if (!A.repo || !A.pluginRoot || !Array.isArray(A.features) || A.features.length === 0) {
  throw new Error('epic-flow: start this from /epic-flow:run, which passes repo, pluginRoot and features.')
}
const VERIFY_ROUNDS = Number.isInteger(A.verifyRounds) ? A.verifyRounds : 2

const CONVENTIONS = `${A.pluginRoot}/conventions.md`
const skillFile = name => `${A.pluginRoot}/skills/${name}/SKILL.md`
const records = slug => `${A.repo}/.epic-flow/${slug}`
const AGENT = { agentType: 'general-purpose' }

const runContext = slug => [
  'You are working under epic-flow:run, unattended. Nobody will answer a question during this run.',
  `Repository (main checkout): ${A.repo}`,
  `Feature: ${slug}. Records: ${records(slug)}/`,
  `Read ${CONVENTIONS} first. It defines the records, the status values, the answer order for questions, and what running under epic-flow:run means.`,
].join('\n')

// ---------- develop: questioner and answerer draft each brief ----------

const QUESTION = {
  type: 'object',
  properties: { id: { type: 'string' }, question: { type: 'string' }, why: { type: 'string' } },
  required: ['id', 'question'],
}
const FOR_USER = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    question: { type: 'string' },
    recommended: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'question', 'recommended'],
}
const QUESTIONER = {
  type: 'object',
  properties: {
    brief: { type: 'string', description: 'full path of brief.md' },
    summary: { type: 'string', description: 'two lines: what the draft says the feature is' },
    questions: { type: 'array', items: QUESTION, description: 'questions for the answerer; empty when there are none' },
    forUser: { type: 'array', items: FOR_USER, description: 'questions still open in questions.md' },
    assumed: { type: 'integer', description: 'how many answers in questions.md are assumed' },
    status: { type: 'string', enum: ['draft', 'accepted'] },
  },
  required: ['brief', 'summary', 'questions', 'forUser', 'assumed', 'status'],
}
const ANSWERER = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rule: { type: 'string', enum: ['1', '2', '3', '4', '5', 'user'] },
          answer: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['id', 'rule'],
      },
    },
  },
  required: ['answers'],
}

const userRule = A.unattended
  ? 'The user asked not to be asked. A question the answerer marked user gets the smaller, reversible option (rule 5), recorded as assumed, unless it is about credentials, accounts or something only a person can do; those stay open.'
  : 'A question the answerer marked user stays open in questions.md, with your recommended answer as its default.'

async function develop(f) {
  const tag = f.slug
  let q = await agent([
    runContext(f.slug),
    `Read ${skillFile('brainstorm')} and act as the Questioner it defines. This is the first round.`,
    `Start from ${f.source || `${records(f.slug)}/brief.md`}.`,
    'Write the draft brief and add every question to questions.md as the Questioner section says.',
    'Return the questions the Answerer should take. forUser and assumed describe questions.md as it stands now.',
  ].join('\n'), { ...AGENT, label: `${tag} questioner`, phase: 'Develop', schema: QUESTIONER })
  if (!q) return { slug: f.slug, error: 'questioner did not return' }

  for (let round = 1; round <= DEVELOP_ROUNDS && q.questions.length > 0; round++) {
    const a = await agent([
      runContext(f.slug),
      `Read ${skillFile('brainstorm')} and act as the Answerer it defines. Read only; write nothing.`,
      `The draft brief is ${q.brief}. Answer these questions:`,
      JSON.stringify(q.questions, null, 2),
    ].join('\n'), { ...AGENT, label: `${tag} answerer ${round}`, phase: 'Develop', schema: ANSWERER })
    if (!a) return { slug: f.slug, brief: q.brief, error: `answerer ${round} did not return` }

    const last = round === DEVELOP_ROUNDS
    const next = await agent([
      runContext(f.slug),
      `Read ${skillFile('brainstorm')} and act as the Questioner it defines. Round ${round} of ${DEVELOP_ROUNDS}.`,
      'The Answerer returned:',
      JSON.stringify(a.answers, null, 2),
      'Fold the answers into brief.md and questions.md.',
      last ? 'This is the last round: ask no follow-ups.' : 'Ask follow-ups only where an answer opens a new decision.',
      userRule,
      'Set brief.md to accepted only when no question for this feature is open; otherwise leave it draft.',
      'For each open question, give your recommended answer and up to three other options.',
    ].join('\n'), { ...AGENT, label: `${tag} questioner ${round}`, phase: 'Develop', schema: QUESTIONER })
    if (!next) return { slug: f.slug, brief: q.brief, error: `questioner round ${round} did not return` }
    q = next
  }
  return { slug: f.slug, brief: q.brief, summary: q.summary, status: q.status, forUser: q.forUser, assumed: q.assumed }
}

// ---------- flow: each stage, then an independent check from the files ----------

const STAGE_RESULT = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['done', 'waiting', 'blocked', 'failed', 'error'] },
    summary: { type: 'string', description: 'what the files now show, in a few lines' },
    questions: { type: 'array', items: { type: 'string' }, description: 'ids of questions this stage left open' },
  },
  required: ['outcome', 'summary'],
}
const CHECK = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' }, description: 'each Done when item that does not hold, with the evidence' },
  },
  required: ['pass', 'problems'],
}

const stagePrompt = (f, stage, note) => [
  runContext(f.slug),
  `Run the Epic Flow stage "${stage}" for this feature: read ${skillFile(stage)} and follow it.`,
  note || '',
  'When the stage ends, return its outcome as the conventions define it (done, waiting, blocked, failed, error), a short summary of what the files now show, and the ids of any questions it left open.',
].filter(Boolean).join('\n')

const codeStages = new Set(['decompose', 'build', 'verify'])
const checkPrompt = (f, stage) => [
  'You are the independent checker for one Epic Flow stage. Trust no summary, including the stage agent\'s. Test from the files only.',
  `Repository (main checkout): ${A.repo}. Feature records: ${records(f.slug)}/`,
  `Read ${CONVENTIONS}, then the "Done when" list at the end of ${skillFile(stage)}.`,
  codeStages.has(stage)
    ? `Test every item against the records, the worktree at ${A.repo}/.worktrees/${f.slug}/ and its git log. Re-run the commands the records cite as evidence; a recorded result you cannot reproduce fails its item.`
    : 'Test every item against the records and the repository.',
  'Change nothing: no edits, no commits, and revert anything a command leaves behind.',
  'Return pass true only when every item holds. List each item that does not, with the evidence.',
].join('\n')

async function runStage(f, stage, note) {
  const tag = `${f.slug} ${stage}`
  let r = await agent(stagePrompt(f, stage, note), { ...AGENT, label: tag, phase: 'Flow', schema: STAGE_RESULT })
  if (!r) return { outcome: 'error', summary: 'the stage agent did not return' }
  if (r.outcome !== 'done') return r

  let c = await agent(checkPrompt(f, stage), { ...AGENT, label: `${tag} check`, phase: 'Flow', schema: CHECK })
  if (c && c.pass) return r

  const problems = c ? c.problems.join('\n- ') : 'the checker did not return'
  r = await agent(stagePrompt(f, stage, `An independent checker found that these Done when items do not hold. Fix them, then return:\n- ${problems}`),
    { ...AGENT, label: `${tag} repair`, phase: 'Flow', schema: STAGE_RESULT })
  if (!r) return { outcome: 'error', summary: 'the repair agent did not return' }
  if (r.outcome !== 'done') return r

  c = await agent(checkPrompt(f, stage), { ...AGENT, label: `${tag} recheck`, phase: 'Flow', schema: CHECK })
  if (c && c.pass) return r
  return { outcome: 'error', summary: `the checker still fails it after one repair:\n- ${c ? c.problems.join('\n- ') : 'the checker did not return'}` }
}

async function flow(f) {
  const from = STAGES.indexOf(f.from)
  const to = STAGES.indexOf(f.to)
  if (from < 0 || to < 0 || from > to) {
    return { slug: f.slug, outcome: 'error', stoppedAt: f.from, summary: `range ${f.from} to ${f.to} is not a range of ${STAGES.join(', ')}`, trail: [] }
  }
  const trail = []
  let i = from
  let buildRounds = 0
  let note = f.note || ''
  while (i <= to) {
    const stage = STAGES[i]
    const r = await runStage(f, stage, note)
    trail.push({ stage, outcome: r.outcome, summary: r.summary })
    note = ''
    if (r.outcome === 'done') { i++; continue }
    if (stage === 'verify' && r.outcome === 'failed' && buildRounds < VERIFY_ROUNDS) {
      buildRounds++
      log(`${f.slug}: verify failed; build again (${buildRounds} of ${VERIFY_ROUNDS})`)
      note = `Verify failed and reopened tasks. Build the reopened and new tasks only. Verify reported:\n${r.summary}`
      i = STAGES.indexOf('build')
      continue
    }
    return { slug: f.slug, outcome: r.outcome, stoppedAt: stage, summary: r.summary, questions: r.questions || [], trail }
  }
  return { slug: f.slug, outcome: 'done', stoppedAt: STAGES[to], trail }
}

// ---------- entry ----------

if (A.mode === 'develop') {
  phase('Develop')
  const results = await parallel(A.features.map(f => () => develop(f)))
  return { mode: 'develop', results: results.map((r, i) => r || { slug: A.features[i].slug, error: 'develop failed' }) }
}

phase('Flow')
// A feature with `after: [slugs]` needs those features' results, so it starts only once they are done.
// Features without `after` are independent and run together. Unknown or circular `after` is an error, never a guess.
const slugs = new Set(A.features.map(f => f.slug))
const outcome = {}
const pending = A.features.slice()
while (pending.length) {
  const ready = []
  for (const f of pending.slice()) {
    const after = f.after || []
    const missing = after.filter(s => !slugs.has(s) || s === f.slug)
    const stopped = after.filter(s => outcome[s] && outcome[s].outcome !== 'done')
    if (missing.length) outcome[f.slug] = { slug: f.slug, outcome: 'error', stoppedAt: f.from, summary: `after names ${missing.join(', ')}, which is not another feature in this run`, trail: [] }
    else if (stopped.length) outcome[f.slug] = { slug: f.slug, outcome: 'blocked', stoppedAt: f.from, summary: `waits for ${stopped.join(', ')}, which did not finish`, trail: [] }
    else if (after.every(s => outcome[s])) { ready.push(f); continue }
    else continue
    pending.splice(pending.indexOf(f), 1)
  }
  if (ready.length === 0) {
    for (const f of pending) outcome[f.slug] = { slug: f.slug, outcome: 'error', stoppedAt: f.from, summary: 'after forms a cycle', trail: [] }
    break
  }
  const rs = await parallel(ready.map(f => () => flow(f)))
  ready.forEach((f, i) => {
    outcome[f.slug] = rs[i] || { slug: f.slug, outcome: 'error', summary: 'the feature chain failed' }
    pending.splice(pending.indexOf(f), 1)
  })
}
return { mode: 'flow', results: A.features.map(f => outcome[f.slug]) }
