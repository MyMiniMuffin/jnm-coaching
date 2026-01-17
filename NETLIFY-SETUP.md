# Netlify Miljøvariabler - Oppsettguide

## 🔑 Nødvendige Miljøvariabler

Appen din trenger følgende miljøvariabler for å fungere:

### 1. Database (Neon PostgreSQL)
```
NETLIFY_DATABASE_URL
```
**Verdi:** `postgresql://brukernavn:passord@host.neon.tech/database?sslmode=require`

**Hvor finner jeg denne?**
- Gå til [Neon Console](https://console.neon.tech)
- Velg ditt prosjekt
- Gå til "Connection Details"
- Kopier "Connection string" (velg "Pooled connection")

### 2. JWT Secret (Autentisering)
```
JWT_SECRET
```
**Verdi:** En lang, tilfeldig streng (minimum 32 tegn)

**Hvordan generere:**
```bash
# I terminal, kjør en av disse:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Eller bruk denne online: https://www.grc.com/passwords.htm
```

⚠️ **VIKTIG:** Denne må være unik og hemmelig. Ikke del den med noen!

### 3. Cloudinary (Bildeopplasting)
```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

**Hvor finner jeg disse?**
1. Gå til [Cloudinary Console](https://console.cloudinary.com)
2. Logg inn på kontoen din
3. På Dashboard-siden finner du:
   - **Cloud Name** (øverst)
   - **API Key**
   - **API Secret** (klikk "Reveal" for å se den)

**Har du ikke Cloudinary-konto?**
1. Gå til https://cloudinary.com/users/register/free
2. Registrer en gratis konto
3. Bekreft e-posten din
4. Hent API-detaljene fra Dashboard

---

## 📝 Slik setter du miljøvariabler i Netlify

### Metode 1: Via Netlify Dashboard (Anbefalt)

1. **Gå til Netlify Dashboard**
   - Åpne https://app.netlify.com
   - Logg inn på kontoen din

2. **Velg ditt site**
   - Klikk på site-navnet ditt fra listen

3. **Åpne Environment Variables**
   - Klikk på "Site configuration" i venstre meny
   - Klikk på "Environment variables"

4. **Legg til hver variabel**
   For hver av variablene ovenfor:
   - Klikk "Add a variable" → "Add a single variable"
   - **Key:** Skriv variabelnavnet (f.eks. `JWT_SECRET`)
   - **Values:** Skriv inn verdien
   - **Scopes:** La alle være valgt (Production, Deploy Previews, Branch Deploys)
   - Klikk "Create variable"

5. **Deploy på nytt**
   - Etter at alle variabler er lagt til
   - Gå til "Deploys"
   - Klikk "Trigger deploy" → "Deploy site"

### Metode 2: Via Netlify CLI

Hvis du har Netlify CLI installert:

```bash
# Installer CLI hvis du ikke har det
npm install -g netlify-cli

# Logg inn
netlify login

# Link til ditt site
netlify link

# Sett miljøvariabler
netlify env:set JWT_SECRET "din-lange-tilfeldige-streng"
netlify env:set NETLIFY_DATABASE_URL "postgresql://..."
netlify env:set CLOUDINARY_CLOUD_NAME "ditt-cloud-name"
netlify env:set CLOUDINARY_API_KEY "din-api-key"
netlify env:set CLOUDINARY_API_SECRET "din-api-secret"

# Deploy på nytt
netlify deploy --prod
```

---

## ✅ Sjekkliste

Bruk denne sjekklisten for å sikre at alt er riktig satt opp:

- [ ] **NETLIFY_DATABASE_URL** er satt med riktig PostgreSQL connection string
- [ ] **JWT_SECRET** er satt med en lang, tilfeldig streng (min 32 tegn)
- [ ] **CLOUDINARY_CLOUD_NAME** er satt med ditt Cloudinary cloud name
- [ ] **CLOUDINARY_API_KEY** er satt med din Cloudinary API key
- [ ] **CLOUDINARY_API_SECRET** er satt med din Cloudinary API secret
- [ ] Alle variabler er satt for alle scopes (Production, Deploy Previews, Branch Deploys)
- [ ] Site er re-deployed etter at variabler er lagt til

---

## 🩺 Health Check

Jeg har laget en health check-funksjon som automatisk sjekker om alle miljøvariabler er riktig satt!

**Slik bruker du den:**

1. Deploy appen til Netlify
2. Åpne denne URL-en i nettleseren: `https://ditt-site-navn.netlify.app/.netlify/functions/health-check`
3. Du vil se en JSON-rapport som viser:
   - ✅ Hvilke variabler som er satt
   - ❌ Hvilke variabler som mangler
   - ⚠️ Eventuelle advarsler (f.eks. hvis du bruker default JWT_SECRET)

**Eksempel på respons:**
```json
{
  "timestamp": "2024-01-17T10:30:00.000Z",
  "environment": "production",
  "summary": {
    "total": 5,
    "ok": 5,
    "missing": 0,
    "allOk": true
  },
  "message": "✅ Alle miljøvariabler er satt!",
  "checks": {
    "JWT_SECRET": { "status": "✅ OK", "length": 64 },
    "NETLIFY_DATABASE_URL": { "status": "✅ OK", "valid": true, "hasSsl": true },
    "CLOUDINARY_CLOUD_NAME": { "status": "✅ OK" },
    "CLOUDINARY_API_KEY": { "status": "✅ OK" },
    "CLOUDINARY_API_SECRET": { "status": "✅ OK" }
  }
}
```

---

## 🧪 Testing

Etter at du har satt opp alle miljøvariabler og deployed på nytt:

### 1. Test Autentisering
1. Åpne appen din
2. Prøv å logge inn
3. Åpne browser konsoll (F12)
4. Se etter: `[API] Auth header satt, token lengde: XXX`
5. ✅ Du skal IKKE bli logget ut automatisk

### 2. Test Bildeopplasting
1. Gå til innsjekk-siden
2. Velg et bilde og last opp
3. Sjekk konsoll for: `[CheckIn] Starter opplasting av 1 bilder`
4. ✅ Bildet skal lastes opp uten feil

### 3. Test Opprettelse av Kunder
1. Gå til admin/coach-siden
2. Opprett en ny kunde
3. Sjekk konsoll for: `[API] Bruker opprettet suksessfullt`
4. ✅ Kunden skal dukke opp i listen

---

## 🐛 Feilsøking

### Problem: "Mangler autentisering" feil
**Løsning:**
1. Sjekk at `JWT_SECRET` er satt i Netlify
2. Deploy site på nytt
3. Logg inn på nytt i appen

### Problem: "Cloudinary er ikke konfigurert"
**Løsning:**
1. Sjekk at alle tre Cloudinary-variabler er satt:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
2. Verifiser at verdiene er riktige (ingen ekstra mellomrom)
3. Deploy site på nytt

### Problem: Database connection error
**Løsning:**
1. Sjekk at `NETLIFY_DATABASE_URL` er riktig
2. Sjekk at Neon-databasen er online
3. Sjekk at connection string inneholder `?sslmode=require` på slutten

### Sjekke Functions Logs
1. Gå til Netlify Dashboard
2. Velg ditt site
3. Gå til "Logs" → "Functions"
4. Se etter feilmeldinger fra:
   - `auth`
   - `upload`
   - `users`
   - `data`

---

## 📞 Hjelp

Hvis du fortsatt har problemer:

1. **Sjekk Functions Logs** i Netlify for detaljerte feilmeldinger
2. **Sjekk Browser Console** for frontend-feil
3. Se `FEILRETTINGER.md` for vanlige problemer og løsninger

---

## 🔒 Sikkerhet

⚠️ **VIKTIG SIKKERHETSTIPS:**

1. **JWT_SECRET:**
   - Må være minst 32 tegn lang
   - Skal være helt tilfeldig
   - Del ALDRI denne med noen
   - Hvis den lekker, generer en ny og deploy på nytt

2. **Cloudinary API Secret:**
   - Del ALDRI denne med noen
   - Hvis den lekker, regenerer den i Cloudinary Dashboard

3. **Database URL:**
   - Inneholder passord - del ALDRI denne
   - Hvis den lekker, bytt passord i Neon Console

4. **Aldri commit miljøvariabler til Git!**
   - Sjekk at `.env` er i `.gitignore`
   - Bruk kun Netlify Dashboard eller CLI for å sette variabler
