const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDb } = require('./fixtures/coach-fake-db.cjs');
const { createCoachGateway } = require('../coach-api/http');
const { generateKey, hashKey, parseKey } = require('../coach-api/keys');
const { parseStoredPlans, serializeStoredPlans } = require('../coach-api/plans');
const { isoWeekRange } = require('../coach-api/service');
const { run: runKeyCommand } = require('../scripts/coach-key.cjs');

const setup = (options) => {
  const db = createFakeDb();
  const gateway = createCoachGateway({ sql: db.sql, ...options });
  const call = async (method, path, { key = db.keys.valid, body, query = {}, headers = {}, ip = '10.0.0.1' } = {}) => {
    const response = await gateway.handle({
      method,
      path: `/api/coach/v1${path}`,
      query,
      headers: key ? { authorization: `Bearer ${key}`, ...headers } : headers,
      body: body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body)),
      ip
    });
    return { ...response, json: JSON.parse(response.body) };
  };
  return { db, gateway, call };
};

const SENSITIVE = /password|\$2a\$|image|cloudinary|token|push|p256dh|endpoint|notes/i;

// --- Keys ---

test('generated keys have the documented format and are stored as a hash only', () => {
  const { key, prefix, hash } = generateKey();
  assert.match(key, /^jnmc_[0-9a-f]{12}_[0-9a-f]{64}$/);
  assert.equal(parseKey(key).prefix, prefix);
  assert.equal(hash, hashKey(key));
  assert.ok(!hash.includes(key.split('_')[2]));
});

// --- Auth ---

test('missing Authorization header is rejected with 401', async () => {
  const { call } = setup();
  const response = await call('GET', '/athletes', { key: null });
  assert.equal(response.statusCode, 401);
  assert.match(response.headers['WWW-Authenticate'], /^Bearer/);
});

test('malformed keys and non-Bearer schemes are rejected with 401', async () => {
  const { call } = setup();
  for (const key of ['abc', 'jnmc_short_key', `jnmc_${'g'.repeat(12)}_${'0'.repeat(64)}`]) {
    assert.equal((await call('GET', '/athletes', { key })).statusCode, 401, key);
  }
  const basic = await call('GET', '/athletes', { key: null, headers: { authorization: 'Basic dXNlcjpwYXNz' } });
  assert.equal(basic.statusCode, 401);
});

test('unknown prefix and wrong secret are rejected with 401', async () => {
  const { call, db } = setup();
  assert.equal((await call('GET', '/athletes', { key: generateKey().key })).statusCode, 401);
  const prefix = parseKey(db.keys.valid).prefix;
  const wrongSecret = `jnmc_${prefix}_${'0'.repeat(64)}`;
  assert.equal((await call('GET', '/athletes', { key: wrongSecret })).statusCode, 401);
});

test('revoked key is rejected with 401', async () => {
  const { call, db } = setup();
  const response = await call('GET', '/athletes', { key: db.keys.revoked });
  assert.equal(response.statusCode, 401);
});

test('key without coach scope, or bound to a non-coach user, is rejected with 403', async () => {
  const { call, db } = setup();
  assert.equal((await call('GET', '/athletes', { key: db.keys.wrongScope })).statusCode, 403);
  assert.equal((await call('GET', '/athletes', { key: db.keys.athleteOwned })).statusCode, 403);
});

test('valid key works and updates last_used_at (throttled in SQL)', async () => {
  const { call, db } = setup();
  const response = await call('GET', '/me');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json.key, { name: 'grok', prefix: parseKey(db.keys.valid).prefix, scope: 'coach' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  const touch = db.state.queries.find((q) => q.text.includes('SET last_used_at = NOW()'));
  assert.match(touch.text, /INTERVAL '1 minute'/);
});

test('the key never appears in query parameters sent to the database', async () => {
  const { call, db } = setup();
  await call('GET', '/athletes');
  const secret = db.keys.valid.split('_')[2];
  assert.ok(db.state.queries.every((q) => q.values.every((value) => !String(value).includes(secret))));
});

test('failed authentication is rate limited per IP, requests per key', async () => {
  const { call } = setup({ failedAuthPer10Min: 2, requestsPerMinute: 3 });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) statuses.push((await call('GET', '/athletes', { key: 'bad', ip: '1.2.3.4' })).statusCode);
  assert.deepEqual(statuses, [401, 401, 429]);
  const keyStatuses = [];
  for (let i = 0; i < 4; i += 1) keyStatuses.push((await call('GET', '/me')).statusCode);
  assert.deepEqual(keyStatuses, [200, 200, 200, 429]);
});

// --- Read endpoints ---

