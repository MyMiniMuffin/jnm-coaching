# Coach-API og MCP-server

Coachens AI-assistenter (Grok, Claude o.l.) kan lese og oppdatere data i appen gjennom et eget API og en MCP-server. Begge kjører i den vanlige containeren (`server.mjs`) og bruker samme API-nøkler og samme kode (`coach-api/service.js`).

| | Adresse |
| --- | --- |
| REST-API | `https://jnmcoaching.no/api/coach/v1` |
| MCP (Streamable HTTP) | `https://jnmcoaching.no/mcp` |
| Autentisering | `Authorization: Bearer jnmc_<prefix>_<hemmelighet>` |

Kode: `coach-api/` (nøkler, tjenestelag, REST, rate limit), `mcp/` (MCP-server, HTTP og stdio), `scripts/coach-key.cjs` (nøkkelverktøy), migrasjoner `012_coach_api_keys.sql` og `013_coach_api_audit_log.sql`.

## 1. Migrering

Ingenting å gjøre manuelt: `scripts/migrate-production.cjs` kjører ved hver containerstart og lager tabellene `coach_api_keys` og `coach_api_audit_log` (idempotent, `CREATE TABLE IF NOT EXISTS`). Etter første deploy kan du sjekke loggen:

```bash
docker compose logs jnm | grep 'migrations 012/013'
```

Vil du kjøre den for hånd: `docker exec jnm-coaching-app node scripts/migrate-production.cjs`.

## 2. API-nøkler

Nøkkelen ser slik ut: `jnmc_<12 hex>_<64 hex>`. Databasen lagrer bare prefikset og SHA-256 av hele nøkkelen, så nøkkelen vises **én gang** når den lages. Hver nøkkel har et navn, scope `coach` og er knyttet til coach-brukeren den handler som.

Kjør inne i produksjonscontaineren (den har `NETLIFY_DATABASE_URL`):

```bash
# Ny nøkkel (velger coach-brukeren automatisk hvis det bare finnes én)
docker exec jnm-coaching-app npm run coach-key -- create --name grok
docker exec jnm-coaching-app npm run coach-key -- create --name claude --coach <brukernavn>

# Oversikt: prefiks, navn, coach, opprettet, sist brukt, status
docker exec jnm-coaching-app npm run coach-key -- list

# Bytt nøkkel: den gamle tilbakekalles og en ny med samme navn skrives ut
docker exec jnm-coaching-app npm run coach-key -- rotate <prefiks>

# Tilbakekall (virker umiddelbart)
docker exec jnm-coaching-app npm run coach-key -- revoke <prefiks>
```

`npm run` skriver noen linjer selv; vil du bare ha skriptets utdata, bruk `docker exec jnm-coaching-app node scripts/coach-key.cjs create --name grok`.

Lagre nøkkelen rett i connectoren/passordbehandleren. Ikke legg den i repoet, i `.env` eller i chat-logger. Lekker den: `rotate` eller `revoke`.

## 3. Sikkerhet

- Manglende, feilformatert, ukjent, feil eller tilbakekalt nøkkel gir **401**. Nøkkel uten scope `coach`, eller knyttet til en bruker som ikke (lenger) er coach, gir **403**.
- Nøkler sammenlignes med `crypto.timingSafeEqual` på hashen. Nøkkelen logges aldri.
- Rate limit i minnet: 120 forespørsler per minutt per nøkkel, og 30 mislykkede innlogginger per 10 minutter per IP (**429**). En IP som har nådd grensen for mislykkede innlogginger, får 429 før nøkkelen slås opp (også med riktig nøkkel) til den eldste registrerte feilen er 10 minutter gammel.
- Svarene inneholder aldri passord, tokens, push-abonnementer eller bilder/bilde-URL-er (Cloudinary). Alle spørringer lister kolonnene eksplisitt. App Review-demokontoen (`apple_review`) er utelatt, som i coach-oversikten.
- Arkiverte utøvere kan leses (`includeArchived=true`), men ikke endres (**409**).
- Alle lagrede endringer skrives til `coach_api_audit_log` (nøkkel-ID og -navn, tidspunkt, handling, utøver, før og etter) i **samme SQL-setning** som selve endringen. Endret noen planen i appen mellom lesing og skriving, avvises skrivingen med **409** i stedet for å overskrive.
- Dry-run skriver ingenting til databasen (heller ikke audit-loggen).

Se siste endringer:

```sql
SELECT created_at, key_name, action, athlete_id FROM coach_api_audit_log ORDER BY created_at DESC LIMIT 20;
```

`before_value`/`after_value` er den lagrede teksten i kolonnen (som JSON-streng), så en endring kan rulles tilbake ved å skrive `before_value #>> '{}'` tilbake til `users.diet_plan`/`workout_plan`.

## 4. Endepunkter

Alle svar er JSON med `Cache-Control: no-store`. Feil: `{ "error": "...", "details": [{ "path", "message" }] }`.

