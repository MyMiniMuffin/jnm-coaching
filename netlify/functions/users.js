const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);
  
  try {
    // HENTE BRUKERE (GET)
    if (event.httpMethod === 'GET') {
      const users = await sql`SELECT id, username, name, role, start_date, is_archived FROM users`;
      return { statusCode: 200, body: JSON.stringify(users) };
    }

    // LAGE NY BRUKER (POST)
    if (event.httpMethod === 'POST') {
      const { name, username, password, role } = JSON.parse(event.body);
      
      await sql`
        INSERT INTO users (name, username, password, role, is_archived)
        VALUES (${name}, ${username}, ${password}, ${role || 'athlete'}, false)
      `;
      
      const allUsers = await sql`SELECT id, username, name, role, start_date, is_archived FROM users`;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
    }

    // ARKIVERE/GJENOPPRETTE BRUKER (PATCH)
    if (event.httpMethod === 'PATCH') {
      const { id, is_archived } = JSON.parse(event.body);
      
      await sql`UPDATE users SET is_archived = ${is_archived} WHERE id = ${id}`;
      
      const allUsers = await sql`SELECT id, username, name, role, start_date, is_archived FROM users`;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
    }

    // SLETTE BRUKER (DELETE)
    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body);
      
      // Slett brukerens innsjekker først
      await sql`DELETE FROM checkins WHERE user_id = ${id}`;
      // Deretter slett brukeren
      await sql`DELETE FROM users WHERE id = ${id}`;
      
      const allUsers = await sql`SELECT id, username, name, role, start_date, is_archived FROM users`;
      return { statusCode: 200, body: JSON.stringify(allUsers) };
    }

  } catch (error) {
    console.error('Users error:', error);
    return { statusCode: 500, body: error.message };
  }
};