/**
 * Coach API service layer, shared by the REST endpoints (coach-api/http.js)
 * and the MCP tools (mcp/server.mjs). Takes the Neon `sql` tagged-template
 * function, so tests can pass a fake.
 *
 * Privacy: every query lists its columns explicitly. Passwords, tokens, push
 * subscriptions and images (checkins.images/image_url, gallery_images) are
 * never selected.
 */
const { z } = require('zod');
const {
  MAX_PLANS_LENGTH,
  PLAN_TYPES,
  PlanInputError,
  diffPlans,
  parseStoredPlans,
  patchPlans,
  patchPlansSchema,
  replacePlans,
  replacePlansSchema,
  serializeStoredPlans
} = require('./plans');

class CoachApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const validationError = (zodError) => new CoachApiError(400, 'Ugyldig forespørsel', zodError.issues.map((issue) => ({
  path: issue.path.join('.') || '(body)',
  message: issue.message
})));

const parseWith = (schema, input) => {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
};

// --- Shared input schemas ---

const isCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const toDateString = (date) => date.toISOString().slice(0, 10);

/** ISO week "2026-W46" → { from: Monday, to: Sunday }, or null if the week does not exist. */
const isoWeekRange = (week) => {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  if (weekNumber < 1) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNumber - 1) * 7);
  // Week 53 only exists in some years: the Thursday of the week must still be in `year`.
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  if (thursday.getUTCFullYear() !== year) return null;
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toDateString(monday), to: toDateString(sunday) };
};

const dateSchema = z.string().refine(isCalendarDate, 'Må være en gyldig dato (ÅÅÅÅ-MM-DD)');
const weekSchema = z.string().refine((value) => isoWeekRange(value) !== null, 'Må være en ISO-uke (f.eks. 2026-W46)');
const athleteIdSchema = z.coerce.number().int().positive('Ugyldig utøver-ID');
const booleanFlag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const periodSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  week: weekSchema.optional()
}).refine((input) => !(input.week && (input.from || input.to)), 'Bruk enten "week" eller "from"/"to"')
  .refine((input) => !(input.from && input.to && input.from > input.to), '"from" kan ikke være etter "to"');

const listSchema = z.object({ includeArchived: booleanFlag.optional() });
const reportsSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  week: weekSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const resolvePeriod = (input) => {
  parseWith(periodSchema, input);
  if (input.week) return isoWeekRange(input.week);
  return { from: input.from || null, to: input.to || null };
};

// --- Formatting ---

const toNumber = (value) => (value === null || value === undefined || value === '' ? null : Number(value));
const toIso = (value) => (value ? new Date(value).toISOString() : null);

const formatReport = (row) => ({
  id: Number(row.id),
  athleteId: Number(row.user_id),
  date: row.date,
  weight: toNumber(row.weight),
  sleep: toNumber(row.sleep),
  energy: toNumber(row.energy),
  accuracy: toNumber(row.accuracy),
  strengthSessions: toNumber(row.strength_sessions),
  cardioSessions: toNumber(row.cardio_sessions),
  stepsReached: Boolean(row.steps_reached),
  takenSupplements: Boolean(row.taken_supplements),
  comment: row.comment || '',
  periodId: row.period_id === null || row.period_id === undefined ? null : Number(row.period_id),
  isRead: Boolean(row.is_read),
  submittedAt: toIso(row.created_at)
});

const formatAthlete = (row) => ({
  id: Number(row.id),
  name: row.name,
  username: row.username,
  isArchived: Boolean(row.is_archived),
  isPaused: Boolean(row.is_paused),
  startDate: toIso(row.start_date),
  totalWeeks: toNumber(row.total_weeks) ?? 12,
  stepGoal: toNumber(row.step_goal) ?? 10000,
  startingWeight: toNumber(row.starting_weight),
  currentPeriodId: row.current_period_id === null || row.current_period_id === undefined ? null : Number(row.current_period_id),
  lastActiveAt: toIso(row.last_active_at),
  lastReportDate: row.last_report_date || null,
  unreadReports: Number(row.unread_reports || 0)
});

const PLAN_ACTIONS = {
  diet: { replace: 'meal_plan.replace', patch: 'meal_plan.patch' },
  workout: { replace: 'training_program.replace', patch: 'training_program.patch' }
};

