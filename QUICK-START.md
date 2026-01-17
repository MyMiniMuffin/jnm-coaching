# 🚀 Quick Start Guide - JNM Coaching

## TL;DR - Rask oppsett i 5 minutter

### Trinn 1: Hent API-nøkler

#### A) Neon Database (Gratis)
1. Gå til https://console.neon.tech
2. Logg inn eller opprett konto
3. Klikk på ditt prosjekt
4. Gå til "Connection Details"
5. Kopier "Connection string" (velg **Pooled connection**)

#### B) Generer JWT Secret
I terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Kopier resultatet.

#### C) Cloudinary (Gratis)
1. Gå til https://console.cloudinary.com
2. Logg inn eller opprett konto på https://cloudinary.com/users/register/free
3. Fra Dashboard, kopier:
   - Cloud Name
   - API Key
   - API Secret (klikk "Reveal")

### Trinn 2: Sett miljøvariabler i Netlify

1. Gå til https://app.netlify.com
2. Velg ditt site
3. Gå til **Site configuration** → **Environment variables**
4. Klikk **Add a variable** for hver av disse:

| Variabelnavn | Verdi |
|-------------|-------|
| `NETLIFY_DATABASE_URL` | Din Neon connection string |
| `JWT_SECRET` | Din genererte 64-tegns streng |
| `CLOUDINARY_CLOUD_NAME` | Ditt Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Din Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Din Cloudinary API secret |

5. Klikk **Create variable** for hver

### Trinn 3: Deploy på nytt

1. Gå til **Deploys**
2. Klikk **Trigger deploy** → **Deploy site**
3. Vent til deployment er ferdig (vanligvis 1-2 minutter)

### Trinn 4: Verifiser at alt fungerer

Åpne denne URL-en i nettleseren:
```
https://ditt-site-navn.netlify.app/.netlify/functions/health-check
```

Du skal se:
```json
{
  "message": "✅ Alle miljøvariabler er satt!",
  "summary": {
    "allOk": true
  }
}
```

### Trinn 5: Test appen

1. **Test innlogging:**
   - Åpne appen
   - Logg inn med en bruker
   - Du skal IKKE bli logget ut

2. **Test bildeopplasting:**
   - Gå til innsjekk
   - Last opp et bilde
   - Det skal fungere uten feil

3. **Test opprettelse av kunde (for coach):**
   - Gå til admin/coach-siden
   - Opprett en ny kunde
   - Kunden skal dukke opp i listen

## ✅ Ferdig!

Hvis alt fungerer, er du klar til å bruke appen! 🎉

---

## ❌ Noe gikk galt?

### Problem: Health check viser manglende variabler
**Løsning:** Gå tilbake til Trinn 2 og sjekk at alle variabler er riktig satt

### Problem: "Cloudinary er ikke konfigurert"
**Løsning:** Sjekk at alle 3 Cloudinary-variabler er satt (cloud name, api key, api secret)

### Problem: "Ikke autentisert" / blir logget ut
**Løsning:**
1. Sjekk at JWT_SECRET er satt
2. Deploy på nytt
3. Logg inn på nytt

### Problem: Database errors
**Løsning:**
1. Sjekk at database URL er riktig
2. Sjekk at den inneholder `?sslmode=require` på slutten
3. Verifiser at Neon-databasen er online

---

## 📚 Mer hjelp?

- **Detaljert guide:** Se `NETLIFY-SETUP.md`
- **Feilsøking:** Se `FEILRETTINGER.md`
- **Netlify Functions Logs:** Netlify Dashboard → Logs → Functions
- **Browser Console:** Trykk F12 i nettleseren

---

## 🔐 Sikkerhet

⚠️ **Viktig:**
- Del ALDRI JWT_SECRET, API secrets eller database URL med noen
- Disse skal KUN være i Netlify miljøvariabler
- Commit ALDRI disse til Git

✅ Alle hemmelige nøkler er allerede ekskludert fra Git via `.gitignore`
