const { neon } = require('@neondatabase/serverless');
const { requireOwnership } = require('./auth-middleware');

// Sjekk at database-URL er satt
if (!process.env.NETLIFY_DATABASE_URL) {
  throw new Error('NETLIFY_DATABASE_URL miljøvariabel er ikke satt');
}

// Gjenbruk SQL-tilkobling mellom warm invocations
const sql = neon(process.env.NETLIFY_DATABASE_URL);

const getWebPushClient = () => {
  if (!process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY) {
    return null;
  }

  try {
    const webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.WEB_PUSH_SUBJECT || 'mailto:hello@example.com',
      process.env.WEB_PUSH_PUBLIC_KEY,
      process.env.WEB_PUSH_PRIVATE_KEY
    );
    return webpush;
  } catch (error) {
    console.error('web-push dependency mangler eller kunne ikke lastes:', error);
    return null;
  }
};

const sendCoachPushNotifications = async ({ athleteId, athleteName, unreadCount }) => {
  const webpush = getWebPushClient();
  if (!webpush) return;

  try {
    const subscriptions = await sql`
      SELECT ps.endpoint, ps.p256dh, ps.auth
      FROM push_subscriptions ps
      INNER JOIN users u ON u.id = ps.user_id
      WHERE u.role = 'coach' AND COALESCE(u.is_archived, false) = false
    `;

    if (!subscriptions.length) return;

    const payload = JSON.stringify({
      title: 'Ny check-in mottatt',
      body: unreadCount > 1
        ? `${athleteName} har nå ${unreadCount} uleste rapporter.`
        : `${athleteName} har sendt inn en ny rapport.`,
      url: '/',
      tag: `coach-checkin-${athleteId}`,
      clientId: athleteId,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    });

    await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }, payload);
      } catch (error) {
        const statusCode = error?.statusCode;
        console.error('Push sending feilet:', statusCode || error?.message || error);

        if (statusCode === 404 || statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
        }
      }
    }));
  } catch (error) {
    console.error('Kunne ikke sende coach-pushvarsler:', error);
  }
};

// Validering av checkin-data
const validateCheckinData = (data) => {
  const errors = [];
  const requiredFields = ['weight', 'sleep', 'energy', 'accuracy'];

  if (!data || typeof data !== 'object') {
    return ['Mangler rapportdata'];
  }

  requiredFields.forEach((field) => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`${field} må fylles ut`);
    }
  });
  
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

  ['strengthSessions', 'cardioSessions'].forEach((field) => {
    if (data[field] !== undefined) {
      const sessions = parseInt(data[field], 10);
      if (isNaN(sessions) || sessions < 0 || sessions > 7) {
        errors.push('Antall økter må være mellom 0 og 7');
      }
    }
  });

  if (data.comment !== undefined && typeof data.comment !== 'string') {
    errors.push('Kommentar må være tekst');
  }

  if (data.images !== undefined) {
    if (!Array.isArray(data.images)) {
      errors.push('Bilder må være en liste');
    } else if (data.images.length > 10) {
      errors.push('Maks 10 bilder per rapport');
    } else if (data.images.some(url => typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/'))) {
      errors.push('Ugyldig bilde-URL');
    }
  }
  
  return errors;
};

const formatCheckinRecord = (checkin) => {
  let imageList = [];
  if (checkin.images) {
    try {
      imageList = typeof checkin.images === 'string' ? JSON.parse(checkin.images) : checkin.images;
    } catch (e) {
      console.error('Feil ved parsing av bilder', e);
    }
  } else if (checkin.image_url) {
    imageList = [checkin.image_url];
  }

  const { image_url, ...rest } = checkin;
  return {
    ...rest,
    timestamp: new Date(checkin.timestamp).getTime(),
    images: imageList
  };
};

