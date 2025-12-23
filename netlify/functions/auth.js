const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const { username, password } = JSON.parse(event.body);

    // Validering av input
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Ugyldig input' }) 
      };
    }

    // Hent bruker (inkludert passord for sammenligning)
    const result = await sql`
      SELECT id, username, name, role, password 
      FROM users 
      WHERE username = ${username.trim().toLowerCase()}
      LIMIT 1
    `;

    if (result.length === 0) {
      // Timing-safe: Kjør en dummy bcrypt-sammenligning for å unngå timing attacks
      await bcrypt.compare(password, '$2a$12$000000000000000000000000000000000000000000000000000000');
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Feil brukernavn eller passord' }) 
      };
    }

    const user = result[0];
    const storedPassword = user.password;
    let isValidPassword = false;

    // Sjekk om passordet er hashet (bcrypt-hasher starter med $2a$ eller $2b$)
    const isHashed = storedPassword && storedPassword.startsWith('$2');

    if (isHashed) {
      // Nytt system: Sammenlign med bcrypt
      isValidPassword = await bcrypt.compare(password, storedPassword);
    } else {
      // Gammelt system: Klartekst-sammenligning (for eksisterende brukere)
      isValidPassword = storedPassword === password;

      // MIGRERING: Hvis klartekst-passord stemmer, oppgrader til hash
      if (isValidPassword) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;
        console.log(`Migrerte passord for bruker: ${user.username}`);
      }
    }

    if (!isValidPassword) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Feil brukernavn eller passord' }) 
      };
    }

    // Returner brukerinfo (UTEN passord)
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }),
    };

  } catch (error) {
    console.error('Login error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil under innlogging' }) };
  }
};