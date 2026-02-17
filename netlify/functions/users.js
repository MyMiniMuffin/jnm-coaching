const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('./auth-middleware');

const SALT_ROUNDS = 12;

// Gjenbruk SQL-tilkobling mellom warm invocations
const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
      // Én enkelt query med LEFT JOIN i stedet for 2 queries + O(n²) loop
      const usersWithUnread = await sql`
        SELECT
          u.id,
          u.username,
          u.name,
          u.role,
          u.start_date,
          u.is_archived,
          COALESCE(COUNT(c.id) FILTER (WHERE c.is_read = false), 0)::integer as "unreadCheckins",
          MAX(c.date) as "lastCheckinDate"
        FROM users u
        LEFT JOIN checkins c ON c.user_id = u.id
        GROUP BY u.id, u.username, u.name, u.role, u.start_date, u.is_archived
        ORDER BY u.name ASC
      `;

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
        const { name, username, password, role } = JSON.parse(event.body);

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

        console.log('Users POST: Setter inn ny bruker i database...');
        await sql`
          INSERT INTO users (name, username, password, role)
          VALUES (${name.trim()}, ${normalizedUsername}, ${hashedPassword}, ${role || 'athlete'})
        `;

        console.log('Users POST: Bruker opprettet suksessfullt');

        const allUsers = await sql`
          SELECT id, username, name, role, start_date, is_archived
          FROM users
          ORDER BY name ASC
        `;
        return { statusCode: 200, body: JSON.stringify(allUsers) };
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
      const { id, is_archived } = JSON.parse(event.body);
      
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      if (typeof is_archived === 'boolean') {
        await sql`UPDATE users SET is_archived = ${is_archived} WHERE id = ${id}`;
      }

      const allUsers = await sql`
        SELECT id, username, name, role, start_date, is_archived 
        FROM users 
        ORDER BY name ASC
      `;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
    }

    // SLETTE BRUKER (DELETE)
    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body);
      
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      // Slett brukerens relaterte data først (pga database-regler)
      await Promise.all([
        sql`DELETE FROM checkins WHERE user_id = ${id}`,
        sql`DELETE FROM coaching_periods WHERE user_id = ${id}`,
        sql`DELETE FROM gallery_images WHERE user_id = ${id}`
      ]);
      await sql`DELETE FROM users WHERE id = ${id}`;
      
      const allUsers = await sql`
        SELECT id, username, name, role, start_date, is_archived 
        FROM users 
        ORDER BY name ASC
      `;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (error) {
    console.error('Users error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil' }) };
  }
};