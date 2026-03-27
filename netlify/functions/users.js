const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('./auth-middleware');

const SALT_ROUNDS = 12;

// Sjekk at database-URL er satt
if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

// Gjenbruk SQL-tilkobling mellom warm invocations
const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Felles query for å hente formatert brukerliste — én query uten korrelert subquery
const getFormattedUsersList = () => sql`
  SELECT
    u.id, u.username, u.name, u.role, u.start_date, u.is_archived,
    COALESCE(unread.cnt, 0)::integer as "unreadCheckins",
    latest.last_date as "lastCheckinDate"
  FROM users u
  LEFT JOIN (
    SELECT user_id, COUNT(*) as cnt
    FROM checkins
    WHERE is_read = false
    GROUP BY user_id
  ) unread ON unread.user_id = u.id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id)
      user_id, LEFT(date::text, 10) as last_date
    FROM checkins
    ORDER BY user_id, created_at DESC
  ) latest ON latest.user_id = u.id
  ORDER BY u.name ASC
`;

// Enkel input-validering
const validateUserInput = (name, username, password) => {
  const errors = [];
  
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Navn må være minst 2 tegn');
  }
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push('Brukernavn må være minst 3 tegn');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Brukernavn kan kun inneholde bokstaver, tall og understrek');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Passord må være minst 6 tegn');
  }
  
  return errors;
};

exports.handler = async (event) => {
  // Verifiser autentisering
  const authResult = requireAuth(event);
  if (!authResult.success) {
    return { statusCode: authResult.statusCode, body: authResult.body };
  }

  // Kun coaches kan administrere brukere
  if (authResult.role !== 'coach') {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Du har ikke tilgang til denne funksjonen.' })
    };
  }

  try {
    // HENTE BRUKERE (GET)
    if (event.httpMethod === 'GET') {
      const usersWithUnread = await getFormattedUsersList();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        },
        body: JSON.stringify(usersWithUnread)
      };
    }

    // LAGE NY BRUKER (POST)
    if (event.httpMethod === 'POST') {
      try {
        let parsed;
        try {
          parsed = JSON.parse(event.body || '');
        } catch (e) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
        }
        const { name, username, password, role } = parsed;

        console.log('Users POST: Oppretter ny bruker:', { name, username, role });

        // Valider input
        const validationErrors = validateUserInput(name, username, password);
        if (validationErrors.length > 0) {
          console.error('Users POST: Valideringsfeil:', validationErrors);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: validationErrors.join(', ') })
          };
        }

        const normalizedUsername = username.trim().toLowerCase();

        // Sjekk om brukernavn allerede finnes
        const existing = await sql`
          SELECT id FROM users WHERE username = ${normalizedUsername} LIMIT 1
        `;
        if (existing.length > 0) {
          console.error('Users POST: Brukernavn allerede i bruk:', normalizedUsername);
          return {
            statusCode: 409,
            body: JSON.stringify({ error: 'Brukernavnet er allerede i bruk' })
          };
        }

        // Hash passordet før lagring
        console.log('Users POST: Hasher passord...');
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Valider rolle - kun 'coach' eller 'athlete' er gyldige
        const validRole = ['coach', 'athlete'].includes(role) ? role : 'athlete';

        console.log('Users POST: Setter inn ny bruker i database...');
        await sql`
          INSERT INTO users (name, username, password, role)
          VALUES (${name.trim()}, ${normalizedUsername}, ${hashedPassword}, ${validRole})
        `;

        console.log('Users POST: Bruker opprettet suksessfullt');

        const allUsers = await getFormattedUsersList();
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allUsers) };
      } catch (postError) {
        console.error('Users POST: Feil ved opprettelse av bruker:', postError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Feil ved opprettelse av bruker' })
        };
      }
    }

    // OPPDATERE BRUKER (PATCH) - For arkivering etc.
    if (event.httpMethod === 'PATCH') {
      let parsed;
      try {
        parsed = JSON.parse(event.body || '');
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
      }
      const { id, is_archived } = parsed;

      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      // Hindre at coach endrer andre coaches
      const targetUser = await sql`SELECT role FROM users WHERE id = ${id}`;
      if (targetUser.length > 0 && targetUser[0].role === 'coach') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Kan ikke endre en annen coach' }) };
      }

      if (typeof is_archived === 'boolean') {
        await sql`UPDATE users SET is_archived = ${is_archived} WHERE id = ${id}`;
      }

      const allUsers = await getFormattedUsersList();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allUsers) };
    }

    // SLETTE BRUKER (DELETE)
    if (event.httpMethod === 'DELETE') {
      let parsed;
      try {
        parsed = JSON.parse(event.body || '');
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
      }
      const { id } = parsed;

      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      // Hindre at coach sletter seg selv
      if (parseInt(id, 10) === parseInt(authResult.userId, 10)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Du kan ikke slette din egen bruker' }) };
      }

      // Hindre at coach sletter andre coaches
      const targetUser = await sql`SELECT role FROM users WHERE id = ${id}`;
      if (targetUser.length > 0 && targetUser[0].role === 'coach') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Kan ikke slette en annen coach' }) };
      }

      // Slett brukerens relaterte data først (pga database-regler)
      await Promise.all([
        sql`DELETE FROM checkins WHERE user_id = ${id}`,
        sql`DELETE FROM coaching_periods WHERE user_id = ${id}`,
        sql`DELETE FROM gallery_images WHERE user_id = ${id}`
      ]);
      await sql`DELETE FROM users WHERE id = ${id}`;
      
      const allUsers = await getFormattedUsersList();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allUsers) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Metode ikke tillatt' }) };

  } catch (error) {
    console.error('Users error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil' }) };
  }
};