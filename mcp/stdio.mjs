#!/usr/bin/env node
/**
 * MCP over stdio for local clients (Claude Desktop, Cursor, ...):
 *
 *   COACH_API_KEY=jnmc_... NETLIFY_DATABASE_URL=postgres://... node mcp/stdio.mjs
 *
 * Talks to the database directly with the same service layer and key check as
 * https://jnmcoaching.no/mcp. Clients that support remote MCP servers should
 * use that URL instead; then no database URL is needed locally.
 * stdout is the MCP channel: log only to stderr.
 */
import { createRequire } from 'node:module';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCoachMcpServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { getSql } = require('../coach-api/db.js');
const { authenticateCoachKey } = require('../coach-api/keys.js');
const { createCoachService } = require('../coach-api/service.js');

const main = async () => {
  const apiKey = process.env.COACH_API_KEY;
  if (!apiKey) throw new Error('COACH_API_KEY er ikke satt');
  const sql = getSql();
  const auth = await authenticateCoachKey(sql, `Bearer ${apiKey}`);
  if (!auth.ok) throw new Error(`API-nøkkelen ble avvist (${auth.statusCode}): ${auth.error}`);

  const server = createCoachMcpServer({ service: createCoachService(sql), key: auth.key });
  await server.connect(new StdioServerTransport());
  console.error(`jnm-coaching MCP (stdio) klar, nøkkel "${auth.key.name}"`);
};

main().catch((error) => {
  console.error('MCP stdio feilet:', error?.message || error);
  process.exit(1);
});