const createCoachService = (sql) => {
  // Same rule as users.js: the App Review demo account is not a real client.
  const getAthlete = async (athleteIdInput) => {
    const athleteId = parseWith(athleteIdSchema, athleteIdInput);
    const rows = await sql`
      SELECT id, name, is_archived
      FROM users
      WHERE id = ${athleteId} AND role = 'athlete' AND LOWER(username) <> 'apple_review'
      LIMIT 1
    `;
    if (!rows[0]) throw new CoachApiError(404, 'Fant ingen utøver med denne ID-en');
    return { id: Number(rows[0].id), name: rows[0].name, isArchived: Boolean(rows[0].is_archived) };
  };

  const listAthletes = async (input = {}) => {
    const { includeArchived = false } = parseWith(listSchema, input);
    const rows = await sql`
      SELECT
        u.id, u.name, u.username, u.is_archived, u.is_paused, u.start_date, u.total_weeks,
        u.step_goal, u.starting_weight, u.current_period_id, u.last_active_at,
        COALESCE(unread.cnt, 0)::integer AS unread_reports,
        latest.last_date AS last_report_date
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS cnt FROM checkins WHERE is_read = false GROUP BY user_id
      ) unread ON unread.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT LEFT(c.date::text, 10) AS last_date
        FROM checkins c WHERE c.user_id = u.id
        ORDER BY c.created_at DESC LIMIT 1
      ) latest ON true
      WHERE u.role = 'athlete'
        AND LOWER(u.username) <> 'apple_review'
        AND (${includeArchived} OR COALESCE(u.is_archived, false) = false)
      ORDER BY u.name ASC
    `;
    return { athletes: rows.map(formatAthlete) };
  };

  const getLatestWeeklyReports = async (input = {}) => {
    const { includeArchived = false } = parseWith(listSchema, input);
    const rows = await sql`
      SELECT
        u.id AS athlete_id, u.name AS athlete_name, u.is_archived AS athlete_is_archived,
        r.id, r.user_id, r.date, r.weight, r.sleep, r.energy, r.accuracy,
        r.strength_sessions, r.cardio_sessions, r.steps_reached, r.taken_supplements,
        r.comment, r.period_id, r.is_read, r.created_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT c.id, c.user_id, LEFT(c.date::text, 10) AS date, c.weight, c.sleep, c.energy, c.accuracy,
               c.strength_sessions, c.cardio_sessions, c.steps_reached, c.taken_supplements,
               c.comment, c.period_id, c.is_read, c.created_at
        FROM checkins c WHERE c.user_id = u.id
        ORDER BY c.created_at DESC LIMIT 1
      ) r ON true
      WHERE u.role = 'athlete'
        AND LOWER(u.username) <> 'apple_review'
        AND (${includeArchived} OR COALESCE(u.is_archived, false) = false)
      ORDER BY u.name ASC
    `;
    return {
      athletes: rows.map((row) => ({
        athleteId: Number(row.athlete_id),
        athleteName: row.athlete_name,
        isArchived: Boolean(row.athlete_is_archived),
        latestReport: row.id === null || row.id === undefined ? null : formatReport(row)
      }))
    };
  };

  const getWeeklyReports = async (athleteIdInput, input = {}) => {
    const athlete = await getAthlete(athleteIdInput);
    const query = parseWith(reportsSchema, input);
    const { from, to } = resolvePeriod(query);
    const limit = query.limit || 100;
    const rows = await sql`
      SELECT id, user_id, LEFT(date::text, 10) AS date, weight, sleep, energy, accuracy,
             strength_sessions, cardio_sessions, steps_reached, taken_supplements,
             comment, period_id, is_read, created_at
      FROM checkins
      WHERE user_id = ${athlete.id}
        AND (${from}::text IS NULL OR LEFT(date::text, 10) >= ${from})
        AND (${to}::text IS NULL OR LEFT(date::text, 10) <= ${to})
      ORDER BY date DESC, created_at DESC
      LIMIT ${limit}
    `;
    return {
      athlete,
      period: { from, to, ...(query.week ? { week: query.week } : {}) },
      reports: rows.map(formatReport)
    };
  };

  const getWeightHistory = async (athleteIdInput, input = {}) => {
    const athlete = await getAthlete(athleteIdInput);
    const { from, to } = resolvePeriod(parseWith(reportsSchema.omit({ limit: true }), input));
    const [entries, periods, userRows] = await Promise.all([
      sql`
        SELECT id, LEFT(date::text, 10) AS date, weight, period_id
        FROM checkins
        WHERE user_id = ${athlete.id} AND weight IS NOT NULL
          AND (${from}::text IS NULL OR LEFT(date::text, 10) >= ${from})
          AND (${to}::text IS NULL OR LEFT(date::text, 10) <= ${to})
        ORDER BY date ASC, created_at ASC
      `,
      sql`
        SELECT id, name, start_date, end_date, starting_weight, goal_weight, is_active
        FROM coaching_periods
        WHERE user_id = ${athlete.id}
        ORDER BY start_date DESC
      `,
      sql`SELECT starting_weight, current_period_id FROM users WHERE id = ${athlete.id}`
    ]);
    const history = entries.map((row) => ({
      date: row.date,
      weight: toNumber(row.weight),
      reportId: Number(row.id),
      periodId: row.period_id === null || row.period_id === undefined ? null : Number(row.period_id)
    }));
    const first = history[0];
    const latest = history[history.length - 1];
    return {
      athlete,
      period: { from, to },
      startingWeight: toNumber(userRows[0]?.starting_weight),
      currentPeriodId: userRows[0]?.current_period_id ? Number(userRows[0].current_period_id) : null,
      summary: first ? {
        first: first.weight,
        latest: latest.weight,
        change: Math.round((latest.weight - first.weight) * 10) / 10,
        entries: history.length
      } : null,
      entries: history,
      periods: periods.map((row) => ({
        id: Number(row.id),
        name: row.name,
        startDate: toIso(row.start_date),
        endDate: toIso(row.end_date),
        startingWeight: toNumber(row.starting_weight),
        goalWeight: toNumber(row.goal_weight),
        isActive: Boolean(row.is_active)
      }))
    };
  };

  // Column names cannot be parameters, so each plan type has its own queries.
  const readPlanRaw = async (type, athleteId) => {
    const rows = type === 'diet'
      ? await sql`SELECT diet_plan AS raw FROM users WHERE id = ${athleteId}`
      : await sql`SELECT workout_plan AS raw FROM users WHERE id = ${athleteId}`;
    return rows[0]?.raw ?? null;
  };

  const writePlanWithAudit = (type, { athleteId, before, after, key, action }) => {
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    // One statement: the update and its audit row are committed together. The
    // WHERE on the old value makes a concurrent change fail instead of being overwritten.
    return type === 'diet'
      ? sql`
        WITH updated AS (
          UPDATE users SET diet_plan = ${after}
          WHERE id = ${athleteId} AND role = 'athlete' AND COALESCE(is_archived, false) = false
            AND diet_plan IS NOT DISTINCT FROM ${before}
          RETURNING id
        )
        INSERT INTO coach_api_audit_log (key_id, key_name, action, athlete_id, before_value, after_value)
        SELECT ${key.id}, ${key.name}, ${action}, id, ${beforeJson}::jsonb, ${afterJson}::jsonb FROM updated
        RETURNING id, created_at
      `
      : sql`
        WITH updated AS (
          UPDATE users SET workout_plan = ${after}
          WHERE id = ${athleteId} AND role = 'athlete' AND COALESCE(is_archived, false) = false
            AND workout_plan IS NOT DISTINCT FROM ${before}
          RETURNING id
        )
        INSERT INTO coach_api_audit_log (key_id, key_name, action, athlete_id, before_value, after_value)
        SELECT ${key.id}, ${key.name}, ${action}, id, ${beforeJson}::jsonb, ${afterJson}::jsonb FROM updated
        RETURNING id, created_at
      `;
  };

  const getPlans = async (type, athleteIdInput) => {
    const athlete = await getAthlete(athleteIdInput);
    const raw = await readPlanRaw(type, athlete.id);
    return { athlete, ...parseStoredPlans(raw, type) };
  };

  /**
   * mode 'replace' (PUT) or 'patch' (PATCH). With dryRun nothing is written:
   * the response shows before/after/diff only.
   */
  const updatePlans = async (type, athleteIdInput, mode, input, { key, dryRun: forceDryRun = false } = {}) => {
    if (!key) throw new CoachApiError(401, 'Mangler API-nøkkel');
    const body = parseWith(mode === 'replace' ? replacePlansSchema : patchPlansSchema, input);
    const dryRun = Boolean(forceDryRun || body.dryRun);
    const athlete = await getAthlete(athleteIdInput);
    if (athlete.isArchived) throw new CoachApiError(409, 'Utøveren er arkivert og kan ikke endres');

    const beforeRaw = await readPlanRaw(type, athlete.id);
    const before = parseStoredPlans(beforeRaw, type);
    let afterPlans;
    try {
      afterPlans = mode === 'replace' ? replacePlans(before.plans, body) : patchPlans(before.plans, body);
    } catch (error) {
      if (error instanceof PlanInputError) throw new CoachApiError(400, error.message);
      throw error;
    }
    const afterRaw = serializeStoredPlans(afterPlans, type);
    if (afterRaw.length > MAX_PLANS_LENGTH) {
      throw new CoachApiError(400, `Planene er for lange (maks ${MAX_PLANS_LENGTH.toLocaleString('nb-NO')} tegn lagret)`);
    }
    const after = parseStoredPlans(afterRaw, type);
    const changed = afterRaw !== (beforeRaw ?? '');
    const result = {
      athlete,
      dryRun,
      changed,
      saved: false,
      before: { plans: before.plans },
      after: { plans: after.plans },
      diff: diffPlans(before.plans, after.plans)
    };
    if (dryRun || !changed) return result;

    const rows = await writePlanWithAudit(type, {
      athleteId: athlete.id,
      before: beforeRaw,
      after: afterRaw,
      key,
      action: PLAN_ACTIONS[type][mode]
    });
    if (!rows[0]) {
      throw new CoachApiError(409, 'Planen ble endret samtidig (eller utøveren ble arkivert). Hent planen på nytt og prøv igjen.');
    }
    return { ...result, saved: true, auditId: Number(rows[0].id) };
  };

  return {
    listAthletes,
    getLatestWeeklyReports,
    getWeeklyReports,
    getWeightHistory,
    getMealPlan: (athleteId) => getPlans('diet', athleteId),
    getTrainingProgram: (athleteId) => getPlans('workout', athleteId),
    updateMealPlan: (athleteId, mode, input, options) => updatePlans('diet', athleteId, mode, input, options),
    updateTrainingProgram: (athleteId, mode, input, options) => updatePlans('workout', athleteId, mode, input, options)
  };
};

module.exports = {
  CoachApiError,
  PLAN_TYPES,
  createCoachService,
  isoWeekRange
};
