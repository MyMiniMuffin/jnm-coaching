const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;

// In-memory rate limiting (per serverless instance)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutter
const MAX_ATTEMPTS = 10; // maks forsøk per vindu

const checkRateLimit = (key) => {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
};

// Rydd opp gamle entries periodisk
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) loginAttempts.delete(key);
  }
}, 5 * 60 * 1000);

// Sjekk at database-URL er satt
if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

// Gjenbruk SQL-tilkobling mellom warm invocations
const sql = neon(process.env.NETLIFY_DATABASE_URL);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET miljøvariabel er ikke satt');
}
const JWT_EXPIRES_IN = '30d';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metode ikke tillatt' }) };
  }

  try {
    // Rate limiting basert på IP
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || event.headers['client-ip'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'For mange innloggingsforsøk. Prøv igjen om noen minutter.' })
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(event.body || '');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
    }
    const { username, password } = parsed;

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
      await bcrypt.compare(password, '$2b$12$LJ3m4ys3Lf5BAoSMTGCOfu0YBhlNpEYKnbBbGFN0vBcPRnSQljV3e');
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
      headers: { 'Content-Type': 'application/json' },
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