| Metode | Sti | Beskrivelse |
| --- | --- | --- |
| GET | `/me` | Navn, prefiks og scope for nøkkelen (fin for å teste) |
| GET | `/athletes?includeArchived=true` | Utøvere: id, navn, brukernavn, status, startdato, uker, skrittmål, startvekt, sist aktiv, siste rapportdato, uleste rapporter |
| GET | `/reports/latest?includeArchived=true` | Siste ukesrapport per utøver (`latestReport` er `null` hvis ingen) |
| GET | `/athletes/:id/reports?from=&to=&week=&limit=` | Ukesrapporter for én utøver, nyeste først. `from`/`to` = `ÅÅÅÅ-MM-DD`, eller `week` = ISO-uke (`2026-W46`). `limit` 1–500, standard 100 |
| GET | `/athletes/:id/weight?from=&to=` | Vekt fra ukesrapportene (eldste først), oppsummering (første, siste, endring) og runder med start-/målvekt |
| GET | `/athletes/:id/meal-plan` | Matplanene |
| PUT | `/athletes/:id/meal-plan` | Erstatt alle matplaner |
| PATCH | `/athletes/:id/meal-plan` | Endre/legg til/fjern enkeltplaner |
| GET/PUT/PATCH | `/athletes/:id/training-program` | Samme for treningsprogram |

En ukesrapport: `id, athleteId, date, weight, sleep, energy, accuracy, strengthSessions, cardioSessions, stepsReached, takenSupplements, comment, periodId, isRead, submittedAt`. Vekt finnes bare i ukesrapportene (og som start-/målvekt på rundene), så vekthistorikken hentes derfra.

### Planformat

Planene ligger i `users.diet_plan` og `users.workout_plan` i samme format som coach-UI-et skriver (`src/lib/namedPlans.js` og `src/lib/planFormat.js`), så appen viser dem som vanlig. API-et viser dem slik:

```json
{
  "athlete": { "id": 5, "name": "Ada", "isArchived": false },
  "storageFormat": "named-plans",
  "plans": [
    { "id": "4f0c…", "name": "Treningsdag", "sections": [
      { "title": "Frokost", "items": [ { "text": "Havregryn", "sets": "", "reps": "", "subItems": ["60 g"] } ] }
    ] },
    { "id": "original", "name": "Matplan", "text": "Eldre plan som fritekst" }
  ]
}
```

- En plan er enten strukturert (`sections`) eller fritekst (`text`). Elementer kan være en tekst eller `{ text, sets?, reps?, subItems? }` (sett/reps brukes i treningsprogram, `subItems` i matplan).
- `storageFormat`: `named-plans` (nytt format), `legacy` (eldre tekst, vist som én plan med id `original`) eller `empty`.

**PUT** `{ "plans": [ { "id"?, "name", "sections" | "text" } ] }` – planene erstatter alle. En plan uten `id` beholder id-en til en eksisterende plan med samme navn.

**PATCH** `{ "plans": [ { "id"? , "name"?, "sections"? | "text"? } ], "removePlanIds": ["..."] }` – planer matches på `id`, ellers på navn (uten forskjell på store/små bokstaver). Ukjent navn = ny plan. Andre planer beholdes. Minst én plan må bli igjen.

Valideringen er streng (ukjente felt gir 400): navn 1–120 tegn og unike som i appen, maks 20 planer, 50 seksjoner, 200 elementer per seksjon, og maks 200 000 tegn lagret totalt (samme grense som appen).

### Dry-run

Legg til `?dryRun=true` eller `"dryRun": true` i body. Query-verdien tolkes strengt: bare `true`, `false`, `1` og `0` er gyldige (alt annet, f.eks. `TRUE` eller `yes`, gir 400). PUT/PATCH avviser også ukjente og gjentatte query-parametere med 400 (f.eks. `?dryRun=true&dryRun=false`), så en feilstavet `?dryrun=true` aldri blir en ekte lagring. Er dry-run slått på i body, kan ikke `?dryRun=false` slå det av. Svaret har samme form som ved lagring, men `saved: false`:

```json
{
  "dryRun": true, "changed": true, "saved": false,
  "before": { "plans": [] }, "after": { "plans": [] },
  "diff": {
    "added": [{ "id", "name", "lines": ["+ ..."] }],
    "removed": [{ "id", "name" }],
    "renamed": [{ "id", "from", "to" }],
    "modified": [{ "id", "name", "lines": ["- gammel linje", "+ ny linje"] }]
  }
}
```

Ved lagring kommer i tillegg `auditId`.

