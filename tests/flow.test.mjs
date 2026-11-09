// Runs epic-flow/scripts/flow.js with fake agent()/parallel()/phase()/log() to test its control flow.
// Usage: node tests/flow.test.mjs [path to flow.js]  (default: scripts/flow.js beside this folder)
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const flowPath = process.argv[2] || new URL('../scripts/flow.js', import.meta.url)
const src = readFileSync(flowPath, 'utf8').replace('export const meta', 'const meta')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const body = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', 'budget', src)

// script: (label, prompt, callIndexForLabelPrefix) => result
async function run(args, script) {
  const calls = []
  const seen = {}
  const agent = async (prompt, opts) => {
    calls.push(opts.label)
    seen[opts.label] = (seen[opts.label] || 0) + 1
    return script(opts.label, prompt, seen[opts.label], opts)
  }
  const parallel = async thunks => Promise.all(thunks.map(t => t().catch(() => null)))
  const out = await body(args, agent, parallel, null, () => {}, () => {}, { total: null })
  return { out, calls }
}

const base = { repo: '/r', pluginRoot: '/p' }
const done = { outcome: 'done', summary: 's' }
const pass = { pass: true, problems: [] }
const results = []
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]) }
}

await test('happy path runs five stages, each checked once', async () => {
  const { out, calls } = await run({ ...base, features: [{ slug: 'a', from: 'technical-plan', to: 'verify' }] },
    label => (label.endsWith('check') ? pass : done))
  const r = out.results[0]
  assert.equal(r.outcome, 'done'); assert.equal(r.stoppedAt, 'verify')
  assert.deepEqual(r.trail.map(t => t.stage), ['technical-plan', 'decompose', 'gaps', 'build', 'verify'])
  assert.equal(calls.length, 10)
})

await test('verify failing once sends the feature back to build, then passes', async () => {
  const { out, calls } = await run({ ...base, features: [{ slug: 'b', from: 'build', to: 'verify' }] },
    (label, prompt, n) => {
      if (label.endsWith('check')) return pass
      if (label === 'b verify' && n === 1) return { outcome: 'failed', summary: 'AC-2 not tested' }
      return done
    })
  const r = out.results[0]
  assert.equal(r.outcome, 'done')
  assert.deepEqual(r.trail.map(t => t.stage), ['build', 'verify', 'build', 'verify'])
  const secondBuild = calls.filter(l => l === 'b build').length
  assert.equal(secondBuild, 2)
})

await test('the rebuild prompt carries what verify reported', async () => {
  let rebuildPrompt = ''
  await run({ ...base, features: [{ slug: 'b', from: 'build', to: 'verify' }] },
    (label, prompt, n) => {
      if (label.endsWith('check')) return pass
      if (label === 'b build' && n === 2) rebuildPrompt = prompt
      if (label === 'b verify' && n === 1) return { outcome: 'failed', summary: 'AC-2 not tested' }
      return done
    })
  assert.match(rebuildPrompt, /AC-2 not tested/)
  assert.match(rebuildPrompt, /reopened and new tasks only/)
})

await test('verify failing every time stops after verifyRounds rebuilds', async () => {
  const { out, calls } = await run({ ...base, verifyRounds: 2, features: [{ slug: 'c', from: 'build', to: 'verify' }] },
    label => (label.endsWith('check') ? pass : label === 'c verify' ? { outcome: 'failed', summary: 'x' } : done))
  const r = out.results[0]
  assert.equal(r.outcome, 'failed'); assert.equal(r.stoppedAt, 'verify')
  assert.equal(calls.filter(l => l === 'c build').length, 3)
  assert.equal(calls.filter(l => l === 'c verify').length, 3)
})

await test('gaps blocked stops the feature before build; another feature carries on', async () => {
  const { out, calls } = await run({ ...base, features: [
    { slug: 'd', from: 'technical-plan', to: 'verify' },
    { slug: 'e', from: 'technical-plan', to: 'verify' },
  ] }, label => {
    if (label.endsWith('check')) return pass
    if (label === 'd gaps') return { outcome: 'blocked', summary: 'Q-2 open', questions: ['Q-2'] }
    return done
  })
  const [d, e] = out.results
  assert.equal(d.outcome, 'blocked'); assert.equal(d.stoppedAt, 'gaps'); assert.deepEqual(d.questions, ['Q-2'])
  assert.ok(!calls.includes('d build'))
  assert.equal(e.outcome, 'done')
})

