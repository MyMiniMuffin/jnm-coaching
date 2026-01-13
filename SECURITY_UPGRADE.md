# Sikkerhetsoppgradering - JNM Coaching

## Oversikt
Denne oppgraderingen implementerer kritiske sikkerhetsforbedringer for JNM Coaching-applikasjonen.

## Endringer

### 1. JWT-autentisering
- **Tidligere**: Ingen autentisering på API-endepunkter (utenom login)
- **Nå**: JWT-tokens genereres ved innlogging og må sendes med alle API-kall
- **Implementert i**: `auth.js`, `auth-middleware.js`

### 2. Autorisasjon
- **Tidligere**: Brukere kunne hente/endre andre brukeres data ved å endre ID-parameter
- **Nå**: Middleware verifiserer at innlogget bruker har tilgang til forespurt data
- **Implementert i**: `auth-middleware.js`, `data.js`, `users.js`

### 3. Serverside bildeopplasting
- **Tidligere**: Cloudinary-credentials eksponert i frontend
- **Nå**: Bilder lastes opp via backend med signed requests
- **Implementert i**: `upload.js`, `index.html` (API-kall oppdatert)

### 4. Fjernet klartekst passord-støtte
- **Tidligere**: Auth-funksjonen aksepterte både hashed og klartekst passord
- **Nå**: Kun bcrypt-hashed passord aksepteres
- **Implementert i**: `auth.js`

## Nødvendige miljøvariabler

Du må konfigurere følgende miljøvariabler i Netlify:

```bash
# JWT Secret (generer en sterk, tilfeldig streng)
JWT_SECRET=your-secret-key-here

# Cloudinary (eksisterende)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Database (eksisterende)
NETLIFY_DATABASE_URL=postgresql://...
```

### Generere JWT Secret

Bruk en av disse metodene for å generere en sikker JWT secret:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64
```

## Installasjon

1. Installer nye avhengigheter:
```bash
npm install
```

2. Sett opp miljøvariabler i Netlify Dashboard:
   - Gå til Site settings → Environment variables
   - Legg til `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

3. Deploy den nye versjonen

## Migrering av eksisterende brukere

**VIKTIG**: Brukere med klartekst-passord vil ikke lenger kunne logge inn.

Alternativer:
1. **Manuell reset**: Be brukere om å kontakte admin for passord-reset
2. **Database-script**: Kjør et script som hasher eksisterende klartekst-passord
3. **Midlertidig løsning**: Aktiviser passord-reset-funksjonalitet før deploy

### Script for å hashe eksisterende passord

```javascript
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

async function migratePasswords() {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  const users = await sql`SELECT id, password FROM users`;

  for (const user of users) {
    // Sjekk om passordet allerede er hashet
    if (!user.password.startsWith('$2')) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;
      console.log(`Migrerte passord for bruker-ID: ${user.id}`);
    }
  }

  console.log('Migrering fullført!');
}

migratePasswords();
```

## Testing

Før deploy, test følgende:

1. **Login**
   - Verifiser at login returnerer en JWT-token
   - Sjekk at token lagres i localStorage

2. **Autentisering**
   - Prøv å hente data uten token (skal feile med 401)
   - Prøv å hente andre brukeres data (skal feile med 403)

3. **Bildeopplasting**
   - Last opp bilde fra athlete-view
   - Last opp bilde fra coach-view (galleri)
   - Verifiser at bilder lastes opp til Cloudinary via backend

4. **Token-utløp**
   - Sett kort token-levetid for testing
   - Verifiser at utløpt token redirecter til login

## Tilbakestilling

Hvis noe går galt, kan du rulle tilbake til forrige versjon via Netlify Dashboard:
1. Gå til Deploys
2. Finn forrige fungerende deploy
3. Klikk "Publish deploy"

## Support

Ved problemer, kontakt utvikler eller opprett issue.

## Sikkerhetshensyn

### Hva er fikset
- ✅ Manglende autentisering på API-endepunkter
- ✅ Manglende autorisasjon (brukere kunne se andres data)
- ✅ Eksponerte Cloudinary-credentials
- ✅ Klartekst passord-støtte

### Hva bør forbedres videre
- Rate limiting på API-endepunkter
- CORS-konfigurering
- Input sanitization
- Logging og monitoring
- Passord-reset-funksjonalitet
- Two-factor authentication (2FA)

## Lisens

Samme som hovedprosjekt.
