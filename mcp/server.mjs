/**
 * MCP server for the coach's AI assistants. The tools call the same service
 * layer as the REST API (coach-api/service.js); there is no business logic here.
 * One server is created per authenticated request (HTTP) or per process (stdio),
 * bound to the API key that was validated for it.
 */
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const { CoachApiError } = require('../coach-api/service.js');
const { fullPlanSchema, patchPlanSchema } = require('../coach-api/plans.js');
const { version } = require('../package.json');

const athleteId = z.number().int().positive().describe('Utøverens ID (fra list_athletes)');
const date = z.string().describe('Dato ÅÅÅÅ-MM-DD');
const includeArchived = z.boolean().optional().describe('Ta med arkiverte utøvere (standard: nei)');

const PLAN_HELP = 'Hver plan er { id?, name, sections } (strukturert: sections = [{ title, items: [tekst | { text, sets?, reps?, subItems? }] }]) '
  + 'eller { id?, name, text } (fritekst). Bruk samme id som get-verktøyet returnerer for å endre en eksisterende plan.';

const updateShape = {
  athleteId,
  mode: z.enum(['patch', 'replace']).default('patch').describe(
    'patch: endre/legg til planene som sendes (match på id, ellers navn) og behold resten. replace: planene som sendes erstatter alle.'
  ),
  plans: z.array(z.union([fullPlanSchema, patchPlanSchema])).max(20).default([]).describe(PLAN_HELP),
  removePlanIds: z.array(z.string()).max(20).optional().describe('Kun patch: ID-er til planer som skal slettes'),
  dryRun: z.boolean().default(true).describe('Standard true: viser før/etter/diff uten å lagre. Sett false for å lagre.')
};

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

const fail = (error) => {
  if (!(error instanceof CoachApiError)) {
    console.error('Coach MCP tool error:', error?.message || error);
    return { isError: true, content: [{ type: 'text', text: 'Intern feil' }] };
  }
  const details = error.details ? `\n${JSON.stringify(error.details, null, 2)}` : '';
  return { isError: true, content: [{ type: 'text', text: `${error.statusCode}: ${error.message}${details}` }] };
};

const run = async (fn) => {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error);
  }
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

/** @param {{ service: ReturnType<import('../coach-api/service.js').createCoachService>, key: object }} options */
export const createCoachMcpServer = ({ service, key }) => {
  const server = new McpServer(
    { name: 'jnm-coaching', version },
    {
      instructions: 'Verktøy for JNM Coaching sin coach. Utøvere = klienter. Ukesrapporter inneholder vekt, søvn, energi, '
        + 'nøyaktighet, økter og kommentar. Skriveverktøy kjører som standard med dryRun=true; vis diffen til coachen og '
        + 'kjør med dryRun=false først når coachen har godkjent endringen.'
    }
  );

  server.registerTool('list_athletes', {
    title: 'List utøvere',
    description: 'Lister coachens utøvere (klienter) med status, uleste rapporter og dato for siste rapport.',
    inputSchema: { includeArchived },
    annotations: READ_ONLY
  }, (args) => run(() => service.listAthletes(args)));

  server.registerTool('get_latest_weekly_reports', {
    title: 'Siste ukesrapport per utøver',
    description: 'Siste ukesrapport for hver utøver (null hvis utøveren ikke har sendt noen).',
    inputSchema: { includeArchived },
    annotations: READ_ONLY
  }, (args) => run(() => service.getLatestWeeklyReports(args)));

  server.registerTool('get_weekly_reports', {
    title: 'Ukesrapporter for én utøver',
    description: 'Ukesrapporter for én utøver, nyeste først. Filtrer med from/to (datoer) eller week (ISO-uke, f.eks. 2026-W46).',
    inputSchema: {
      athleteId,
      from: date.optional(),
      to: date.optional(),
      week: z.string().optional().describe('ISO-uke, f.eks. 2026-W46'),
      limit: z.number().int().min(1).max(500).optional().describe('Maks antall rapporter (standard 100)')
    },
    annotations: READ_ONLY
  }, ({ athleteId: id, ...query }) => run(() => service.getWeeklyReports(id, query)));

  server.registerTool('get_weight_history', {
    title: 'Vekthistorikk',
    description: 'Vekt fra ukesrapportene (eldste først), oppsummering og runder med start-/målvekt.',
    inputSchema: { athleteId, from: date.optional(), to: date.optional() },
    annotations: READ_ONLY
  }, ({ athleteId: id, ...query }) => run(() => service.getWeightHistory(id, query)));

  server.registerTool('get_meal_plan', {
    title: 'Hent matplan',
    description: 'Matplanene til en utøver, slik de vises i appen.',
    inputSchema: { athleteId },
    annotations: READ_ONLY
  }, ({ athleteId: id }) => run(() => service.getMealPlan(id)));

  server.registerTool('update_meal_plan', {
    title: 'Oppdater matplan',
    description: `Endrer matplanen til en utøver. Returnerer før/etter og diff. ${PLAN_HELP}`,
    inputSchema: updateShape,
    annotations: WRITE
  }, ({ athleteId: id, mode, dryRun, ...body }) => run(() => service.updateMealPlan(id, mode, body, { key, dryRun })));

  server.registerTool('get_training_program', {
    title: 'Hent treningsprogram',
    description: 'Treningsprogrammene til en utøver, slik de vises i appen.',
    inputSchema: { athleteId },
    annotations: READ_ONLY
  }, ({ athleteId: id }) => run(() => service.getTrainingProgram(id)));

  server.registerTool('update_training_program', {
    title: 'Oppdater treningsprogram',
    description: `Endrer treningsprogrammet til en utøver. Returnerer før/etter og diff. ${PLAN_HELP}`,
    inputSchema: updateShape,
    annotations: WRITE
  }, ({ athleteId: id, mode, dryRun, ...body }) => run(() => service.updateTrainingProgram(id, mode, body, { key, dryRun })));

  return server;
};
