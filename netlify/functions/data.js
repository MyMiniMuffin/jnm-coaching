const { neon } = require('@neondatabase/serverless');
const { requireOwnership } = require('./auth-middleware');

// Sjekk at database-URL er satt
if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

// Gjenbruk SQL-tilkobling mellom warm invocations
const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
  try {
    // --- GET: Hent all data ---
    if (event.httpMethod === 'GET') {
      const userId = event.queryStringParameters?.id;

      if (!userId || isNaN(parseInt(userId))) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig bruker-ID' }) };
      }

      // Verifiser at bruker har tilgang til denne dataen
      const authResult = requireOwnership(event, userId);
      if (!authResult.success) {
        return { statusCode: authResult.statusCode, body: authResult.body };
      }

      // Kjør alle 4 queries parallelt for å minimere latens
      const [periods, galleryImages, userResult, checkins] = await Promise.all([
        sql`
          SELECT id, name, start_date as "startDate", end_date as "endDate",
                 starting_weight as "startingWeight", goal_weight as "goalWeight",
                 is_active as "isActive", notes
          FROM coaching_periods
          WHERE user_id = ${userId}
          ORDER BY start_date DESC
        `.catch(e => {
          console.log('coaching_periods table may not exist yet:', e.message);
          return [];
        }),
        sql`
          SELECT id, image_url, label, date, weight, created_at as timestamp
          FROM gallery_images
          WHERE user_id = ${userId}
          ORDER BY date ASC, created_at ASC
        `.catch(e => {
          console.log('gallery_images table may not exist yet:', e.message);
          return [];
        }),
        sql`
          SELECT diet_plan, workout_plan, step_goal, total_weeks, start_date, is_paused, paused_at,
                 current_period_id, starting_weight
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
            comment, image_url, images, created_at as timestamp,
            period_id as "periodId", is_read as "isRead"
          FROM checkins
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 150
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

        const { image_url, ...rest } = c;
        return {
          ...rest,
          timestamp: new Date(c.timestamp).getTime(),
          images: imageList
        };
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
        },
        body: JSON.stringify({
          dietPlan: user.diet_plan || '',
          workoutPlan: user.workout_plan || '',
          stepGoal: user.step_goal || 10000,
          totalWeeks: user.total_weeks || 12,
          startDate: user.start_date,
          isPaused: user.is_paused || false,
          pausedAt: user.paused_at,
          currentPeriodId: user.current_period_id,
          startingWeight: user.starting_weight,
          periods: periods || [],
          checkins: formattedCheckins,
          galleryImages: galleryImages.map(img => {
            // Konverter date til ISO-streng hvis det er et Date-objekt
            let dateStr = img.date;
            if (img.date instanceof Date) {
              dateStr = img.date.toISOString().split('T')[0];
            } else if (img.date && typeof img.date === 'object') {
              // Noen drivere returnerer {value: ...}
              dateStr = new Date(img.date).toISOString().split('T')[0];
            }
            return {
              id: img.id,
              url: img.image_url,
              label: img.label,
              date: dateStr,
              weight: img.weight ? parseFloat(img.weight) : null,
              timestamp: new Date(img.timestamp).getTime()
            };
          })
        })
      };
    }

    // --- POST: Handlinger ---
    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '');
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig JSON i request body' }) };
      }
      const { userId, type, data } = body;

      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      // Verifiser at bruker har tilgang til å endre denne dataen
      const authResult = requireOwnership(event, userId);
      if (!authResult.success) {
        return { statusCode: authResult.statusCode, body: authResult.body };
      }

      if (type === 'plan_update') {
        // PAUSE/RESUME håndteres separat for å unngå race conditions
        if (data.action === 'pause') {
          const now = new Date().toISOString();
          await sql`UPDATE users SET is_paused = true, paused_at = ${now} WHERE id = ${userId}`;
        } else if (data.action === 'resume') {
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
        } else {
          // Vanlige plan-oppdateringer (ikke pause/resume)
          const updates = {};

          // Lengdebegrensning på tekstfelt
          const MAX_PLAN_LENGTH = 50000;
          if (data.dietPlan !== undefined) {
            if (typeof data.dietPlan === 'string' && data.dietPlan.length > MAX_PLAN_LENGTH) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Matplan er for lang (maks 50 000 tegn)' }) };
            }
            updates.diet_plan = data.dietPlan;
          }
          if (data.workoutPlan !== undefined) {
            if (typeof data.workoutPlan === 'string' && data.workoutPlan.length > MAX_PLAN_LENGTH) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Treningsplan er for lang (maks 50 000 tegn)' }) };
            }
            updates.workout_plan = data.workoutPlan;
          }
          if (data.stepGoal !== undefined) {
            const stepGoal = parseInt(data.stepGoal);
            if (isNaN(stepGoal) || stepGoal < 1000 || stepGoal > 100000) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Skrittmål må være mellom 1 000 og 100 000' }) };
            }
            updates.step_goal = stepGoal;
          }
          if (data.totalWeeks !== undefined) {
            const totalWeeks = parseInt(data.totalWeeks);
            if (isNaN(totalWeeks) || totalWeeks < 1 || totalWeeks > 52) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Antall uker må være mellom 1 og 52' }) };
            }
            updates.total_weeks = totalWeeks;
          }

          // Startdato oppdatering (nullstiller også pause) — valider format
          if (data.startDate !== undefined) {
            if (data.startDate !== null) {
              const d = new Date(data.startDate);
              if (isNaN(d.getTime())) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig startdato' }) };
              }
            }
            updates.start_date = data.startDate;
            updates.is_paused = false;
            updates.paused_at = null;
          }

          // Utfør én samlet UPDATE med CASE for å kun oppdatere felter som ble sendt
          if (Object.keys(updates).length > 0) {
            const hasStartDate = updates.start_date !== undefined;
            const hasDiet = updates.diet_plan !== undefined;
            const hasWorkout = updates.workout_plan !== undefined;
            const hasStepGoal = updates.step_goal !== undefined;
            const hasTotalWeeks = updates.total_weeks !== undefined;
            await sql`
              UPDATE users SET
                diet_plan = CASE WHEN ${hasDiet} THEN ${hasDiet ? updates.diet_plan : null} ELSE diet_plan END,
                workout_plan = CASE WHEN ${hasWorkout} THEN ${hasWorkout ? updates.workout_plan : null} ELSE workout_plan END,
                step_goal = CASE WHEN ${hasStepGoal} THEN ${hasStepGoal ? updates.step_goal : null} ELSE step_goal END,
                total_weeks = CASE WHEN ${hasTotalWeeks} THEN ${hasTotalWeeks ? updates.total_weeks : null} ELSE total_weeks END,
                start_date = CASE WHEN ${hasStartDate} THEN ${hasStartDate ? updates.start_date : null} ELSE start_date END,
                is_paused = CASE WHEN ${hasStartDate} THEN false ELSE is_paused END,
                paused_at = CASE WHEN ${hasStartDate} THEN NULL ELSE paused_at END
              WHERE id = ${userId}
            `;
          }
        }
      }
      
      else if (type === 'new_checkin') {
        // Valider dato
        if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(new Date(data.date).getTime())) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig dato' }) };
        }

        // Valider checkin-data
        const validationErrors = validateCheckinData(data);
        if (validationErrors.length > 0) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: validationErrors.join(', ') })
          };
        }

        // Lengdebegrensning på kommentar
        if (data.comment && typeof data.comment === 'string' && data.comment.length > 5000) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Kommentar er for lang (maks 5 000 tegn)' }) };
        }

        const cardio = parseInt(data.cardioSessions) || 0;
        const strength = parseInt(data.strengthSessions) || 0;
        const imagesJson = JSON.stringify(data.images || []);
        
        // Hent brukerens aktive periode-ID
        const userRes = await sql`SELECT current_period_id FROM users WHERE id = ${userId}`;
        const periodId = userRes[0]?.current_period_id || null;
        
        await sql`
          INSERT INTO checkins (
            user_id, date, weight, sleep, energy, accuracy, 
            strength_sessions, cardio_sessions, steps_reached, taken_supplements, comment, images, period_id
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
            ${imagesJson},
            ${periodId}
          )
        `;
      }
      
      else if (type === 'delete_checkin') {
        if (!data.checkinId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler checkin-ID' }) };
        }

        // SIKKERHET: Sjekk at brukeren eier denne checkin
        const ownerCheck = await sql`
          SELECT id FROM checkins WHERE id = ${data.checkinId} AND user_id = ${userId}
        `;

        if (ownerCheck.length === 0) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Ingen tilgang til denne rapporten' }) };
        }

        await sql`DELETE FROM checkins WHERE id = ${data.checkinId} AND user_id = ${userId}`;
      }

      else if (type === 'mark_checkins_read') {
        // Kun coach kan markere innsjekk som lest
        if (authResult.role !== 'coach') {
          return { statusCode: 403, body: JSON.stringify({ error: 'Kun coach kan markere rapporter som lest' }) };
        }
        // Verifiser at target-bruker er en utøver, ikke en annen coach
        const targetUser = await sql`SELECT role FROM users WHERE id = ${userId}`;
        if (targetUser.length === 0 || targetUser[0].role !== 'athlete') {
          return { statusCode: 400, body: JSON.stringify({ error: 'Kan bare markere rapporter for utøvere' }) };
        }
        await sql`UPDATE checkins SET is_read = true WHERE user_id = ${userId}`;
      }
      
      else if (type === 'create_period') {
        // Opprett ny coaching-periode
        const { name, startingWeight, goalWeight } = data;

        // Valider input
        const periodName = (name && typeof name === 'string') ? name.trim().substring(0, 200) : '';
        if (!periodName) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler navn på runde' }) };
        }
        const sw = parseFloat(startingWeight);
        if (isNaN(sw) || sw < 20 || sw > 500) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Startvekt må være mellom 20 og 500 kg' }) };
        }
        const gw = goalWeight ? parseFloat(goalWeight) : null;
        if (gw !== null && (isNaN(gw) || gw < 20 || gw > 500)) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Målvekt må være mellom 20 og 500 kg' }) };
        }

        const startDate = new Date().toISOString();

        // Bruk CTE for atomisk operasjon (BEGIN/COMMIT fungerer ikke med Neon HTTP-driver)
        await sql`UPDATE coaching_periods SET is_active = false WHERE user_id = ${userId}`;

        const result = await sql`
          WITH new_period AS (
            INSERT INTO coaching_periods (user_id, name, start_date, starting_weight, goal_weight, is_active)
            VALUES (${userId}, ${periodName}, ${startDate}, ${sw}, ${gw}, true)
            RETURNING id
          )
          UPDATE users SET current_period_id = (SELECT id FROM new_period), starting_weight = ${sw}
          WHERE id = ${userId}
          RETURNING (SELECT id FROM new_period) AS period_id
        `;

        const newPeriodId = result[0].period_id;

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            periodId: newPeriodId,
            period: {
              id: newPeriodId,
              name: periodName,
              startDate,
              startingWeight: sw,
              goalWeight: gw,
              isActive: true
            }
          })
        };
      }
      
      else if (type === 'end_period') {
        const periodId = parseInt(data.periodId, 10);

        if (!data.periodId || isNaN(periodId)) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig periode-ID' }) };
        }
        
        // SIKKERHET: Sjekk at brukeren eier denne perioden
        const ownerCheck = await sql`
          SELECT id FROM coaching_periods WHERE id = ${periodId} AND user_id = ${userId}
        `;
        
        if (ownerCheck.length === 0) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Ingen tilgang til denne perioden' }) };
        }
        
        const endDate = new Date().toISOString();

        await Promise.all([
          sql`UPDATE coaching_periods SET end_date = ${endDate}, is_active = false WHERE id = ${periodId} AND user_id = ${userId}`,
          sql`UPDATE users SET current_period_id = NULL WHERE id = ${userId} AND current_period_id = ${periodId}`
        ]);
      }
      
      else if (type === 'update_period') {
        const { startingWeight, goalWeight, notes } = data;
        const periodId = parseInt(data.periodId, 10);

        if (!data.periodId || isNaN(periodId)) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig periode-ID' }) };
        }
        
        // SIKKERHET: Sjekk at brukeren eier denne perioden
        const ownerCheck = await sql`
          SELECT id FROM coaching_periods WHERE id = ${periodId} AND user_id = ${userId}
        `;
        
        if (ownerCheck.length === 0) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Ingen tilgang til denne perioden' }) };
        }
        
        // Samle uavhengige oppdateringer og kjør parallelt
        const queries = [];

        if (startingWeight !== undefined) {
          const swParsed = parseFloat(startingWeight);
          queries.push(sql`UPDATE coaching_periods SET starting_weight = ${swParsed} WHERE id = ${periodId} AND user_id = ${userId}`);
          queries.push(sql`UPDATE users SET starting_weight = ${swParsed} WHERE id = ${userId} AND current_period_id = ${periodId}`);
        }

        if (goalWeight !== undefined) {
          const goalVal = goalWeight ? parseFloat(goalWeight) : null;
          queries.push(sql`UPDATE coaching_periods SET goal_weight = ${goalVal} WHERE id = ${periodId} AND user_id = ${userId}`);
        }

        if (notes !== undefined) {
          if (typeof notes === 'string' && notes.length > 10000) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Notater er for lange (maks 10 000 tegn)' }) };
          }
          queries.push(sql`UPDATE coaching_periods SET notes = ${notes} WHERE id = ${periodId} AND user_id = ${userId}`);
        }

        if (queries.length > 0) {
          await Promise.all(queries);
        }
      }
      
      else if (type === 'add_gallery_image') {
        if (!data.imageUrl) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bilde-URL' }) };
        }
        // Valider at URL er en gyldig Cloudinary HTTPS-URL
        if (typeof data.imageUrl !== 'string' || !data.imageUrl.startsWith('https://res.cloudinary.com/')) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig bilde-URL — kun Cloudinary-URLer er tillatt' }) };
        }
        const label = (data.label && typeof data.label === 'string') ? data.label.substring(0, 200) : 'Startbilde';
        // Valider dato (samme mønster som new_checkin)
        const date = data.date || new Date().toISOString().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig dato' }) };
        }
        const weight = data.weight ? parseFloat(data.weight) : null;
        
        await sql`
          INSERT INTO gallery_images (user_id, image_url, label, date, weight)
          VALUES (${userId}, ${data.imageUrl}, ${label}, ${date}, ${weight})
        `;
      }
      
      else if (type === 'delete_gallery_image') {
        if (!data.imageId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bilde-ID' }) };
        }
        const deleteResult = await sql`DELETE FROM gallery_images WHERE id = ${data.imageId} AND user_id = ${userId} RETURNING id`;
        if (deleteResult.length === 0) {
          return { statusCode: 404, body: JSON.stringify({ error: 'Bildet ble ikke funnet eller du har ikke tilgang' }) };
        }
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Metode ikke tillatt' }) };

  } catch (error) {
    console.error('Data error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil ved databehandling' }) };
  }
};