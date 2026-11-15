/**
 * In-memory stand-in for the Neon `sql` tagged template, for the coach API/MCP tests.
 * Rows deliberately include sensitive columns (password, images, image_url) so the
 * tests can prove the API never passes them on.
 */
const { generateKey } = require('../../coach-api/keys');

const createFakeDb = () => {
  const valid = generateKey();
  const revoked = generateKey();
  const wrongScope = generateKey();
  const plainAthleteOwner = generateKey();

  const state = {
    keys: [
      { id: 1, prefix: valid.prefix, key_hash: valid.hash, name: 'grok', scope: 'coach', revoked_at: null, coach_user_id: 1 },
      { id: 2, prefix: revoked.prefix, key_hash: revoked.hash, name: 'old', scope: 'coach', revoked_at: '2026-11-01T00:00:00Z', coach_user_id: 1 },
      { id: 3, prefix: wrongScope.prefix, key_hash: wrongScope.hash, name: 'reader', scope: 'read-only', revoked_at: null, coach_user_id: 1 },
      { id: 4, prefix: plainAthleteOwner.prefix, key_hash: plainAthleteOwner.hash, name: 'athlete-key', scope: 'coach', revoked_at: null, coach_user_id: 5 }
    ],
    users: {
      1: { id: 1, name: 'Coach', username: 'coach', role: 'coach', password: '$2a$12$coachhash', is_archived: false },
      5: {
        id: 5, name: 'Ada Utøver', username: 'ada', role: 'athlete', password: '$2a$12$secrethash',
        is_archived: false, is_paused: false, start_date: '2026-09-01T00:00:00Z', total_weeks: 12, step_goal: 9000,
        starting_weight: '82.0', current_period_id: 7, last_active_at: '2026-11-14T10:00:00Z',
        diet_plan: 'Frokost: havregryn\nLunsj: kylling', workout_plan: ''
      },
      6: {
        id: 6, name: 'Bo Arkivert', username: 'bo', role: 'athlete', password: '$2a$12$x', is_archived: true,
        diet_plan: '', workout_plan: ''
      }
    },
    checkins: [
      {
        id: 101, user_id: 5, date: '2026-11-02', weight: '81.4', sleep: 7, energy: 8, accuracy: 9,
        strength_sessions: 3, cardio_sessions: 2, steps_reached: true, taken_supplements: true,
        comment: 'Bra uke', period_id: 7, is_read: true, created_at: '2026-11-02T18:00:00Z',
        images: '["https://res.cloudinary.com/demo/image/upload/a.jpg"]', image_url: 'https://res.cloudinary.com/demo/b.jpg'
      },
      {
        id: 102, user_id: 5, date: '2026-11-09', weight: '80.9', sleep: 6, energy: 7, accuracy: 8,
        strength_sessions: 4, cardio_sessions: 1, steps_reached: false, taken_supplements: true,
        comment: 'Litt sliten', period_id: 7, is_read: false, created_at: '2026-11-09T18:00:00Z',
        images: '["https://res.cloudinary.com/demo/image/upload/c.jpg"]', image_url: null
      }
    ],
    periods: [
      { id: 7, user_id: 5, name: 'Runde 1', start_date: '2026-09-01T00:00:00Z', end_date: null, starting_weight: '82.0', goal_weight: '78.0', is_active: true, notes: 'privat notat' }
    ],
    audit: [],
    queries: [],
    planWrites: 0
  };

  const sql = async (strings, ...values) => {
    const text = strings.join('$');
    state.queries.push({ text, values });

    if (text.includes('FROM coach_api_keys k') && text.includes('k.prefix =')) {
      const key = state.keys.find((row) => row.prefix === values[0]);
      return key ? [{ ...key, coach_role: state.users[key.coach_user_id]?.role }] : [];
    }
    if (text.includes('UPDATE coach_api_keys SET last_used_at')) return [];

    if (text.includes("role = 'athlete' AND LOWER(username) <> 'apple_review'")) {
      const user = state.users[values[0]];
      return user && user.role === 'athlete' ? [{ ...user }] : [];
    }
    if (text.includes('diet_plan AS raw')) return [{ raw: state.users[values[0]]?.diet_plan ?? null }];
    if (text.includes('workout_plan AS raw')) return [{ raw: state.users[values[0]]?.workout_plan ?? null }];

    if (text.includes('WITH updated AS')) {
      const column = text.includes('UPDATE users SET diet_plan') ? 'diet_plan' : 'workout_plan';
      const [after, athleteId, before, keyId, keyName, action, beforeJson, afterJson] = values;
      const user = state.users[athleteId];
      if (!user || user.role !== 'athlete' || user.is_archived || (user[column] ?? null) !== before) return [];
      user[column] = after;
      state.planWrites += 1;
      const row = {
        id: state.audit.length + 1, key_id: keyId, key_name: keyName, action, athlete_id: athleteId,
        before_value: JSON.parse(beforeJson), after_value: JSON.parse(afterJson), created_at: new Date().toISOString()
      };
      state.audit.push(row);
      return [{ id: row.id, created_at: row.created_at }];
    }

    if (text.includes('u.id AS athlete_id')) {
      return Object.values(state.users)
        .filter((user) => user.role === 'athlete' && (values[0] || !user.is_archived))
        .map((user) => {
          const latest = state.checkins.filter((c) => c.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return { ...user, ...(latest || { id: null }), athlete_id: user.id, athlete_name: user.name, athlete_is_archived: user.is_archived };
        });
    }
    if (text.includes('FROM users u')) {
      return Object.values(state.users)
        .filter((user) => user.role === 'athlete' && (values[0] || !user.is_archived))
        .map((user) => ({ ...user, unread_reports: 1, last_report_date: '2026-11-09' }));
    }
    if (text.includes('weight IS NOT NULL')) {
      const [userId, from, , to] = values;
      return state.checkins
        .filter((c) => c.user_id === userId && (!from || c.date >= from) && (!to || c.date <= to))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    if (text.includes('FROM checkins')) {
      const [userId, from, , to, , limit] = values;
      return state.checkins
        .filter((c) => c.user_id === userId && (!from || c.date >= from) && (!to || c.date <= to))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);
    }
    if (text.includes('FROM coaching_periods')) return state.periods.filter((p) => p.user_id === values[0]);
    if (text.includes('SELECT starting_weight, current_period_id')) return [{ ...state.users[values[0]] }];

    throw new Error(`Unexpected query: ${text}`);
  };

  return {
    sql,
    state,
    keys: { valid: valid.key, revoked: revoked.key, wrongScope: wrongScope.key, athleteOwned: plainAthleteOwner.key }
  };
};

module.exports = { createFakeDb };
