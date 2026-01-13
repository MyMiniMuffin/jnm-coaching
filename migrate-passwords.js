#!/usr/bin/env node

/**
 * Passord-migreringsscript for JNM Coaching
 *
 * Dette scriptet hasher alle klartekst-passord i databasen.
 * Kjør dette FØR du deployer den nye sikkerhetskoden.
 *
 * Bruk: node migrate-passwords.js
 */

const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

const SALT_ROUNDS = 12;

async function migratePasswords() {
  console.log('🔒 Starter passord-migrering...\n');

  if (!process.env.NETLIFY_DATABASE_URL) {
    console.error('❌ Feil: NETLIFY_DATABASE_URL er ikke satt');
    console.error('   Kjør: NETLIFY_DATABASE_URL="..." node migrate-passwords.js');
    process.exit(1);
  }

  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // Hent alle brukere
    const users = await sql`SELECT id, username, password FROM users`;
    console.log(`📋 Fant ${users.length} brukere i databasen\n`);

    let migratedCount = 0;
    let alreadyHashedCount = 0;
    let failedCount = 0;

    for (const user of users) {
      // Sjekk om passordet allerede er hashet (bcrypt starter med $2a$ eller $2b$)
      if (user.password && user.password.startsWith('$2')) {
        console.log(`✓ ${user.username}: Allerede hashet`);
        alreadyHashedCount++;
        continue;
      }

      if (!user.password) {
        console.log(`⚠ ${user.username}: Mangler passord (hopper over)`);
        failedCount++;
        continue;
      }

      try {
        // Hash passordet
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

        // Oppdater i database
        await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;

        console.log(`✅ ${user.username}: Migrert`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ ${user.username}: Feil ved migrering - ${error.message}`);
        failedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migreringsrapport:');
    console.log('='.repeat(50));
    console.log(`✅ Migrert:          ${migratedCount}`);
    console.log(`✓  Allerede hashet:  ${alreadyHashedCount}`);
    console.log(`❌ Feilet:           ${failedCount}`);
    console.log(`📋 Totalt:           ${users.length}`);
    console.log('='.repeat(50) + '\n');

    if (migratedCount > 0) {
      console.log('🎉 Migrering fullført!');
      console.log('Du kan nå deploye den nye sikkerhetskoden.\n');
    } else if (alreadyHashedCount === users.length) {
      console.log('ℹ️  Alle passord er allerede hashet.');
      console.log('Ingen migrering nødvendig.\n');
    }

    if (failedCount > 0) {
      console.log('⚠️  Noen brukere ble ikke migrert. Se detaljer over.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal feil under migrering:');
    console.error(error);
    process.exit(1);
  }
}

// Kjør migrering
migratePasswords();
