# Push Notifications Setup

JNM Coaching støtter to leveringskanaler for coach-varsler når en utøver sender inn rapport:

1. **Web Push** (nettleser / PWA) via VAPID + `web-push`
2. **APNs** (iOS App Store / TestFlight) via Capacitor Push Notifications

Begge registreres via `/.netlify/functions/push-subscriptions` og sendes fra check-in-flyten i `netlify/functions/data.js` → `push-delivery.js`.

## Allerede implementert

- Coach kan aktivere varsler i coach-dashboardet («Slå på»).
- Nettleser: service worker i `public/sw.js`, VAPID-abonnement lagres i `push_subscriptions`.
- iOS: `@capacitor/push-notifications` ber om tillatelse, registrerer APNs-token og lagrer det som `platform=ios`.
- Ved ny check-in sendes push til alle aktive coach-abonnementer (web + iOS).
- Polling i appen er fortsatt fallback.

## Oppsett

Se den oppdaterte guiden med App Store / APNs-steg:

- [docs/push-notifications-setup.md i prosjektlageret](/cursor/stores/bc-2a27334c-cc21-4da9-a2a1-62113146ca4a/docs/push-notifications-setup.md) (for Jonas)
- Kortversjon i repo: seksjonene under

### Database

Migrasjonene `007`–`009` kjøres automatisk ved produksjonsdeploy (`scripts/migrate-production.cjs`).

### Web Push (Netlify + Vite)

```bash
npm run generate-vapid
```

Sett i Netlify:

- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT` (f.eks. `mailto:kontakt@perfectmorning.dev`)

Sett i frontend-build:

- `VITE_WEB_PUSH_PUBLIC_KEY` (= samme som public key)

### iOS / APNs (Netlify)

Sett i Netlify (hemmeligheter – ikke i repo):

- `APNS_KEY_ID`
- `APNS_TEAM_ID` (`55FDY26LN7`)
- `APNS_BUNDLE_ID` (`no.jnmcoaching.app`)
- `APNS_PRIVATE_KEY` (PEM-innhold fra `.p8`)
- `APNS_PRODUCTION=true` for TestFlight/App Store

I Apple Developer / Xcode Cloud må Push Notifications-capability være aktiv for App ID `no.jnmcoaching.app`. Entitlement `App/App.entitlements` ligger i repoet.

Etter kodeendringer: Xcode Cloud bygger ny iOS-versjon fra `main`. Coach må åpne appen, trykke «Slå på» og godta systemdialogen.

## Test

1. Deploy Netlify (migrasjoner + funksjoner).
2. Vent på / last opp iOS-bygg med push-capability.
3. Coach på iPhone: «Slå på» → godta varsler.
4. Utøver sender check-in.
5. Coach skal få APNs-varsel (bakgrunn) eller in-app toast (forgrunn).

Web: samme flyt i støttet nettleser med VAPID-nøkler satt.