const getTargetUserState = async (userId) => {
  const result = await sql`
    SELECT role, is_archived
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return result[0] || null;
};

const COACH_ONLY_TYPES = new Set([
  'plan_update',
  'mark_checkins_read',
  'create_period',
  'end_period',
  'update_period',
  'add_gallery_image',
  'delete_gallery_image'
]);

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
      
      const formattedCheckins = checkins.map(formatCheckinRecord);

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
      const { userId, type, data = {} } = body;

      if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Mangler bruker-ID' }) };
      }

      // Verifiser at bruker har tilgang til å endre denne dataen
      const authResult = requireOwnership(event, userId);
      if (!authResult.success) {
        return { statusCode: authResult.statusCode, body: authResult.body };
      }

      const targetUser = await getTargetUserState(userId);
      if (!targetUser) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Brukeren ble ikke funnet' }) };
      }

      // Alle mutasjoner skal kun gjelde utøvere — aldri en annen coach
      if (targetUser.role !== 'athlete') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Kan kun endre data for utøvere.' })
        };
      }

      if (targetUser.is_archived) {
        // Arkiverte utøvere kan kun få "mark_checkins_read" fra coach
        const canCoachMarkRead = authResult.role === 'coach' && type === 'mark_checkins_read';
        if (!canCoachMarkRead) {
          return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Kontoen er arkivert og kan ikke endres.' })
          };
        }
      }

      if (COACH_ONLY_TYPES.has(type) && authResult.role !== 'coach') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Kun coach kan endre planer, runder og galleri.' })
        };
      }

      if (type === 'new_checkin' && (authResult.role !== 'athlete' || parseInt(authResult.userId, 10) !== parseInt(userId, 10))) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Kun utøveren selv kan sende inn rapport.' })
        };
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

        const cardio = parseInt(data.cardioSessions, 10) || 0;
        const strength = parseInt(data.strengthSessions, 10) || 0;
        const imagesJson = JSON.stringify(data.images || []);
        
        // Hent brukerens aktive periode-ID
        const userRes = await sql`SELECT current_period_id FROM users WHERE id = ${userId}`;
        const periodId = userRes[0]?.current_period_id || null;
        
        const insertedCheckin = await sql`
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
          RETURNING
            id, date, weight, sleep, energy, accuracy,
            strength_sessions as "strengthSessions",
            cardio_sessions as "cardioSessions",
            steps_reached as "stepsReached",
            taken_supplements as "takenSupplements",
            comment, image_url, images, created_at as timestamp,
            period_id as "periodId", is_read as "isRead"
        `;

        const unreadCountResult = await sql`
          SELECT COUNT(*)::integer AS count
          FROM checkins
          WHERE user_id = ${userId} AND is_read = false
        `;

        const athleteNameResult = await sql`
          SELECT name
          FROM users
          WHERE id = ${userId}
          LIMIT 1
        `;

        await sendCoachPushNotifications({
          athleteId: userId,
          athleteName: athleteNameResult[0]?.name || 'En utøver',
          unreadCount: unreadCountResult[0]?.count || 1
        });

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            checkin: formatCheckinRecord(insertedCheckin[0])
          })
        };
      }
      
      else if (type === 'update_checkin') {
        if (!data.checkinId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler checkin-ID' }) };
        }

        // SIKKERHET: Verifiser at checkin tilhører valgt bruker.
        // Coach kan oppdatere for en utøver de har åpnet; athlete kan kun oppdatere egne.
        const checkinMatch = await sql`
          SELECT id FROM checkins WHERE id = ${data.checkinId} AND user_id = ${userId}
        `;

        if (checkinMatch.length === 0) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Ingen tilgang til denne rapporten' }) };
        }

        // Valider feltene som faktisk er sendt med
        const fieldsToValidate = {};
        ['weight', 'sleep', 'energy', 'accuracy', 'strengthSessions', 'cardioSessions', 'comment'].forEach(f => {
          if (data[f] !== undefined) fieldsToValidate[f] = data[f];
        });
        const validationErrors = validateCheckinData(fieldsToValidate);
        if (validationErrors.length > 0) {
          return { statusCode: 400, body: JSON.stringify({ error: validationErrors.join(', ') }) };
        }
        if (data.comment !== undefined && typeof data.comment === 'string' && data.comment.length > 5000) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Kommentar er for lang (maks 5 000 tegn)' }) };
        }

        const hasWeight = data.weight !== undefined;
        const hasSleep = data.sleep !== undefined;
        const hasEnergy = data.energy !== undefined;
        const hasAccuracy = data.accuracy !== undefined;
        const hasStrength = data.strengthSessions !== undefined;
        const hasCardio = data.cardioSessions !== undefined;
        const hasSteps = data.stepsReached !== undefined;
        const hasSupp = data.takenSupplements !== undefined;
        const hasComment = data.comment !== undefined;

        const updated = await sql`
          UPDATE checkins SET
            weight = CASE WHEN ${hasWeight} THEN ${hasWeight ? parseFloat(data.weight) : null} ELSE weight END,
            sleep = CASE WHEN ${hasSleep} THEN ${hasSleep ? parseInt(data.sleep) : null} ELSE sleep END,
            energy = CASE WHEN ${hasEnergy} THEN ${hasEnergy ? parseInt(data.energy) : null} ELSE energy END,
            accuracy = CASE WHEN ${hasAccuracy} THEN ${hasAccuracy ? parseInt(data.accuracy) : null} ELSE accuracy END,
            strength_sessions = CASE WHEN ${hasStrength} THEN ${hasStrength ? parseInt(data.strengthSessions, 10) || 0 : 0} ELSE strength_sessions END,
            cardio_sessions = CASE WHEN ${hasCardio} THEN ${hasCardio ? parseInt(data.cardioSessions, 10) || 0 : 0} ELSE cardio_sessions END,
            steps_reached = CASE WHEN ${hasSteps} THEN ${hasSteps ? Boolean(data.stepsReached) : false} ELSE steps_reached END,
            taken_supplements = CASE WHEN ${hasSupp} THEN ${hasSupp ? Boolean(data.takenSupplements) : false} ELSE taken_supplements END,
            comment = CASE WHEN ${hasComment} THEN ${hasComment ? (data.comment || '') : ''} ELSE comment END
          WHERE id = ${data.checkinId} AND user_id = ${userId}
          RETURNING
            id, date, weight, sleep, energy, accuracy,
            strength_sessions as "strengthSessions",
            cardio_sessions as "cardioSessions",
            steps_reached as "stepsReached",
            taken_supplements as "takenSupplements",
            comment, image_url, images, created_at as timestamp,
            period_id as "periodId", is_read as "isRead"
        `;

        if (!updated[0]) {
          return { statusCode: 500, body: JSON.stringify({ error: 'Kunne ikke oppdatere rapporten' }) };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            checkin: formatCheckinRecord(updated[0])
          })
        };
      }

      else if (type === 'delete_checkin') {
        if (!data.checkinId) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Mangler checkin-ID' }) };
        }

        // SIKKERHET: Verifiser at checkin tilhorer valgt bruker.
        // Coach kan slette for en utøver de har åpnet, men ikke på tvers av brukere.
        const checkinMatch = await sql`
          SELECT id FROM checkins WHERE id = ${data.checkinId} AND user_id = ${userId}
        `;

        if (checkinMatch.length === 0) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Ingen tilgang til denne rapporten' }) };
        }

        await sql`DELETE FROM checkins WHERE id = ${data.checkinId} AND user_id = ${userId}`;
      }

      else if (type === 'mark_checkins_read') {
        // Coach-only sjekkes via COACH_ONLY_TYPES, target.role === 'athlete' sjekkes generelt
        await sql`UPDATE checkins SET is_read = true WHERE user_id = ${userId} AND is_read = false`;
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

        const result = await sql`
          WITH deactivate_existing AS (
            UPDATE coaching_periods
            SET is_active = false
            WHERE user_id = ${userId}
          ),
          new_period AS (
            INSERT INTO coaching_periods (user_id, name, start_date, starting_weight, goal_weight, is_active)
            VALUES (${userId}, ${periodName}, ${startDate}, ${sw}, ${gw}, true)
            RETURNING id
          )
          UPDATE users SET current_period_id = (SELECT id FROM new_period), starting_weight = ${sw}
          WHERE id = ${userId}
          RETURNING (SELECT id FROM new_period) AS period_id
        `;

        if (!result[0]) {
          return { statusCode: 500, body: JSON.stringify({ error: 'Kunne ikke opprette runde' }) };
        }
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
        const { name, startDate, endDate, startingWeight, goalWeight, notes } = data;
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
        let parsedStartDate;
        let parsedEndDate;

        if (name !== undefined) {
          if (typeof name !== 'string') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Navn må være tekst' }) };
          }
          const trimmedName = name.trim();
          if (!trimmedName) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Navn kan ikke være tomt' }) };
          }
          if (trimmedName.length > 120) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Navn er for langt (maks 120 tegn)' }) };
          }
          queries.push(sql`UPDATE coaching_periods SET name = ${trimmedName} WHERE id = ${periodId} AND user_id = ${userId}`);
        }

        if (startDate !== undefined) {
          if (startDate === null || startDate === '') {
            return { statusCode: 400, body: JSON.stringify({ error: 'Startdato kan ikke være tom' }) };
          }
          parsedStartDate = new Date(startDate);
          if (Number.isNaN(parsedStartDate.getTime())) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig startdato' }) };
          }
        }

        if (endDate !== undefined) {
          if (endDate === null || endDate === '') {
            parsedEndDate = null;
          } else {
            parsedEndDate = new Date(endDate);
            if (Number.isNaN(parsedEndDate.getTime())) {
              return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig sluttdato' }) };
            }
          }
        }

        if (parsedStartDate !== undefined || endDate !== undefined) {
          const existingPeriod = await sql`
            SELECT start_date as "startDate", end_date as "endDate", is_active as "isActive"
            FROM coaching_periods
            WHERE id = ${periodId} AND user_id = ${userId}
            LIMIT 1
          `;

          const currentPeriod = existingPeriod[0];
          if (!currentPeriod) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Periode ikke funnet' }) };
          }
          const finalStartDate = parsedStartDate !== undefined ? parsedStartDate : new Date(currentPeriod.startDate);
          const finalEndDate = endDate !== undefined
            ? parsedEndDate
            : (currentPeriod.endDate ? new Date(currentPeriod.endDate) : null);

          if (finalEndDate && finalEndDate.getTime() < finalStartDate.getTime()) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Sluttdato kan ikke være før startdato' }) };
          }

          if (currentPeriod.isActive && endDate !== undefined && finalEndDate !== null) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Aktiv runde kan ikke ha sluttdato satt her' }) };
          }

          if (parsedStartDate !== undefined) {
            queries.push(sql`UPDATE coaching_periods SET start_date = ${parsedStartDate.toISOString()} WHERE id = ${periodId} AND user_id = ${userId}`);
          }

          if (endDate !== undefined) {
            queries.push(sql`UPDATE coaching_periods SET end_date = ${finalEndDate ? finalEndDate.toISOString() : null} WHERE id = ${periodId} AND user_id = ${userId}`);
          }
        }

        if (startingWeight !== undefined) {
          const swParsed = parseFloat(startingWeight);
          if (isNaN(swParsed) || swParsed < 20 || swParsed > 500) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Startvekt må være mellom 20 og 500 kg' }) };
          }
          queries.push(sql`UPDATE coaching_periods SET starting_weight = ${swParsed} WHERE id = ${periodId} AND user_id = ${userId}`);
          queries.push(sql`UPDATE users SET starting_weight = ${swParsed} WHERE id = ${userId} AND current_period_id = ${periodId}`);
        }

        if (goalWeight !== undefined) {
          const goalVal = goalWeight ? parseFloat(goalWeight) : null;
          if (goalVal !== null && (isNaN(goalVal) || goalVal < 20 || goalVal > 500)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Målvekt må være mellom 20 og 500 kg' }) };
          }
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

      else {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ukjent handlingstype' }) };
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Metode ikke tillatt' }) };

  } catch (error) {
    console.error('Data error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Serverfeil ved databehandling' }) };
  }
};