test('list athletes excludes archived by default and never returns passwords', async () => {
  const { call } = setup();
  const response = await call('GET', '/athletes');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json.athletes.map((a) => a.id), [5]);
  assert.equal(response.json.athletes[0].stepGoal, 9000);
  assert.doesNotMatch(response.body, SENSITIVE);
  const all = await call('GET', '/athletes', { query: { includeArchived: 'true' } });
  assert.deepEqual(all.json.athletes.map((a) => a.id), [5, 6]);
});

test('latest weekly reports return one report per athlete without image fields', async () => {
  const { call } = setup();
  const response = await call('GET', '/reports/latest');
  assert.equal(response.statusCode, 200);
  const [ada] = response.json.athletes;
  assert.equal(ada.latestReport.id, 102);
  assert.equal(ada.latestReport.weight, 80.9);
  assert.doesNotMatch(response.body, SENSITIVE);
});

test('weekly reports for one athlete, filtered by ISO week and by from/to', async () => {
  const { call } = setup();
  const all = await call('GET', '/athletes/5/reports');
  assert.deepEqual(all.json.reports.map((r) => r.id), [102, 101]);
  assert.doesNotMatch(all.body, SENSITIVE);

  const week = await call('GET', '/athletes/5/reports', { query: { week: '2026-W45' } });
  assert.equal(week.statusCode, 200);
  assert.deepEqual(week.json.period, { from: '2026-11-02', to: '2026-11-08', week: '2026-W45' });
  assert.deepEqual(week.json.reports.map((r) => r.id), [101]);

  const range = await call('GET', '/athletes/5/reports', { query: { from: '2026-11-05', to: '2026-11-30' } });
  assert.deepEqual(range.json.reports.map((r) => r.id), [102]);
});

test('invalid report filters give 400 with details', async () => {
  const { call } = setup();
  for (const query of [{ week: '2026-W60' }, { from: '2026-02-30' }, { from: '2026-11-10', to: '2026-11-01' }, { week: '2026-W45', from: '2026-11-01' }]) {
    const response = await call('GET', '/athletes/5/reports', { query });
    assert.equal(response.statusCode, 400, JSON.stringify(query));
    assert.ok(Array.isArray(response.json.details));
  }
});

test('ISO week ranges handle year boundaries and week 53', () => {
  assert.deepEqual(isoWeekRange('2026-W01'), { from: '2025-12-29', to: '2026-01-04' });
  assert.deepEqual(isoWeekRange('2026-W53'), { from: '2026-12-28', to: '2027-01-03' });
  assert.equal(isoWeekRange('2025-W53'), null);
});

test('unknown athlete, non-athlete and bad ids give 404/400', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/athletes/999/reports')).statusCode, 404);
  assert.equal((await call('GET', '/athletes/1/meal-plan')).statusCode, 404);
  assert.equal((await call('GET', '/athletes/abc/weight')).statusCode, 400);
  assert.equal((await call('GET', '/nope')).statusCode, 404);
  const wrongMethod = await call('DELETE', '/athletes');
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.Allow, 'GET');
});

test('weight history comes from the weekly reports, oldest first, with a summary', async () => {
  const { call } = setup();
  const response = await call('GET', '/athletes/5/weight');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json.entries.map((e) => [e.date, e.weight]), [['2026-11-02', 81.4], ['2026-11-09', 80.9]]);
  assert.deepEqual(response.json.summary, { first: 81.4, latest: 80.9, change: -0.5, entries: 2 });
  assert.equal(response.json.periods[0].goalWeight, 78);
  assert.doesNotMatch(response.body, SENSITIVE);
});

test('queries select explicit columns and never touch password, image or push columns', async () => {
  const { call, db } = setup();
  await call('GET', '/athletes');
  await call('GET', '/reports/latest');
  await call('GET', '/athletes/5/reports');
  await call('GET', '/athletes/5/weight');
  await call('GET', '/athletes/5/meal-plan');
  for (const { text } of db.state.queries) {
    assert.doesNotMatch(text, /SELECT \*|\.\*|password|images|image_url|gallery|push_subscriptions|notes/i, text);
  }
});

// --- Plans ---

test('GET meal plan shows legacy text as one plan, like the app', async () => {
  const { call } = setup();
  const response = await call('GET', '/athletes/5/meal-plan');
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.storageFormat, 'legacy');
  assert.deepEqual(response.json.plans, [{ id: 'original', name: 'Matplan', text: 'Frokost: havregryn\nLunsj: kylling' }]);
});

const structuredProgram = {
  plans: [{
    name: 'Program A',
    sections: [
      { title: 'Dag 1 – Underkropp', items: [{ text: 'Knebøy', sets: 4, reps: '6' }, ' Utfall '] },
      { title: '', items: [] }
    ]
  }]
};

