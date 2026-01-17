# Feilrettinger for JNM Coaching App

## Problemer som ble identifisert og fikset

### 1. Autentiseringsproblemer (Kontinuerlig utlogging)

**Problem:** Kundene ble logget ut hele tiden.

**Årsak:**
- Case-sensitivity i header-håndtering (`authorization` vs `Authorization`)
- Manglende feilhåndtering for tomme tokens
- Generiske feilmeldinger gjorde det vanskelig å debugge

**Løsning:**
- Oppdatert `netlify/functions/auth-middleware.js` med:
  - Sjekking av alle mulige header-varianter (case-insensitive)
  - Validering av at token ikke er tomt
  - Detaljert logging av autentiseringsfeil
  - Bedre feilmeldinger for ulike typer JWT-feil

### 2. Bildeopplasting i innsjekk

**Problem:** Kunder fikk ikke til å laste opp bilder i innsjekk.

**Årsak:**
- Manglende validering av Cloudinary-miljøvariabler
- Dårlige feilmeldinger gjorde det umulig å identifisere problemet
- Ingen logging av opplastingsprosessen

**Løsning:**
- Oppdatert `netlify/functions/upload.js` med:
  - Sjekking av at alle Cloudinary-miljøvariabler er satt
  - Bedre feilmeldinger med HTTP-statuskoder
  - Logging av opplastingsprosessen
- Oppdatert frontend (`index.html`) med:
  - Detaljert logging av bildeopplasting
  - Visning av spesifikke feilmeldinger til brukeren
  - Bedre feilhåndtering i `handleImageUpload`

### 3. Opprettelse av nye kunder

**Problem:** Det var ikke mulig å opprette nye kunder.

**Årsak:**
- Manglende feilhåndtering og logging
- Generiske feilmeldinger

**Løsning:**
- Oppdatert `netlify/functions/users.js` med:
  - Detaljert logging av alle steg i opprettelsesprosessen
  - Try-catch blokk rundt POST-logikken
  - Spesifikke feilmeldinger for validering og databasefeil

### 4. Frontend feilhåndtering

**Forbedringer:**
- Lagt til logging i `getAuthHeaders()` for å spore token-problemer
- Forbedret feilhåndtering i `uploadImage()` med bedre feilmeldinger
- Lagt til detaljert logging i bildeopplasting-prosessen

## Nødvendige miljøvariabler

For at appen skal fungere, må følgende miljøvariabler være satt i Netlify:

```
NETLIFY_DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET=your-secret-key-here-change-in-production
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Slik setter du miljøvariabler i Netlify:

1. Gå til Netlify Dashboard
2. Velg ditt site
3. Gå til "Site settings" → "Environment variables"
4. Legg til hver variabel med riktig verdi

**VIKTIG:** JWT_SECRET bør være en lang, tilfeldig streng (minst 32 tegn). Du kan generere en slik:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing

For å teste at alle feilrettingene fungerer:

1. **Test autentisering:**
   - Logg inn med en bruker
   - Sjekk browser-konsollet for "[API] Auth header satt, token lengde: XXX"
   - Verifiser at du ikke blir logget ut automatisk

2. **Test bildeopplasting:**
   - Gå til innsjekk-siden
   - Last opp et bilde
   - Sjekk konsollet for "[CheckIn] Starter opplasting av 1 bilder"
   - Verifiser at bildet lastes opp uten feil

3. **Test opprettelse av kunder:**
   - Gå til admin-siden
   - Opprett en ny kunde
   - Sjekk konsollet for "Users POST: Oppretter ny bruker"
   - Verifiser at kunden dukker opp i listen

## Debugging

Alle funksjoner logger nå detaljert informasjon til konsollen. For å se logger:

**Frontend (Browser):**
- Åpne Developer Tools (F12)
- Gå til "Console"-fanen
- Se etter meldinger merket med [API] eller [CheckIn]

**Backend (Netlify):**
- Gå til Netlify Dashboard
- Velg ditt site
- Gå til "Functions" → Velg en funksjon → "Logs"
- Se etter logger fra auth-middleware, upload, users, osv.

## Neste steg

Hvis problemene fortsetter:

1. Sjekk at alle miljøvariabler er riktig satt i Netlify
2. Sjekk Netlify Functions-logger for detaljerte feilmeldinger
3. Sjekk browser-konsollet for frontend-feil
4. Verifiser at databasen er tilgjengelig og har riktig skjema
5. Sjekk at Cloudinary-kontoen er aktiv og har tilstrekkelig kvote
