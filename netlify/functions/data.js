const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // --- GET: Hent all data ---
    if (event.httpMethod === 'GET') {
      const userId = event.queryStringParameters.id;
      if (!userId) return { statusCode: 400, body: 'Missing user ID' };

      // OPPDATERT: Henter nå også current_week og total_weeks
      const userResult = await sql`
        SELECT diet_plan, workout_plan, step_goal, current_week, total_weeks 
        FROM users 
        WHERE id = ${userId}
      `;
      const user = userResult[0] || {};

      const checkins = await sql`
        SELECT 
          id, date, weight, sleep, energy, accuracy, 
          strength_sessions as "strengthSessions", 
          cardio_sessions as "cardioSessions", 
          steps_reached as "stepsReached", 
          taken_supplements as "takenSupplements", 
          comment, image_url, images, created_at as timestamp 
        FROM checkins 
        WHERE user_id = ${userId}
      `;
      
      const formattedCheckins = checkins.map(c => {
        let imageList = [];
        if (c.images) {
          try {
            imageList = JSON.parse(c.images);
          } catch (e) {
            console.error("Feil ved parsing av bilder", e);
          }
        } else if (c.image_url) {
          imageList = [c.image_url];
        }

        return {
          ...c,
          timestamp: new Date(c.timestamp).getTime(),
          images: imageList
        };
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          dietPlan: user.diet_plan || '',
          workoutPlan: user.workout_plan || '',
          stepGoal: user.step_goal || 10000,
          currentWeek: user.current_week || 1, // Default uke 1
          totalWeeks: user.total_weeks || 12,   // Default 12 uker
          checkins: formattedCheckins
        })
      };
    }

    // --- POST: Handlinger ---
    if (event.httpMethod === 'POST') {
      const { userId, type, data } = JSON.parse(event.body);

      if (type === 'plan_update') {
        if (data.dietPlan !== undefined) await sql`UPDATE users SET diet_plan = ${data.dietPlan} WHERE id = ${userId}`;
        if (data.workoutPlan !== undefined) await sql`UPDATE users SET workout_plan = ${data.workoutPlan} WHERE id = ${userId}`;
        if (data.stepGoal !== undefined) await sql`UPDATE users SET step_goal = ${data.stepGoal} WHERE id = ${userId}`;
        
        // OPPDATERT: Lagring av uker
        if (data.currentWeek !== undefined) await sql`UPDATE users SET current_week = ${data.currentWeek} WHERE id = ${userId}`;
        if (data.totalWeeks !== undefined) await sql`UPDATE users SET total_weeks = ${data.totalWeeks} WHERE id = ${userId}`;
      } 
      
      else if (type === 'new_checkin') {
        const cardio = data.cardioSessions || 0;
        const imagesJson = JSON.stringify(data.images || []);

        await sql`
          INSERT INTO checkins (
            user_id, date, weight, sleep, energy, accuracy, 
            strength_sessions, cardio_sessions, steps_reached, taken_supplements, comment, images
          )
          VALUES (
            ${userId}, ${data.date}, ${data.weight}, ${data.sleep}, ${data.energy}, 
            ${data.accuracy}, ${data.strengthSessions}, ${cardio}, ${data.stepsReached}, 
            ${data.takenSupplements}, ${data.comment}, ${imagesJson}
          )
        `;
      }
      
      else if (type === 'delete_checkin') {
        await sql`DELETE FROM checkins WHERE id = ${data.checkinId}`;
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

  } catch (error) {
    console.error('Data error:', error);
    return { statusCode: 500, body: error.message };
  }
};