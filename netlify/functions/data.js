const { neon } = require('@neondatabase/serverless');

// Validering av checkin-data
const validateCheckinData = (data) => {
  const errors = [];
  
  if (data.weight !== undefined) {
    const weight = parseFloat(data.weight);
    if (isNaN(weight) || weight < 20 || weight > 500) {
      errors.push('Vekt må være mellom 20 og 500 kg');
    }
  }
  
  if (data.sleep !== undefined) {
    const sleep = parseInt(data.sleep);
    if (isNaN(sleep) || sleep < 1 || sleep > 10) {
      errors.push('Søvn må være mellom 1 og 10');
    }
  }
  
  if (data.energy !== undefined) {
    const energy = parseInt(data.energy);
    if (isNaN(energy) || energy < 1 || energy > 10) {
      errors.push('Energi må være mellom 1 og 10');
    }
  }
  
  if (data.accuracy !== undefined) {
    const accuracy = parseInt(data.accuracy);
    if (isNaN(accuracy) || accuracy < 1 || accuracy > 10) {
      errors.push('Nøyaktighet må være mellom 1 og 10');
    }
  }
  
  return errors;
};

exports.handler = async (event) => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // --- GET: Hent all data ---
    if (event.httpMethod === 'GET') {
      const userId = event.queryStringParameters?.id;
      
      if (!userId || isNaN(parseInt(userId))) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig bruker-ID' }) };
      }

      const [userResult, checkins] = await Promise.all([
        sql`
          SELECT diet_plan, workout_plan, step_goal, total_weeks, start_date, is_paused, paused_at 
          FROM users 
          WHERE id = ${userId}
        `,
        sql`
          SELECT 
            id, date, weight, sleep, energy, accuracy, 
            strength_sessions as "strengthSessions", 
            cardio_sessions as "cardioSessions", 
            steps_reached as "stepsReached", 
            taken_supplements as "takenSupplements", 
            comment, image_url, images, created_at as timestamp 
          FROM checkins 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `
      ]);

      const user = userResult[0] || {};
      
      const formattedCheckins = checkins.map(c => {
        let imageList = [];
        if (c.images) {
          try { 
            imageList = typeof c.images === 'string' ? JSON.parse(c.images) : c.images; 
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
          totalWeeks: user.total_weeks || 12,
          startDate: user.start_date,
          isPaused: user.is_paused || false,
          pausedAt: user.paused_at,
          checkins: formattedCheckins
        })
      };
    }

    // --- POST: Handlinger ---
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { userId, type, data } = body;

      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      if (type === 'plan_update') {
        // Enkle oppdateringer med validering
        if (data.dietPlan !== undefined) {
          await sql`UPDATE users SET diet_plan = ${data.dietPlan} WHERE id = ${userId}`;
        }
        if (data.workoutPlan !== undefined) {
          await sql`UPDATE users SET workout_plan = ${data.workoutPlan} WHERE id = ${userId}`;
        }
        if (data.stepGoal !== undefined) {
          const stepGoal = parseInt(data.stepGoal);
          if (!isNaN(stepGoal) && stepGoal >= 1000 && stepGoal <= 50000) {
            await sql`UPDATE users SET step_goal = ${stepGoal} WHERE id = ${userId}`;
          }
        }
        if (data.totalWeeks !== undefined) {
          const totalWeeks = parseInt(data.totalWeeks);
          if (!isNaN(totalWeeks) && totalWeeks >= 1 && totalWeeks <= 52) {
            await sql`UPDATE users SET total_weeks = ${totalWeeks} WHERE id = ${userId}`;
          }
        }
        
        // Startdato oppdatering
        if (data.startDate !== undefined) {
          await sql`UPDATE users SET start_date = ${data.startDate}, is_paused = false, paused_at = NULL WHERE id = ${userId}`;
        }

        // PAUSE LOGIKK
        if (data.action === 'pause') {
          const now = new Date().toISOString();
          await sql`UPDATE users SET is_paused = true, paused_at = ${now} WHERE id = ${userId}`;
        }
        
        // RESUME LOGIKK
        if (data.action === 'resume') {
          const userRes = await sql`SELECT start_date, paused_at FROM users WHERE id = ${userId}`;
          const u = userRes[0];
          
          if (u && u.paused_at && u.start_date) {
            const pauseStart = new Date(u.paused_at);
            const now = new Date();
            const diffTime = now - pauseStart;
            
            const oldStart = new Date(u.start_date);
            const newStart = new Date(oldStart.getTime() + diffTime).toISOString();
            
            await sql`UPDATE users SET start_date = ${newStart}, is_paused = false, paused_at = NULL WHERE id = ${userId}`;
          } else {
            await sql`UPDATE users SET is_paused = false WHERE id = ${userId}`;
          }
        }
      } 
      
      else if (type === 'new_checkin') {
        // Valider checkin-data
        const validationErrors = validateCheckinData(data);
        if (validationErrors.length > 0) {
          return { 
            statusCode: 400, 
            body: JSON.stringify({ error: validationErrors.join(', ') }) 
          };
        }

        const cardio = parseInt(data.cardioSessions) || 0;
        const strength = parseInt(data.strengthSessions) || 0;
        const imagesJson = JSON.stringify(data.images || []);
        
        await sql`
          INSERT INTO checkins (
            user_id, date, weight, sleep, energy, accuracy, 
            strength_sessions, cardio_sessions, steps_reached, taken_supplements, comment, images
          )
          VALUES (
            ${userId}, 
            ${data.date}, 
            ${parseFloat(data.weight)}, 
            ${parseInt(data.sleep)}, 
            ${parseInt(data.energy)}, 
            ${parseInt(data.accuracy)}, 
            ${strength}, 
            ${cardio}, 
            ${Boolean(data.stepsReached)}, 
            ${Boolean(data.takenSupplements)}, 
            ${data.comment || ''}, 
            ${imagesJson}
          )
        `;
      }
      
      else if (type === 'delete_checkin') {
        if (!data.checkinId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler checkin-ID' }) };
        }
        await sql`DELETE FROM checkins WHERE id = ${data.checkinId}`;
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (error) {
    console.error('Data error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil' }) };
  }
};