await test('a blocked or waiting stage is not sent to the checker', async () => {
  const { calls } = await run({ ...base, features: [{ slug: 'w', from: 'technical-plan', to: 'verify' }] },
    label => (label === 'w technical-plan' ? { outcome: 'waiting', summary: 'Q-1' } : label.endsWith('check') ? pass : done))
  assert.deepEqual(calls, ['w technical-plan'])
})

await test('a failed check gets one repair and a recheck', async () => {
  const { out, calls } = await run({ ...base, features: [{ slug: 'f', from: 'decompose', to: 'decompose' }] },
    (label, prompt, n) => (label === 'f decompose check' ? { pass: false, problems: ['no contract:'] } : label.endsWith('recheck') ? pass : done))
  assert.equal(out.results[0].outcome, 'done')
  assert.deepEqual(calls, ['f decompose', 'f decompose check', 'f decompose repair', 'f decompose recheck'])
})

await test('the repair prompt carries the checker problems', async () => {
  let repairPrompt = ''
  await run({ ...base, features: [{ slug: 'f', from: 'decompose', to: 'decompose' }] },
    (label, prompt) => {
      if (label === 'f decompose repair') repairPrompt = prompt
      return label === 'f decompose check' ? { pass: false, problems: ['no contract: field'] } : label.endsWith('recheck') ? pass : done
    })
  assert.match(repairPrompt, /no contract: field/)
})

await test('a check that fails twice ends the feature with error', async () => {
  const { out, calls } = await run({ ...base, features: [{ slug: 'g', from: 'gaps', to: 'build' }] },
    label => (label.includes('check') ? { pass: false, problems: ['p'] } : done))
  assert.equal(out.results[0].outcome, 'error'); assert.equal(out.results[0].stoppedAt, 'gaps')
  assert.ok(!calls.includes('g build'))
})

await test('a dead stage agent is an error, not a pass', async () => {
  const { out } = await run({ ...base, features: [{ slug: 'h', from: 'gaps', to: 'build' }] },
    label => (label === 'h gaps' ? null : label.endsWith('check') ? pass : done))
  assert.equal(out.results[0].outcome, 'error'); assert.equal(out.results[0].stoppedAt, 'gaps')
})

await test('a range runs only its own stages', async () => {
  const { out } = await run({ ...base, features: [{ slug: 'i', from: 'technical-plan', to: 'decompose' }] },
    label => (label.endsWith('check') ? pass : done))
  assert.deepEqual(out.results[0].trail.map(t => t.stage), ['technical-plan', 'decompose'])
})

await test('a range that is not a range is an error without agents', async () => {
  const { out, calls } = await run({ ...base, features: [{ slug: 'j', from: 'verify', to: 'gaps' }] }, () => done)
  assert.equal(out.results[0].outcome, 'error'); assert.equal(calls.length, 0)
})

await test('missing args throw', async () => {
  await assert.rejects(() => run({ features: [] }, () => done), /start this from \/epic-flow:run/)
})

