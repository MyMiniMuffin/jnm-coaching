import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createCoachMcpServer, createKeyAuthorizer } from '../mcp/server.mjs';
import { handleMcpRequest } from '../mcp/http.mjs';

const require = createRequire(import.meta.url);
const { createFakeDb } = require('./fixtures/coach-fake-db.cjs');
const { createCoachGateway } = require('../coach-api/http.js');
const { createCoachService } = require('../coach-api/service.js');

const TOOLS = [
  'get_latest_weekly_reports',
  'get_meal_plan',
  'get_training_program',
  'get_weekly_reports',
  'get_weight_history',
  'list_athletes',
  'update_meal_plan',
  'update_training_program'
];

const parse = (result) => JSON.parse(result.content[0].text);

const connectInMemory = async (db) => {
  const server = createCoachMcpServer({ service: createCoachService(db.sql), key: { id: 1, name: 'grok', scope: 'coach' } });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
};

test('MCP lists the coach tools and serves reads from the shared service', async () => {
  const db = createFakeDb();
  const client = await connectInMemory(db);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), TOOLS);
  assert.equal(tools.find((tool) => tool.name === 'update_meal_plan').inputSchema.properties.dryRun.default, true);

  const athletes = parse(await client.callTool({ name: 'list_athletes', arguments: {} }));
  assert.deepEqual(athletes.athletes.map((athlete) => athlete.name), ['Ada Utøver']);
  assert.doesNotMatch(JSON.stringify(athletes), /password|\$2a\$/);

  const reports = parse(await client.callTool({ name: 'get_weekly_reports', arguments: { athleteId: 5, week: '2026-W46' } }));
  assert.deepEqual(reports.reports.map((report) => report.id), [102]);
  assert.doesNotMatch(JSON.stringify(reports), /image|cloudinary/i);
  await client.close();
});

test('MCP write tools default to dry-run and return the diff without writing', async () => {
  const db = createFakeDb();
  const client = await connectInMemory(db);
  const result = parse(await client.callTool({
    name: 'update_training_program',
    arguments: { athleteId: 5, plans: [{ name: 'Program A', sections: [{ title: 'Dag 1', items: [{ text: 'Knebøy', sets: '4', reps: '6' }] }] }] }
  }));
  assert.equal(result.dryRun, true);
  assert.equal(result.saved, false);
  assert.deepEqual(result.diff.added[0].lines, ['+ [Dag 1]', '+ Knebøy: 4 × 6']);
  // The app's empty placeholder plan is replaced, not kept as an empty extra tab.
  assert.deepEqual(result.after.plans.map((plan) => plan.name), ['Program A']);
  assert.equal(db.state.planWrites, 0);
  assert.equal(db.state.audit.length, 0);

  const saved = parse(await client.callTool({
    name: 'update_meal_plan',
    arguments: { athleteId: 5, mode: 'replace', plans: [{ name: 'Matplan', text: 'Ny plan' }], dryRun: false }
  }));
  assert.equal(saved.saved, true);
  assert.equal(db.state.audit[0].action, 'meal_plan.replace');
  assert.equal(db.state.audit[0].key_name, 'grok');

  const invalid = await client.callTool({ name: 'update_meal_plan', arguments: { athleteId: 5, mode: 'replace', plans: [] } });
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /400/);
  await client.close();
});

/** Same shape as server.mjs: the body is read (stream drained) before handleMcpRequest. */
const startHttpServer = async (t, db) => {
  const gateway = createCoachGateway({ sql: db.sql });
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    await handleMcpRequest(req, res, { gateway, ip: '127.0.0.1', body: Buffer.concat(chunks) });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return new URL(`http://127.0.0.1:${server.address().port}/mcp`);
};

test('stdio-style servers re-check the key on every tool call, so revocation is immediate', async () => {
  const db = createFakeDb();
  const authorize = createKeyAuthorizer(db.sql, db.keys.valid);
  const key = await authorize();
  const server = createCoachMcpServer({ service: createCoachService(db.sql), key, authorize });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const before = await client.callTool({ name: 'list_athletes', arguments: {} });
  assert.equal(before.isError, undefined);

  db.state.keys.find((row) => row.id === key.id).revoked_at = '2026-11-15T12:00:00Z';
  for (const call of [
    { name: 'list_athletes', arguments: {} },
    { name: 'update_meal_plan', arguments: { athleteId: 5, mode: 'replace', plans: [{ name: 'Matplan', text: 'Ny' }], dryRun: false } }
  ]) {
    const result = await client.callTool(call);
    assert.equal(result.isError, true, call.name);
    assert.match(result.content[0].text, /^401:/);
  }
  assert.equal(db.state.planWrites, 0);

  // Scope changes take effect immediately too.
  const row = db.state.keys.find((r) => r.id === key.id);
  row.revoked_at = null;
  row.scope = 'read-only';
  assert.match((await client.callTool({ name: 'list_athletes', arguments: {} })).content[0].text, /^403:/);
  await client.close();

  await assert.rejects(createKeyAuthorizer(db.sql, db.keys.revoked)(), (error) => error.statusCode === 401);
});

test('MCP over HTTP: GET/DELETE get 405 without a transport, empty POST gets a parse error', async (t) => {
  const db = createFakeDb();
  const url = await startHttpServer(t, db);
  const auth = { Authorization: `Bearer ${db.keys.valid}` };

  for (const method of ['GET', 'DELETE']) {
    for (const headers of [auth, {}]) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { method, headers: { Accept: 'text/event-stream', ...headers }, signal: controller.signal });
      const body = await response.json();
      clearTimeout(timer);
      assert.equal(response.status, 405, method);
      assert.equal(response.headers.get('allow'), 'POST');
      assert.equal(body.jsonrpc, '2.0');
      assert.equal(body.error.code, -32000);
    }
  }
  // 405 is answered before authentication: no key lookups happened.
  assert.equal(db.state.queries.length, 0);

  for (const body of [undefined, '', 'not json']) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...auth },
      body
    });
    assert.equal(response.status, 400, JSON.stringify(body));
    const json = await response.json();
    assert.equal(json.error.code, -32700);
    assert.equal(json.id, null);
  }

  // Unauthenticated empty POST still gets 401, not a parse error.
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
});

test('MCP over Streamable HTTP authenticates with the coach key', async (t) => {
  const db = createFakeDb();
  const url = await startHttpServer(t, db);

  const initialize = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '1' } }
  };
  const post = (headers) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(initialize)
  });
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ Authorization: `Bearer ${db.keys.revoked}` })).status, 401);
  assert.equal((await post({ Authorization: `Bearer ${db.keys.wrongScope}` })).status, 403);

  const unauthenticated = new Client({ name: 'test', version: '1.0.0' });
  await assert.rejects(unauthenticated.connect(new StreamableHTTPClientTransport(url)));

  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${db.keys.valid}` } }
  }));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), TOOLS);
  const plan = parse(await client.callTool({ name: 'get_meal_plan', arguments: { athleteId: 5 } }));
  assert.equal(plan.plans[0].text, 'Frokost: havregryn\nLunsj: kylling');
  const dryRun = parse(await client.callTool({ name: 'update_meal_plan', arguments: { athleteId: 5, plans: [{ id: 'original', text: 'Ny' }] } }));
  assert.equal(dryRun.dryRun, true);
  assert.equal(db.state.planWrites, 0);
  await client.close();
});
