const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('./auth-middleware');

const SALT_ROUNDS = 12;

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
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
      const users = await sql`
        SELECT id, username, name, role, start_date, is_archived
        FROM users
        ORDER BY name ASC
      `;

      // Hent antall uleste innsjekk per bruker
      const unreadCounts = await sql`
        SELECT user_id, COUNT(*) as unread_count
        FROM checkins
        WHERE is_read = false
        GROUP BY user_id
      `;

      // Legg til unread_count på hver bruker
      const usersWithUnread = users.map(user => {
        const unreadData = unreadCounts.find(u => u.user_id === user.id);
        return {
          ...user,
          unreadCheckins: unreadData ? parseInt(unreadData.unread_count) : 0
        };
      });

      return { statusCode: 200, body: JSON.stringify(usersWithUnread) };
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
          body: JSON.stringify({ error: 'Feil ved opprettelse av bruker: ' + postError.message })
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

      // Slett brukerens innsjekker først (pga database-regler)
      await sql`DELETE FROM checkins WHERE user_id = ${id}`;
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