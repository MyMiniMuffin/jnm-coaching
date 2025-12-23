const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

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
  
  try {
    // HENTE BRUKERE (GET)
    if (event.httpMethod === 'GET') {
      const users = await sql`
        SELECT id, username, name, role, start_date, is_archived 
        FROM users 
        ORDER BY name ASC
      `;
      return { statusCode: 200, body: JSON.stringify(users) };
    }

    // LAGE NY BRUKER (POST)
    if (event.httpMethod === 'POST') {
      const { name, username, password, role } = JSON.parse(event.body);
      
      // Valider input
      const validationErrors = validateUserInput(name, username, password);
      if (validationErrors.length > 0) {
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
        return { 
          statusCode: 409, 
          body: JSON.stringify({ error: 'Brukernavnet er allerede i bruk' }) 
        };
      }

      // Hash passordet før lagring
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      
      await sql`
        INSERT INTO users (name, username, password, role)
        VALUES (${name.trim()}, ${normalizedUsername}, ${hashedPassword}, ${role || 'athlete'})
      `;
      
      const allUsers = await sql`
        SELECT id, username, name, role, start_date, is_archived 
        FROM users 
        ORDER BY name ASC
      `;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
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