await test('stage prompts point at the stage skill and the conventions', async () => {
  let p = ''
  await run({ ...base, features: [{ slug: 'k', from: 'gaps', to: 'gaps' }] },
    (label, prompt) => { if (label === 'k gaps') p = prompt; return label.endsWith('check') ? pass : done })
  assert.match(p, /\/p\/skills\/gaps\/SKILL\.md/)
  assert.match(p, /\/p\/conventions\.md/)
  assert.match(p, /\/r\/\.epic-flow\/k\//)
})

await test('develop: questioner, answerer, questioner, answerer, questioner, then stops', async () => {
  const q = (n, questions) => ({ brief: '/r/.epic-flow/m/brief.md', summary: 's', questions, forUser: n === 3 ? [{ id: 'Q-4', question: 'who?', recommended: 'x' }] : [], assumed: n, status: 'draft' })
  const { out, calls } = await run({ ...base, mode: 'develop', features: [{ slug: 'm' }] },
    label => {
      if (label === 'm questioner') return q(1, [{ id: 'Q-1', question: 'a' }])
      if (label === 'm questioner 1') return q(2, [{ id: 'Q-3', question: 'b' }])
      if (label === 'm questioner 2') return q(3, [{ id: 'Q-5', question: 'c' }])
      return { answers: [{ id: 'Q-1', rule: '2' }] }
    })
  assert.deepEqual(calls, ['m questioner', 'm answerer 1', 'm questioner 1', 'm answerer 2', 'm questioner 2'])
  assert.equal(out.results[0].forUser[0].id, 'Q-4')
  assert.equal(out.results[0].assumed, 3)
})

await test('develop: no questions after the first draft means no answerer', async () => {
  const { calls } = await run({ ...base, mode: 'develop', features: [{ slug: 'n' }] },
    () => ({ brief: 'b', summary: 's', questions: [], forUser: [], assumed: 0, status: 'accepted' }))
  assert.deepEqual(calls, ['n questioner'])
})

await test('develop: the last questioner round is told to ask no follow-ups', async () => {
  let last = ''
  await run({ ...base, mode: 'develop', features: [{ slug: 'o' }] },
    (label, prompt) => {
      if (label === 'o questioner 2') last = prompt
      if (label.includes('answerer')) return { answers: [] }
      return { brief: 'b', summary: 's', questions: [{ id: 'Q', question: 'q' }], forUser: [], assumed: 0, status: 'draft' }
    })
  assert.match(last, /last round: ask no follow-ups/)
})

await test('develop: unattended changes how user questions are settled', async () => {
  const prompts = []
  const s = (label, prompt) => {
    prompts.push(prompt)
    if (label.includes('answerer')) return { answers: [] }
    return { brief: 'b', summary: 's', questions: label === 'p questioner' ? [{ id: 'Q', question: 'q' }] : [], forUser: [], assumed: 0, status: 'draft' }
  }
  await run({ ...base, mode: 'develop', unattended: true, features: [{ slug: 'p' }] }, s)
  assert.ok(prompts.some(p => /The user asked not to be asked/.test(p)))
})

await test('a feature that comes after another is not started with it; independent features still run together', async () => {
  const order = []
  const s = async (label) => {
    if (label.endsWith('check')) return pass
    order.push(label)
    await new Promise(r => setTimeout(r, label.startsWith('a ') ? 20 : 0))
    order.push(label + ' end')
    return done
  }
  const feats = [
    { slug: 'a', from: 'build', to: 'build' },
    { slug: 'b', from: 'build', to: 'build', after: ['a'] },
    { slug: 'c', from: 'build', to: 'build' },
  ]
  const { out } = await run({ ...base, features: feats }, s)
  assert.ok(order.indexOf('c build') < order.indexOf('a build end'), 'independent a and c run together')
  assert.ok(order.indexOf('b build') > order.indexOf('a build end'), 'b waits for a')
  assert.deepEqual(out.results.map(r => r.outcome), ['done', 'done', 'done'])
})

await test('a feature whose predecessor stopped is not started', async () => {
  const { out, calls } = await run({ ...base, features: [
    { slug: 'a', from: 'build', to: 'build' }, { slug: 'b', from: 'build', to: 'build', after: ['a'] }] },
    label => (label.endsWith('check') ? pass : label === 'a build' ? { outcome: 'failed', summary: 'x' } : done))
  assert.ok(!calls.includes('b build'))
  assert.equal(out.results[1].outcome, 'blocked')
})

await test('an unknown or circular after is an error, not a guess', async () => {
  const { out, calls } = await run({ ...base, features: [
    { slug: 'a', from: 'build', to: 'build', after: ['b'] }, { slug: 'b', from: 'build', to: 'build', after: ['a'] },
    { slug: 'c', from: 'build', to: 'build', after: ['zzz'] }] }, label => (label.endsWith('check') ? pass : done))
  assert.equal(calls.length, 0)
  assert.deepEqual(out.results.map(r => r.outcome), ['error', 'error', 'error'])
})

for (const r of results) console.log(r.join('  '))
const failed = results.filter(r => r[0] === 'FAIL').length
console.log(`${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
