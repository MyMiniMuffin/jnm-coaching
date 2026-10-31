# Flytting fra Netlify til Oracle (samme instans som MetalFlow)

JNM Coaching kjører som én Docker-container (`server.mjs`) på Oracle-instansen der MetalFlow allerede går. MetalFlows Caddy tar HTTPS for `jnmcoaching.no` og sender trafikken videre over nettverket `metalflow_proxy`.

Ingenting i appen endres:

- Funksjonene i `netlify/functions/` kjøres uendret på de samme URL-ene (`/.netlify/functions/*` og `/api/onboarding-image-upload`).
- Headere, CSP, cache og redirects fra `netlify.toml` er gjenskapt i `server.mjs`.
- iOS-appen kaller `https://jnmcoaching.no`, så den trenger ingen ny App Store-versjon.
- Databasen blir i Neon, bilder i Cloudinary. Ingen datamigrering.
- Migreringene (`scripts/migrate-production.cjs`) kjører ved hver containerstart, slik Netlify kjørte dem ved hver deploy.

## 0. Før du starter: ta over Neon-databasen

`NETLIFY_DATABASE_URL` betyr at databasen ble laget via Netlify DB. Gå til Netlify → prosjektet → **Extensions / Neon** og velg **Claim database**, så databasen flyttes til din egen Neon-konto. Gjør dette før noe annet; ellers kan den bli slettet hvis Netlify-prosjektet stenges.

Kopier tilkoblingsstrengen fra Neon (helst den med `-pooler` i vertsnavnet).

## 1. Hent miljøvariablene fra Netlify

Netlify → Site configuration → Environment variables. Du trenger:

| Variabel | Påkrevd |
| --- | --- |
| `NETLIFY_DATABASE_URL` | ja (Neon-strengen fra steg 0) |
| `JWT_SECRET` | ja — **samme verdi**, ellers logges alle ut |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | ja |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | for web-push |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` | for iOS-push |

## 2. Klon og start på Oracle-instansen

```bash
ssh ubuntu@<oracle-ip>
git clone https://github.com/MyMiniMuffin/jnm-coaching.git ~/jnm-coaching
cd ~/jnm-coaching
nano .env            # lim inn variablene fra steg 1, én per linje: NAVN=verdi
chmod 600 .env
./deploy.sh --force  # bygger imaget og starter jnm-coaching-app
docker compose logs -f jnm
```

`APNS_PRIVATE_KEY` er flerlinjet. Skriv den på én linje med `\n` der linjeskiftene er, i doble anførselstegn.

Sjekk at containeren svarer inne på instansen:

```bash
docker exec jnm-coaching-app node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>r.text()).then(console.log)"
```

## 3. Legg til domenet i MetalFlows Caddy

I `~/metalflow/Caddyfile` (og i MetalFlow-repoet, så det ikke overskrives ved neste deploy):

```caddy
jnmcoaching.no {
	encode gzip
	request_body {
		max_size 15MB
	}
	reverse_proxy jnm-coaching-app:3000
}

www.jnmcoaching.no {
	redir https://jnmcoaching.no{uri} permanent
}
```

Last inn på nytt med `reload`, ikke `restart`. Caddy sjekker den nye konfigurasjonen først og beholder den gamle hvis noe er feil, så `metalflow.no` er oppe hele tiden:

```bash
cd ~/metalflow && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Caddy henter sertifikatet først når DNS peker til instansen (steg 4).

## 4. Flytt DNS

Hos domeneleverandøren for `jnmcoaching.no`:

- `A`-post for `jnmcoaching.no` → Oracle-instansens offentlige IP (samme som `metalflow.no`).
- `www` → `CNAME jnmcoaching.no` (eller samme `A`-post).
- Fjern Netlify-postene (`apex-loadbalancer.netlify.com` / `*.netlify.app`).

Senk gjerne TTL til 300 sekunder dagen før, så byttet går raskt.

## 5. Test etter byttet

- `https://jnmcoaching.no` laster, og du kan logge inn uten å bli logget ut.
- Coach: åpne en utøver, lagre en plan, last opp et bilde.
- `https://jnmcoaching.no/oppstart/` → last opp et onboarding-bilde.
- iOS-appen (TestFlight eller App Store-versjonen): logg inn, bytt fane, få et push-varsel.

## 6. Auto-deploy og opprydding

```bash
cd ~/jnm-coaching && ./scripts/install-auto-deploy.sh
```

Etter dette bygger serveren seg selv innen ett minutt etter push til `main`, slik som MetalFlow.

Når alt har gått stabilt i noen dager: slå av builds i Netlify (Site configuration → Build & deploy → Stop builds), og slett prosjektet til slutt. `netlify.toml` kan bli liggende til da, så du kan rulle tilbake ved å peke DNS til Netlify igjen.

## Sammen med MetalFlow

- Egne containere, eget compose-prosjekt og egen deploy-timer (`jnm-deploy` / `metalflow-deploy`). MetalFlows `--remove-orphans` rører ikke JNM.
- JNM publiserer ingen porter på verten; bare Caddy bruker 80/443. Begge appene lytter på 3000 inne i hver sin container.
- JNM har ingen lokale data eller volumer — databasen er i Neon og bildene i Cloudinary — så MetalFlows backup påvirkes ikke.
- JNM er begrenset til 768 MB minne og 1 CPU (`docker-compose.yml`), så den ikke kan sulte MetalFlow.
- Det eneste som deles, er Caddy og nettverket `metalflow_proxy`. Kjøres `docker compose down` for MetalFlow, mister JNM nettverket. Start da JNM på nytt etterpå: `cd ~/jnm-coaching && docker compose up -d`.
- Rydd gamle images innimellom, siden begge bygger på samme disk: `docker image prune -f`.

## Feilsøking

| Problem | Sjekk |
| --- | --- |
| 502 fra Caddy | `docker ps` — kjører `jnm-coaching-app`, og er den i nettverket `metalflow_proxy`? |
| Containeren starter ikke | `docker compose logs jnm` — ofte en manglende variabel i `.env` eller feil Neon-streng |
| Alle logges ut | `JWT_SECRET` er ikke den samme som på Netlify |
| Push kommer ikke fram | `APNS_*`/`WEB_PUSH_*` i `.env`. `APNS_PRODUCTION` er produksjon med mindre den er `false` (bruk `false` bare for Xcode-debugbygg) |