test('dry-run returns before/after/diff and writes nothing', async () => {
  const { call, db } = setup();
  const response = await call('PUT', '/athletes/5/training-program', { body: structuredProgram, query: { dryRun: 'true' } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.dryRun, true);
  assert.equal(response.json.saved, false);
  assert.equal(response.json.changed, true);
  assert.equal(response.json.after.plans[0].name, 'Program A');
  assert.deepEqual(response.json.diff.added[0].lines, ['+ [Dag 1 – Underkropp]', '+ Knebøy: 4 × 6', '+ Utfall']);
  assert.equal(db.state.planWrites, 0);
  assert.equal(db.state.audit.length, 0);
  assert.equal(db.state.users[5].workout_plan, '');
  assert.ok(db.state.queries.every((q) => !/UPDATE users|INSERT INTO/.test(q.text)));

  const bodyFlag = await call('PATCH', '/athletes/5/meal-plan', { body: { plans: [{ id: 'original', text: 'Ny' }], dryRun: true } });
  assert.equal(bodyFlag.json.dryRun, true);
  assert.deepEqual(bodyFlag.json.diff.modified[0].lines, ['- Frokost: havregryn', '- Lunsj: kylling', '+ Ny']);
  assert.equal(db.state.planWrites, 0);
});

test('real update stores the app format and writes an audit row with before/after', async () => {
  const { call, db } = setup();
  const response = await call('PUT', '/athletes/5/training-program', { body: structuredProgram });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.saved, true);
  assert.equal(db.state.planWrites, 1);

  // Same JSON the coach UI writes (serializeNamedPlans + serializePlan).
  const stored = JSON.parse(db.state.users[5].workout_plan);
  assert.equal(stored.format, 'jnm-workout-plans');
  assert.equal(stored.version, 1);
  assert.equal(stored.plans[0].name, 'Program A');
  assert.deepEqual(JSON.parse(stored.plans[0].content), {
    format: 'jnm-plan',
    version: 3,
    sections: [{
      title: 'Dag 1 – Underkropp',
      items: [
        { text: 'Knebøy', sets: '4', reps: '6', subItems: [] },
        { text: 'Utfall', sets: '', reps: '', subItems: [] }
      ]
    }]
  });

  const [audit] = db.state.audit;
  assert.equal(audit.key_id, 1);
  assert.equal(audit.key_name, 'grok');
  assert.equal(audit.action, 'training_program.replace');
  assert.equal(audit.athlete_id, 5);
  assert.equal(audit.before_value, '');
  assert.equal(audit.after_value, db.state.users[5].workout_plan);
  assert.equal(response.json.auditId, 1);

  const reread = await call('GET', '/athletes/5/training-program');
  assert.equal(reread.json.storageFormat, 'named-plans');
  assert.equal(reread.json.plans[0].sections[0].items[0].sets, '4');
});

test('PATCH updates one plan by id and keeps the others; PUT keeps ids for same names', async () => {
  const { call, db } = setup();
  db.state.users[5].diet_plan = serializeStoredPlans([
    { id: 'a', name: 'Treningsdag', text: 'Mye karbo' },
    { id: 'b', name: 'Hviledag', sections: [{ title: 'Frokost', items: [{ text: 'Egg', subItems: ['2 stk'] }] }] }
  ], 'diet');
  const patched = await call('PATCH', '/athletes/5/meal-plan', { body: { plans: [{ id: 'a', text: 'Mindre karbo' }, { name: 'Ny dag', text: 'Fri' }] } });
  assert.equal(patched.statusCode, 200);
  const plans = parseStoredPlans(db.state.users[5].diet_plan, 'diet').plans;
  assert.deepEqual(plans.map((p) => [p.id, p.name]).slice(0, 2), [['a', 'Treningsdag'], ['b', 'Hviledag']]);
  assert.equal(plans[0].text, 'Mindre karbo');
  assert.deepEqual(plans[1].sections[0].items[0].subItems, ['2 stk']);
  assert.equal(plans[2].name, 'Ny dag');
  assert.equal(db.state.audit[0].action, 'meal_plan.patch');

  const replaced = await call('PUT', '/athletes/5/meal-plan', { body: { plans: [{ name: 'hviledag', text: 'Rolig' }] } });
  assert.equal(replaced.json.after.plans[0].id, 'b');
  assert.deepEqual(replaced.json.diff.removed.map((p) => p.id).sort(), ['a', plans[2].id].sort());

  const removeAll = await call('PATCH', '/athletes/5/meal-plan', { body: { removePlanIds: ['b'] } });
  assert.equal(removeAll.statusCode, 400);
});

