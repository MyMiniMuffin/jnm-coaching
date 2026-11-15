/**
 * REST endpoints under /api/coach/v1, authenticated with a coach API key
 * (`Authorization: Bearer jnmc_...`). server.mjs calls handle() for every
 * request under BASE_PATH; tests call it directly with a fake `sql`.
 */
const { authenticateCoachKey } = require('./keys');
const { createRateLimiter } = require('./rate-limit');
const { CoachApiError, createCoachService } = require('./service');

const BASE_PATH = '/api/coach/v1';
const MAX_BODY_BYTES = 1024 * 1024;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

const respond = (statusCode, payload, headers = {}) => ({
  statusCode,
  headers: { ...JSON_HEADERS, ...headers },
  body: JSON.stringify(payload)
});

const errorResponse = (error) => {
  if (error instanceof CoachApiError) {
    return respond(error.statusCode, { error: error.message, ...(error.details ? { details: error.details } : {}) });
  }
  // Never log request headers or bodies: they can contain the key.
  console.error('Coach API error:', error?.message || error);
  return respond(500, { error: 'Intern feil' });
};

// Writes fail closed: only these query parameters are accepted on PUT/PATCH, so a
// misspelled "?dryrun=true" is rejected instead of silently becoming a real write.
const WRITE_QUERY_PARAMS = new Set(['dryRun']);
const QUERY_FLAGS = { true: true, 1: true, false: false, 0: false };

/** Strict parse of the dryRun query value: true/false/1/0, anything else is 400. */
const parseWriteQuery = (query) => {
  const unknown = Object.keys(query).filter((name) => !WRITE_QUERY_PARAMS.has(name));
  if (unknown.length) {
    throw new CoachApiError(400, 'Ukjent query-parameter', unknown.map((name) => ({
      path: name,
      message: 'Ikke støttet her (bare "dryRun" er tillatt)'
    })));
  }
  if (query.dryRun === undefined) return { dryRun: false };
  const value = query.dryRun;
  if (typeof value !== 'string' || !Object.hasOwn(QUERY_FLAGS, value)) {
    throw new CoachApiError(400, 'Ugyldig dryRun', [{ path: 'dryRun', message: 'Må være true, false, 1 eller 0' }]);
  }
  return { dryRun: QUERY_FLAGS[value] };
};

/**
 * Auth + rate limits shared by REST and MCP.
 * - failed authentications: per client IP (slows down key guessing)
 * - requests: per API key
 */
const createCoachGateway = ({
  sql,
  requestsPerMinute = 120,
  failedAuthPer10Min = 30
} = {}) => {
  const isKeyLimited = createRateLimiter(requestsPerMinute, 60_000);
  const isFailureLimited = createRateLimiter(failedAuthPer10Min, 600_000);
  const service = createCoachService(sql);

  /** Returns { ok: true, key } or { ok: false, response }. */
  const authorize = async ({ headers = {}, ip = 'unknown' }) => {
    const authorization = headers.authorization ?? headers.Authorization;
    const auth = await authenticateCoachKey(sql, authorization);
    if (!auth.ok) {
      if (isFailureLimited(ip)) {
        return { ok: false, response: respond(429, { error: 'For mange mislykkede forsøk. Vent litt og prøv igjen.' }, { 'Retry-After': '600' }) };
      }
      const challenge = auth.statusCode === 401 ? { 'WWW-Authenticate': 'Bearer realm="jnm-coach"' } : {};
      return { ok: false, response: respond(auth.statusCode, { error: auth.error }, challenge) };
    }
    if (isKeyLimited(`key:${auth.key.id}`)) {
      return { ok: false, response: respond(429, { error: 'For mange forespørsler. Vent litt og prøv igjen.' }, { 'Retry-After': '60' }) };
    }
    return { ok: true, key: auth.key };
  };

  const parseBody = (body) => {
    if (body === null || body === undefined || body === '') return {};
    const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new CoachApiError(413, 'Forespørselen er for stor');
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
      return data;
    } catch {
      throw new CoachApiError(400, 'Ugyldig JSON i request body (må være et JSON-objekt)');
    }
  };

  const PLAN_ROUTES = {
    'meal-plan': { get: service.getMealPlan, update: service.updateMealPlan },
    'training-program': { get: service.getTrainingProgram, update: service.updateTrainingProgram }
  };

  const route = async ({ method, path, query, body, key }) => {
    const subPath = path.slice(BASE_PATH.length).replace(/\/+$/, '') || '/';
    const allow = (methods) => {
      if (!methods.includes(method)) {
        throw Object.assign(new CoachApiError(405, 'Metode ikke tillatt'), { allow: methods.join(', ') });
      }
    };

    if (subPath === '/me') {
      allow(['GET']);
      return { key: { name: key.name, prefix: key.prefix, scope: key.scope } };
    }
    if (subPath === '/athletes') {
      allow(['GET']);
      return service.listAthletes(query);
    }
    if (subPath === '/reports/latest') {
      allow(['GET']);
      return service.getLatestWeeklyReports(query);
    }

    const athleteRoute = /^\/athletes\/([^/]+)\/(reports|weight|meal-plan|training-program)$/.exec(subPath);
    if (!athleteRoute) throw new CoachApiError(404, 'Ukjent endepunkt');
    const [, athleteId, resource] = athleteRoute;

    if (resource === 'reports') {
      allow(['GET']);
      return service.getWeeklyReports(athleteId, query);
    }
    if (resource === 'weight') {
      allow(['GET']);
      return service.getWeightHistory(athleteId, query);
    }
    const plan = PLAN_ROUTES[resource];
    allow(['GET', 'PUT', 'PATCH']);
    if (method === 'GET') return plan.get(athleteId);
    const mode = method === 'PUT' ? 'replace' : 'patch';
    const { dryRun } = parseWriteQuery(query);
    return plan.update(athleteId, mode, parseBody(body), { key, dryRun });
  };

  /** request: { method, path, query, headers, body, ip } → { statusCode, headers, body } */
  const handle = async (request) => {
    try {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const payload = await route({
        method: request.method,
        path: request.path,
        query: request.query || {},
        body: request.body,
        key: auth.key
      });
      return respond(200, payload);
    } catch (error) {
      if (error?.allow) return respond(405, { error: error.message }, { Allow: error.allow });
      return errorResponse(error);
    }
  };

  return { authorize, handle, service };
};

module.exports = { BASE_PATH, MAX_BODY_BYTES, createCoachGateway };