`changed` sammenligner innholdet, ikke teksten i databasen: planene (id, navn, rekkefølge og innhold) normaliseres som ved lagring før de sammenlignes. Er det ingen endring, lagres og logges ingenting (`changed: false`, `saved: false` og en `message`), også når bare lagringsformatet ville endret seg (eldre tekst → `named-plans`). Ved en ekte endring av en eldre plan står konverteringen i svaret som `storageConversion: { "from": "legacy", "to": "named-plans" }`. Er rekkefølgen på planene endret, har `diff` i tillegg `order` (plan-ID-ene i ny rekkefølge).

### Eksempler

```bash
KEY='jnmc_...'
curl -s https://jnmcoaching.no/api/coach/v1/athletes -H "Authorization: Bearer $KEY"
curl -s 'https://jnmcoaching.no/api/coach/v1/athletes/5/reports?week=2026-W46' -H "Authorization: Bearer $KEY"
curl -s -X PATCH 'https://jnmcoaching.no/api/coach/v1/athletes/5/training-program?dryRun=true' \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"plans":[{"name":"Program A","sections":[{"title":"Dag 1","items":[{"text":"Knebøy","sets":"4","reps":"6"}]}]}]}'
```

## 5. MCP

Server: `https://jnmcoaching.no/mcp`, Streamable HTTP, stateless (ingen sesjoner, JSON-svar). Hver forespørsel må ha `Authorization: Bearer <nøkkel>`, som valideres akkurat som for REST-API-et (samme 401/403/429). Bare `POST` støttes: `GET` (SSE-strøm) og `DELETE` (avslutt sesjon) gir 405 med `Allow: POST`, og en tom eller ugyldig body gir 400 (JSON-RPC parse error). JSON-RPC-batcher (en array av meldinger) avvises med 400 (`-32600`), slik at hvert verktøykall teller i rate limit; SDK-klientene sender uansett én melding per POST.

| Verktøy | Tilsvarer |
| --- | --- |
| `list_athletes` | `GET /athletes` |
| `get_latest_weekly_reports` | `GET /reports/latest` |
| `get_weekly_reports` | `GET /athletes/:id/reports` |
| `get_weight_history` | `GET /athletes/:id/weight` |
| `get_meal_plan` / `get_training_program` | `GET .../meal-plan` / `.../training-program` |
| `update_meal_plan` / `update_training_program` | `PATCH` (`mode: "patch"`, standard) eller `PUT` (`mode: "replace"`) |

Skriveverktøyene har `dryRun: true` som standard og returnerer før/etter/diff. Assistenten må sende `dryRun: false` for å lagre; serveren ber den vise diffen til coachen først.

### Grok

Grok → **Settings → Connectors** (evt. **Tools/MCP**) → legg til en egendefinert (custom) MCP-connector:

- **Server URL:** `https://jnmcoaching.no/mcp`
- **Autentisering:** egendefinert header / bearer token: `Authorization: Bearer jnmc_...` (bruk en egen nøkkel, f.eks. `--name grok`)

Menyvalgene i Grok endrer seg innimellom; det som trengs er alltid en remote MCP-URL og en `Authorization`-header. Test med «List utøverne mine».

### Lokalt (stdio)

For klienter som bare støtter stdio (eller lokal testing). Kobler direkte til databasen med samme tjenestelag og nøkkelsjekk. Nøkkelen sjekkes ved oppstart og på nytt før hvert verktøykall, så `revoke` (eller endret scope) virker umiddelbart også for en prosess som allerede kjører: kallene gir da `401`/`403`. Rate limiting gjelder bare HTTP.

```bash
COACH_API_KEY='jnmc_...' NETLIFY_DATABASE_URL='postgres://...' node mcp/stdio.mjs
```

Eksempel for Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jnm-coaching": {
      "command": "node",
      "args": ["/sti/til/jnm-coaching/mcp/stdio.mjs"],
      "env": { "COACH_API_KEY": "jnmc_...", "NETLIFY_DATABASE_URL": "postgres://..." }
    }
  }
}
```

Støtter klienten remote MCP, bruk heller `https://jnmcoaching.no/mcp`; da trengs ingen database-URL lokalt.

## 6. Caddy og server.mjs

Ingen endring i Caddy: `jnmcoaching.no` sender alt til `jnm-coaching-app:3000` (se `ORACLE_DEPLOY.md`), og `request_body max_size 15MB` er mer enn nok (API og MCP godtar maks 1 MB). `Authorization`-headeren sendes uendret videre av `reverse_proxy`.

`server.mjs` håndterer `/api/coach/v1/*` og `/mcp` før statiske filer, så de aldri ender som HTML eller 404 fra appen. De vanlige sikkerhetsheaderne (CSP, HSTS osv.) settes også på disse svarene; de påvirker ikke API-klienter.

## 7. Tester

`npm test` kjører blant annet `tests/coach-api.cjs` (auth, validering, dry-run, audit, personvern, nøkkelskriptet), `tests/coach-mcp.mjs` (verktøy via SDK-klienten, in-memory og over HTTP) og `tests/coach-plan-format.mjs` (appens egne parsere leser det API-et skriver, og omvendt).