test('write validation errors return 400 with clear details and write nothing', async () => {
  const { call, db } = setup();
  const cases = [
    'not json',
    '[]',
    { plans: [] },
    { plans: [{ name: '', text: 'x' }] },
    { plans: [{ name: 'A', text: 'x', sections: [] }] },
    { plans: [{ name: 'A' }] },
    { plans: [{ name: 'A', text: 'x' }], extra: true },
    { plans: [{ name: 'A', sections: [{ title: 'x', items: [{ text: 'a', weight: 5 }] }] }] },
    { plans: [{ name: 'A', text: 'x' }, { name: 'a', text: 'y' }] },
    { plans: [{ name: 'A', text: 'x'.repeat(200001) }] },
    { plans: [{ name: 'A', text: 'x' }], dryRun: 'yes' }
  ];
  for (const body of cases) {
    const response = await call('PUT', '/athletes/5/meal-plan', { body });
    assert.equal(response.statusCode, 400, JSON.stringify(body).slice(0, 80));
    assert.ok(response.json.error);
  }
  const details = await call('PUT', '/athletes/5/meal-plan', { body: { plans: [{ name: '', text: 'x' }] } });
  assert.deepEqual(details.json.details.map((d) => d.path), ['plans.0.name']);
  const patchUnknown = await call('PATCH', '/athletes/5/meal-plan', { body: { plans: [{ id: 'missing', text: 'x' }] } });
  assert.equal(patchUnknown.statusCode, 400);
  assert.equal(db.state.planWrites, 0);
});

test('archived athletes cannot be changed; concurrent changes give 409', async () => {
  const { call, db } = setup();
  const archived = await call('PUT', '/athletes/6/meal-plan', { body: { plans: [{ name: 'A', text: 'x' }] } });
  assert.equal(archived.statusCode, 409);

  // Simulate the coach saving in the app between our read and our write.
  const originalSql = db.sql;
  const gateway = createCoachGateway({
    sql: async (strings, ...values) => {
      if (strings.join('$').includes('WITH updated AS')) db.state.users[5].diet_plan = 'endret i appen';
      return originalSql(strings, ...values);
    }
  });
  const response = await gateway.handle({
    method: 'PUT',
    path: '/api/coach/v1/athletes/5/meal-plan',
    query: {},
    headers: { authorization: `Bearer ${db.keys.valid}` },
    body: JSON.stringify({ plans: [{ name: 'A', text: 'x' }] }),
    ip: '10.0.0.2'
  });
  assert.equal(response.statusCode, 409);
  assert.equal(db.state.users[5].diet_plan, 'endret i appen');
  assert.equal(db.state.audit.length, 0);
});

// --- Key management script ---

test('coach-key create stores only the hash and prints the key once; revoke and rotate work', async () => {
  const inserted = [];
  const updates = [];
  const transactions = [];
  const sql = async (strings, ...values) => {
    const text = strings.join('$');
    if (text.includes("WHERE role = 'coach'")) return [{ id: 1, username: 'coach' }];
    if (text.includes('INSERT INTO coach_api_keys')) { inserted.push(values); return []; }
    if (text.includes('UPDATE coach_api_keys SET revoked_at')) {
      updates.push(values);
      return values[0] === 'aaaaaaaaaaaa' ? [{ name: 'grok' }] : [];
    }
    if (text.includes('FROM coach_api_keys k')) return [{ id: 9, name: 'grok', scope: 'coach', coach_user_id: 1, coach_username: 'coach' }];
    throw new Error(`Unexpected: ${text}`);
  };
  sql.transaction = async (queries) => { transactions.push(queries.length); return Promise.all(queries); };

  const output = [];
  const created = await runKeyCommand(['create', '--name', 'grok'], { sql, log: (line) => output.push(line) });
  assert.match(created.key, /^jnmc_/);
  assert.equal(output.filter((line) => line.includes(created.key)).length, 1);
  const [prefix, hash, name, scope, coachId] = inserted[0];
  assert.deepEqual([prefix, hash, name, scope, coachId], [created.prefix, hashKey(created.key), 'grok', 'coach', 1]);
  assert.ok(!inserted[0].includes(created.key));

  await runKeyCommand(['revoke', 'aaaaaaaaaaaa'], { sql, log: () => {} });
  await assert.rejects(runKeyCommand(['revoke', 'bbbbbbbbbbbb'], { sql, log: () => {} }), /Fant ingen aktiv nøkkel/);
  await assert.rejects(runKeyCommand(['revoke', 'not-a-prefix'], { sql, log: () => {} }), /Ugyldig prefix/);

  const rotated = await runKeyCommand(['rotate', 'aaaaaaaaaaaa'], { sql, log: () => {} });
  assert.notEqual(rotated.key, created.key);
  assert.deepEqual(transactions, [2]);
  await assert.rejects(runKeyCommand(['create'], { sql, log: () => {} }), /--name/);
});
