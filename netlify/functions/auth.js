const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET miljøvariabel er ikke satt');
}
const JWT_EXPIRES_IN = '30d';

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

    // Verifiser at passord er hashet (bcrypt-hasher starter med $2a$ eller $2b$)
    if (!storedPassword || !storedPassword.startsWith('$2')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Vennligst kontakt administrator for passord-reset' })
      };
    }

    // Sammenlign med bcrypt
    const isValidPassword = await bcrypt.compare(password, storedPassword);

    if (!isValidPassword) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Feil brukernavn eller passord' })
      };
    }

    // Generer JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Returner brukerinfo og token (UTEN passord)
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        token
      }),
    };

  } catch (error) {
    console.error('Login error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil under innlogging' }) };
  }
};