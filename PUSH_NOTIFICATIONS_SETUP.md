# Push Notifications Setup

Denne guiden gjør web push-oppsettet deploy-klart for coach-varsler i JNM Coaching.

## Hva som allerede er implementert

- Coach kan aktivere pushvarsler i appen.
- Nettleseren registrerer `service worker` via [public/sw.js](/Users/jonas/Desktop/jnm-coaching/public/sw.js).
- Coach-abonnementer lagres via [netlify/functions/push-subscriptions.js](/Users/jonas/Desktop/jnm-coaching/netlify/functions/push-subscriptions.js).
- Når en utøver sender inn en check-in, forsøker backend å sende push fra [netlify/functions/data.js](/Users/jonas/Desktop/jnm-coaching/netlify/functions/data.js).
- Appen beholder polling-basert varsel som fallback hvis push ikke er tilgjengelig.

## 1. Kjør database-migrasjonen

Kjør SQL-filen:

- [migrations/002_add_push_subscriptions.sql](/Users/jonas/Desktop/jnm-coaching/migrations/002_add_push_subscriptions.sql)

Den oppretter tabellen `push_subscriptions` som lagrer coach-abonnementer.

## 2. Generer VAPID-nøkler

Kjør i prosjektet:

```bash
npm run generate-vapid
```

Det gir deg:

- `publicKey`
- `privateKey`

## 3. Sett miljøvariabler

### I Netlify

Legg inn disse miljøvariablene i Netlify:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

Anbefalt verdi for `WEB_PUSH_SUBJECT`:

```text
mailto:din-epost@domene.no
```

### I frontend-miljøet

Legg inn denne variabelen for Vite:

- `VITE_WEB_PUSH_PUBLIC_KEY`

Denne skal ha samme verdi som `WEB_PUSH_PUBLIC_KEY`.

Hvis du bruker lokal `.env`, kan den se slik ut:

```env
VITE_WEB_PUSH_PUBLIC_KEY=din_public_key_her
```

## 4. Deploy

Etter at miljøvariablene er lagt inn:

```bash
npm run build
```

Deploy deretter som vanlig til Netlify.

Merk:

- [netlify.toml](/Users/jonas/Desktop/jnm-coaching/netlify.toml) er oppdatert slik at `sw.js` ikke caches hardt.
- Det gjør at service worker-endringer slår gjennom raskere etter deploy.

## 5. Test ende til ende

Anbefalt testløp:

1. Deploy endringene.
2. Åpne coach-appen i en støttet nettleser.
3. Logg inn som coach.
4. Trykk `Slå på` for varsler i coach-dashboardet.
5. Godkjenn varsler i nettleseren.
6. Logg inn som utøver i en annen sesjon eller enhet.
7. Send inn en ny check-in.
8. Bekreft at coach får:
   - in-app varsel
   - pushvarsel hvis nettleseren/enheten støtter det

## 6. Hvis push ikke kommer

Sjekk dette først:

- `VITE_WEB_PUSH_PUBLIC_KEY` er satt i frontend-builden.
- `WEB_PUSH_PUBLIC_KEY` og `WEB_PUSH_PRIVATE_KEY` er satt i Netlify.
- databasen har tabellen `push_subscriptions`
- coach faktisk godkjente varsler
- coach bruker en nettleser/enhet som støtter `Notification`, `serviceWorker` og `PushManager`

Nyttige steder å inspisere:

- [src/App.jsx](/Users/jonas/Desktop/jnm-coaching/src/App.jsx)
- [netlify/functions/push-subscriptions.js](/Users/jonas/Desktop/jnm-coaching/netlify/functions/push-subscriptions.js)
- [netlify/functions/data.js](/Users/jonas/Desktop/jnm-coaching/netlify/functions/data.js)
- nettleserens DevTools: `Application` / `Service Workers` / `Push Messaging`
- Netlify function logs

## 7. Kjente avgrensninger

- Dette er web push, ikke native mobil-push.
- Støtte varierer mellom nettlesere og PWA-modus.
- Polling-varsler i appen fungerer fortsatt som backup.
- Varslet åpner appen på `/`; det er ikke laget direkte navigasjon til en spesifikk utøver ennå.

## 8. Neste naturlige forbedringer

- Navigere direkte til riktig klient ved `notificationclick`
- støtte for å skru av pushvarsler i UI
- vise abonnementsstatus per enhet
- rydde gamle abonnementer periodisk
