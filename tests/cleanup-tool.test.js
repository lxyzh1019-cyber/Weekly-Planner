// Tests for tools/cleanup-ci-artifacts.html — the one-off cleaner for the CI
// run that wrote into the family's live Firestore document.
//
// Run: npm run test:cleanup
//
// The tool's whole value is that it removes test fixtures and NOTHING ELSE, so
// the test is built around a document that deliberately mixes the two: every
// fixture the suite writes, next to real family records chosen to look exactly
// like them — a "bike" debt, a "water" chore, an mrl- audit entry and a box-
// item with the same generated-id shape, differing only in their timestamps.
//
// No network: the page only touches Firebase inside the scan button's handler,
// which is never clicked here, and the Firebase hosts are blocked anyway. The
// detection and removal functions are called directly through window.__cleanup.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

function findChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
  ];
  const binaries = [['chrome-linux', 'chrome'], ['chrome-linux', 'headless_shell'],
                    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      if (!/^chromium/.test(dir)) continue;
      for (const bin of binaries) {
        const p = path.join(root, dir, ...bin);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

// The incident, and two moments safely outside it.
const CI_MID = Date.parse('2026-08-06T23:08:00Z');
const LONG_BEFORE = Date.parse('2026-06-01T10:00:00Z');
const AFTER = Date.parse('2026-08-07T09:00:00Z');
// Ids the app generates: prefix + Date.now().toString(36) + 4 random chars.
const genId = (prefix, t) => prefix + t.toString(36) + 'ab12';

/* Real records first, so a false positive here is a real deletion. Each one is
   shaped to trip a naive detector: same id prefixes, same field names, same
   look as the fixtures — only the clock differs. */
function realDocument() {
  return {
    _meta: { updatedAt: AFTER },
    profiles: {
      jenn: {
        weeks: {
          '2026-08-03': [
            { id: 'blk-real-1', actId: 'piano', startMin: 960, durationMin: 60, updatedAt: LONG_BEFORE },
            { id: 'blk-real-2', actId: 'school_day', startMin: 540, durationMin: 360, updatedAt: AFTER }
          ]
        },
        customActivities: [{ id: 'custom-real', name: 'Cello practice', updatedAt: LONG_BEFORE }],
        goals: [{ id: 'goal-real', text: 'Land the axel', updatedAt: LONG_BEFORE }],
        todos: [], achievements: [],
        // A real bike loan. Same id the suite uses.
        debts: [{ id: 'bike', name: 'Bike loan', principal: 200, createdAt: LONG_BEFORE, payments: [] }],
        savingGoals: [{ id: genId('sg-', LONG_BEFORE), name: 'New skates', target: 90, createdAt: LONG_BEFORE }],
        boxItems: [{ id: genId('box-', LONG_BEFORE), label: 'headphones', boxedAt: LONG_BEFORE }],
        holdings: [{ id: 'save-jenn', name: 'Money kept ready', createdAt: LONG_BEFORE }],
        deposits: [], fines: [], competitions: [], honesty: [],
        progress: { unlockedChecklistItems: { morning: [{ id: 'real-unlock' }] }, stickers: ['first'] }
      },
      jess: {
        weeks: {}, customActivities: [], goals: [], todos: [], achievements: [],
        debts: [], savingGoals: [], boxItems: [], holdings: [],
        deposits: [], fines: [], competitions: [], honesty: [], progress: {}
      }
    },
    shared: {
      challenges: [{ id: genId('ch-', LONG_BEFORE), title: 'Read every night', updatedAt: LONG_BEFORE }],
      invites: [], customTasks: [], routineTemplates: [], levelRules: [],
      parentPin: '1234',
      tombstones: { 'real-old-block': LONG_BEFORE },
      chore: {
        // Customised by the parent — this must survive, and cannotFix must say so.
        groups: [{ id: 'grp-starter', name: 'Tidy Squad', icon: '🧹', kid: 'both',
                   choreIds: ['Mop'], valueDollars: 5, cadence: 'weekly' }],
        moneyRules: {
          versions: [{ id: genId('mrv-', LONG_BEFORE), effectiveFrom: '2026-06-01',
                       createdAt: LONG_BEFORE, updatedAt: LONG_BEFORE,
                       rules: { chorePool: [
                         { id: 'dishes', label: 'Dishes & dishwasher' },
                         { id: 'mop', label: 'Mop' },
                         // A real "water the plants" chore. Same id the suite uses.
                         { id: 'water', label: 'Water the plants' }
                       ] } }],
          log: { [genId('mrl-', LONG_BEFORE)]: { id: genId('mrl-', LONG_BEFORE), at: LONG_BEFORE,
                 by: 'parent', path: 'chorePool', from: [], to: [] } }
        }
      }
    }
  };
}

/* Then the fixtures, planted the way the CI run would have left them. */
function pollute(doc) {
  const j = doc.profiles.jenn;
  // B: fixture ids, with stamps inside the window.
  j.weeks['2026-08-03'].push(
    { id: 't1', actId: 'breakfast', startMin: 450, durationMin: 30, updatedAt: CI_MID },
    { id: 'bk-blk', actId: 'training', startMin: 600, durationMin: 60, updatedAt: CI_MID });
  // A fixture id carrying no clock at all — still certain, nothing can contradict it.
  j.progress.unlockedChecklistItems.morning.push({ id: 'rt-unlock' });
  // C: the escaping probe.
  j.customActivities.push({ id: 'xss5-act', name: '<img src=x onerror="window.__xss5=1">&"', updatedAt: CI_MID });
  // A fixture name the suite writes.
  j.savingGoals.push({ id: genId('sg-', CI_MID), name: 'Round trip goal', target: 10, createdAt: CI_MID });
  // A: randomly named, detectable only by the clock.
  j.boxItems.push({ id: genId('box-', CI_MID), label: 'skates', boxedAt: CI_MID });
  doc.profiles.jess.holdings.push({ id: 'save-jess', name: 'Money kept ready', createdAt: CI_MID });
  // A: random ids in the money-rules audit log and versions.
  const mr = doc.shared.chore.moneyRules;
  const badLog = genId('mrl-', CI_MID);
  mr.log[badLog] = { id: badLog, at: CI_MID, by: 'parent', path: 'chorePool', from: [], to: [] };
  mr.versions.push({ id: genId('mrv-', CI_MID), effectiveFrom: '2026-08-03',
                     createdAt: CI_MID, updatedAt: CI_MID, rules: { chorePool: [] } });
  // The nasty one: on the leaked run the suite edited the family's EXISTING
  // rules version, so its chores landed in their real pool, next to their real
  // ones. These rows carry no timestamp — only the name gives them away.
  mr.versions[0].rules.chorePool.push(
    { id: 'watertheplants', label: 'watertheplants' },
    { id: 'Polish the cat', label: 'Polish the cat' });
  // A tombstone the suite wrote, on a bare fixture id.
  doc.shared.tombstones['t3'] = CI_MID;
  return doc;
}

// What must be found and pre-ticked, and what must never be touched.
const MUST_REMOVE = ['t1', 'bk-blk', 'rt-unlock', 'xss5-act', 'save-jess', 't3',
                     'watertheplants', 'Polish the cat'];
const MUST_KEEP = ['blk-real-1', 'blk-real-2', 'custom-real', 'goal-real', 'save-jenn',
                   'real-unlock', 'dishes', 'mop', 'grp-starter'];

(async () => {
  const browser = await chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // The tool must never reach the family's DATA in this test. Everything
  // Firebase is blocked; the two <script> tags fetching the SDK are expected
  // and counted separately from any attempt to read or write the document.
  let sdkFetches = 0, dataRequests = 0;
  await page.route('**://www.gstatic.com/firebasejs/**', r => { sdkFetches++; r.abort(); });
  await page.route('**://firestore.googleapis.com/**', r => { dataRequests++; r.abort(); });
  await page.route('**://*.googleapis.com/**', r => { dataRequests++; r.abort(); });
  await page.route('**://*.firebaseio.com/**', r => { dataRequests++; r.abort(); });

  await page.goto('file://' + path.join(__dirname, '..', 'tools', 'cleanup-ci-artifacts.html'));
  await page.waitForFunction(() => !!window.__cleanup);

  const doc = pollute(realDocument());
  const checks = {};

  // ── The clock oracle ──
  checks.decodesGeneratedIds = await page.evaluate(({ mid, before }) => {
    const { timeFromId } = window.__cleanup;
    return timeFromId('mrl-' + mid.toString(36) + 'ab12') === mid
        && timeFromId('box-' + before.toString(36) + 'ab12') === before
        // Hand-written ids are words, not clocks — including the ones that are
        // valid base 36 and decode to a plausible date. "watertheplants" begins
        // "waterthe", which is a 2049 timestamp if you let it be one.
        && timeFromId('dishes') === null && timeFromId('grp-starter') === null
        && timeFromId('bike') === null && timeFromId('t1') === null
        && timeFromId('watertheplants') === null && timeFromId('schoolbag') === null
        && timeFromId('handwriting') === null && timeFromId('sorting') === null
        // Shape is checked independently of the date: a body too long to be
        // Date.now() plus a random tail is not a generated id, even when its
        // first eight characters decode to a perfectly real moment.
        && timeFromId('x-' + mid.toString(36) + 'abcdef') === null
        && timeFromId(mid.toString(36).slice(0, 7)) === null
        // …and the real shapes still decode: no prefix, and a 3-char tail.
        && timeFromId(mid.toString(36) + 'abc') === mid
        && timeFromId('custom-' + mid.toString(36)) === mid;
  }, { mid: CI_MID, before: LONG_BEFORE });

  // ── Scan ──
  const res = await page.evaluate((d) => {
    const f = window.__cleanup.scan(d);
    return f.map(x => ({ id: x.id, certain: x.certain, field: x.field, why: x.why }));
  }, doc);

  const found = new Set(res.map(f => f.id));
  const ticked = new Set(res.filter(f => f.certain).map(f => f.id));

  checks.findsEveryFixture = MUST_REMOVE.every(id => ticked.has(id))
    || ['not pre-ticked: ' + MUST_REMOVE.filter(id => !ticked.has(id)).join(', ')];

  checks.findsRandomlyNamedOnesByClock = (() => {
    const wanted = [genId('box-', CI_MID), genId('mrv-', CI_MID), genId('mrl-', CI_MID), genId('sg-', CI_MID)];
    const missed = wanted.filter(id => !ticked.has(id));
    return missed.length === 0 || ['clock detector missed: ' + missed.join(', ')];
  })();

  checks.neverFlagsRealData = (() => {
    const wrong = MUST_KEEP.filter(id => found.has(id));
    return wrong.length === 0 || ['real records flagged: ' + wrong.join(', ')];
  })();

  checks.realLookalikesAreNotTicked = (() => {
    // The real bike debt and water chore share the suite's ids, so they must be
    // surfaced for a human — but never pre-ticked, because their clocks say real.
    const bad = [];
    for (const id of ['bike', 'water']) {
      const hit = res.find(f => f.id === id);
      if (!hit) bad.push(`the real "${id}" record was not surfaced at all`);
      else if (hit.certain) bad.push(`the real "${id}" record was pre-ticked`);
    }
    // Real mrl-/box- records from June must not be flagged by the clock.
    if (found.has(genId('mrl-', LONG_BEFORE))) bad.push('a June audit-log entry was flagged');
    if (found.has(genId('box-', LONG_BEFORE))) bad.push('a June boxed item was flagged');
    if (found.has(genId('mrv-', LONG_BEFORE))) bad.push('the June rules version was flagged');
    return bad.length === 0 || bad;
  })();

  // ── Removal ──
  const out = await page.evaluate((d) => {
    const { scan, applyRemovals } = window.__cleanup;
    const findings = scan(d);
    const chosen = findings.filter(f => f.certain);
    const { next, done } = applyRemovals(d, chosen);
    return { next, removed: done.length, before: d, stillFlagged: scan(next).filter(f => f.certain).length };
  }, doc);

  const n = out.next;
  checks.removesTheTickedItems = (() => {
    // Look at the records themselves, not the raw JSON: a removed id is
    // SUPPOSED to reappear as a tombstone key, so a string search would
    // report every correct removal as a failure.
    const j = n.profiles.jenn;
    const live = new Set();
    const collect = (arr) => (arr || []).forEach(x => x && x.id && live.add(x.id));
    Object.values(j.weeks || {}).forEach(collect);
    ['customActivities', 'goals', 'todos', 'achievements', 'debts', 'savingGoals',
     'boxItems', 'holdings'].forEach(f => collect(j[f]));
    collect(((j.progress || {}).unlockedChecklistItems || {}).morning);
    collect(n.profiles.jess.holdings);
    collect(n.shared.chore.groups);
    collect(n.shared.chore.moneyRules.versions);
    (n.shared.chore.moneyRules.versions || []).forEach(v => collect(((v || {}).rules || {}).chorePool));
    Object.keys(n.shared.chore.moneyRules.log).forEach(k => live.add(k));
    const left = MUST_REMOVE.filter(id => live.has(id) || (id === 't3' && n.shared.tombstones.t3));
    return left.length === 0 || ['still present after removal: ' + left.join(', ')];
  })();

  checks.keepsEveryRealRecord = (() => {
    const j = n.profiles.jenn;
    const bad = [];
    const ids = (a) => (a || []).map(x => x && x.id);
    if (ids(j.weeks['2026-08-03']).join() !== 'blk-real-1,blk-real-2') bad.push('real blocks changed');
    if (ids(j.customActivities).join() !== 'custom-real') bad.push('real activity lost');
    if (ids(j.goals).join() !== 'goal-real') bad.push('real goal lost');
    if (ids(j.debts).join() !== 'bike') bad.push('the real bike debt was removed');
    if (ids(j.holdings).join() !== 'save-jenn') bad.push('real holding lost');
    if (ids(j.boxItems).length !== 1) bad.push('real boxed item lost');
    if (ids(j.savingGoals).length !== 1) bad.push('real saving goal lost');
    if (j.progress.unlockedChecklistItems.morning.map(x => x.id).join() !== 'real-unlock') bad.push('real unlock lost');
    // Defensively: a broken tool can empty these, and a check that throws on
    // the way to reporting the breakage reports nothing at all.
    const mr = (n.shared.chore || {}).moneyRules || {};
    if ((mr.versions || []).length !== 1) bad.push(`real rules version lost (${(mr.versions || []).length} left)`);
    if (Object.keys(mr.log || {}).length !== 1) bad.push('real audit log entry lost');
    const pool = (((mr.versions || [])[0] || {}).rules || {}).chorePool;
    if (!pool) bad.push('the real chore pool is gone');
    else if (pool.map(c => c.id).join() !== 'dishes,mop,water') bad.push('the real chore pool changed: ' + pool.map(c => c.id).join());
    const grp = (n.shared.chore.groups || [])[0];
    if (!grp) bad.push('the customised chore group was removed');
    else if (grp.name !== 'Tidy Squad') bad.push('the customised group was changed');
    if ((n.shared.challenges || []).length !== 1) bad.push('real challenge lost');
    if ((n.shared.tombstones || {})['real-old-block'] !== LONG_BEFORE) bad.push('a real tombstone was dropped');
    return bad.length === 0 || bad;
  })();

  checks.writesTombstonesInTheRightScope = (() => {
    const t = n.shared.tombstones;
    const want = ['t1', 'bk-blk', 'ca:jenn:xss5-act', 'hold:save-jess'];
    const missing = want.filter(k => !t[k]);
    const bad = missing.length ? ['missing tombstones: ' + missing.join(', ')] : [];
    // The suite's own tombstone must be gone, not re-added.
    if (t['t3']) bad.push('the fixture tombstone t3 was not removed');
    return bad.length === 0 || bad;
  })();

  checks.isIdempotent = out.stillFlagged === 0
    || [`a second scan still flags ${out.stillFlagged} item(s)`];

  checks.doesNotMutateTheInput = (() => {
    // applyRemovals must work on a copy — the caller still needs DATA for the backup.
    const before = out.before;
    return before.profiles.jenn.weeks['2026-08-03'].some(b => b.id === 't1')
      || ['applyRemovals mutated the document it was given'];
  })();

  checks.cannotFixWarnsAboutTheStarterGroup = await page.evaluate((d) => {
    const notes = window.__cleanup.cannotFix(d).join(' ');
    // This document has a customised group, so the tool must say the edit survived.
    return notes.includes('not</b> at the factory default') || [notes.slice(0, 200)];
  }, doc);

  checks.cannotFixSpotsAFactoryDefault = await page.evaluate(() => {
    const factory = { shared: { chore: { groups: [{ id: 'grp-starter', name: 'Clean Home Crew',
      valueDollars: 3, choreIds: ['Mop', 'Vacuum', 'Dish Clean & Dishwasher'] }] } } };
    const notes = window.__cleanup.cannotFix(factory).join(' ');
    return notes.includes('exactly the factory default') || [notes.slice(0, 200)];
  });

  // Detection and removal are pure: they read the document they are handed and
  // nothing else. The scan button — the only thing that talks to Firestore — is
  // never clicked here, so not one request may reach the database.
  checks.readsNoLiveData = dataRequests === 0 || [`${dataRequests} request(s) to the database`];
  // The SDK <script> tags do fire on load, and are blocked; that is the page
  // being normal, not the tool reaching for data.
  checks.onlyTheSdkWasFetched = sdkFetches === 2 || [`${sdkFetches} SDK fetches, expected 2`];

  const realErrors = errors.filter(e => !/net::ERR_FAILED|Failed to load resource/.test(e));
  checks.noPageErrors = realErrors.length === 0 || realErrors;

  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  console.log(JSON.stringify({ checks, findings: res.length, removed: out.removed }, null, 2));
  console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL CLEANUP-TOOL CHECKS PASSED');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
