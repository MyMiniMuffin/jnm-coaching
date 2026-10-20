# JNM Coaching – iOS og App Store

## Status 19. oktober 2026 kl. 23:07

Versjon **1.0 (2)** er sendt til App Review. Apple viser **Waiting for Review**. Innsendings-ID: `098755ac-1fd5-4ec3-900e-33b025c55da9`.

- [Innsending i App Store Connect](https://appstoreconnect.apple.com/apps/6824649558/distribution/reviewsubmissions/details/098755ac-1fd5-4ec3-900e-33b025c55da9).
- App-ID `6824649558`, bundle ID `no.jnmcoaching.app`, SKU `jnm-coaching-ios`.
- Apple-team Perfect Morning AS, team-ID `55FDY26LN7`.
- Gratis og kun tilgjengelig i Norge ved lansering. Automatisk publisering etter godkjenning er valgt. Appen er ennå ikke offentlig tilgjengelig.
- iPhone og iPad, iOS 15 eller nyere. Mac og Vision Pro-distribusjon er slått av for denne versjonen.
- Build 2 er også lagt til «JNM intern testing» og viser Testing. Gruppen har én tester og to builds. Brukeren har installert TestFlight.

## Publiseringsoppsett

Norsk hovedspråk, undertittel «Trening og kosthold», kategori Health & Fitness og aldersskjema er lagret. Apple beregner 9+ på nyere operativsystemer, med regionale avvik. Beskrivelse og review-notater opplyser at tjenesten er gratis og invitasjonsbasert, uten kjøp eller abonnement.

Ansvarlig foretak er Perfect Morning AS, offentlig kontakt `kontakt@perfectmorning.dev`. Support-URL er https://jnmcoaching.no/support/ og personvern-URL er https://jnmcoaching.no/personvern/. Begge er publisert og svarer 200.

App Privacy-merket er publisert med brukerens uttrykkelige bekreftelse: navn, e-post, helse, trening, bilder/videoer, annet brukerinnhold, bruker-ID og produktinteraksjon brukes til appfunksjonalitet, knyttes til konto og brukes ikke til sporing. Brukeren har bekreftet nødvendige innholdsrettigheter og at appen ikke er regulert medisinsk utstyr. DSA-kontobanneret finnes fortsatt, men blokkerte ikke innsendingen for Norge.

Demokonto `apple_review` har fullført første passordbytte og inneholder fiktive mat-/treningsplaner og to tydelig fiktive rapporter. Demopassord er lagt direkte i App Store Connect og skal ikke lagres i repoet. Ingen kunders helseopplysninger eller bilder er brukt i butikkbildene. Tre originale skjermbilder fra iPhone 18 Pro (1206×2622) og tre fra iPad Pro 13-inch (2064×2752) er lastet opp og godkjent av Apples skjemakontroll.

## Teknisk løsning og verifisering

Capacitor 8 pakker React-grensesnittet lokalt med Swift Package Manager. Native HTTP bruker eksisterende JWT og produksjons-API `https://jnmcoaching.no/.netlify/functions/*`, med samme brukere og database som nettleseren. Ingen database- eller Cloudinary-hemmeligheter pakkes i appen. Nettleserversjonen beholder same-origin-kall og PWA/web-push. APNs er ikke implementert; web-push og service worker er deaktivert i native runtime.

Native plugins håndterer vibrasjon og deling av bilde-/ZIP-eksporter. Appikon, tillatelsestekster og Filesystem privacy manifest er inkludert. `ITSAppUsesNonExemptEncryption=false` er satt etter kontroll av OS-basert kryptering. Automatisk fokus på innloggingsfeltet er deaktivert i native appen for å unngå forstørret førstegangsvisning.

28 automatiske tester, webbygg, Capacitor-synk, simulatorbygg og signert Release-arkiv passerer. Brukeren har bekreftet innlogging og innledende funksjon på fysisk iPhone 16 Pro (iOS 27.0.1). Oppstart, demoinnlogging, hjem, matplan og treningsplan er visuelt kontrollert på iPhone 18 Pro og iPad Pro 13-inch. Kamera, bilde-/ZIP-deling, offline/utløpt sesjon og alle coach-scenarioer er ikke fullstendig testet på fysisk enhet.

Netlify-feilen i migrering 005 skyldtes to SQL-kommandoer i samme Neon-kall. Tabell og indeks er skilt i 005/006 og regresjonstestet. Rettelsen `0ddee07` er publisert til main; Netlify-deploy `6ad67f1d907d833bcbb32933` viser Published. Slette-endepunktet gir 401 uten innlogging; demobrukeren kan lese egen status, mens coach-only kø og bildeliste gir 403. Ingen klientkonto er slettet eller arkivert som del av publiseringsarbeidet.

## Lokale bygg og bevis

- Endelig arkiv: `/private/tmp/JNM-Coaching-1.0-2-final.xcarchive`.
- Vellykket opplasting: `/private/tmp/jnm-release-upload-2.log` (Upload succeeded / EXPORT SUCCEEDED).
- Simulatorapp: `/private/tmp/jnm-simulator/Build/Products/Release-iphonesimulator/App.app`.
- Originale butikkbilder og kvitteringer: `ios/App/output/store-screenshots/` og `ios/App/output/app-review-submitted.png` (ignorert av Git).
- Test-/bygglogger: `/private/tmp/jnm-migration-fix-tests.log` og `/private/tmp/jnm-migration-fix-build.log`.

## Neste native versjon

Kjør `npm run ios:sync` etter React-endringer, øk buildnummeret og arkiver i Xcode før ny opplasting. Appgrensesnittet følger det native bygget, mens serverdata og nettleserversjonen følger vanlig Netlify-deploy. `VITE_API_ORIGIN` kan settes ved bygg for en separat HTTPS-testserver; bare offentlige verdier skal ligge i `VITE_*`.

## Automatiske bygg og kontroller

GitHub Actions i `.github/workflows/checks.yml` kjører på push til `main`, pull requests mot `main` og manuell start. Node 22 installerer låste avhengigheter med `npm ci`, kjører alle tester, bygger produksjonsgrensesnittet og kontrollerer shell-syntaksen til Xcode Cloud-skriptet. Jobben har kun lesetilgang til repoet og trenger ingen produksjons- eller signeringshemmeligheter.

Det delte `App`-skjemaet er sjekket inn i `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`. Xcode Cloud bruker `ios/App/ci_scripts/ci_post_clone.sh` til å installere Node 22 ved behov, hente låste npm-avhengigheter, kjøre testene og bygge/synkronisere Capacitor før Swift-pakkene og arkivet bygges. Dette er nødvendig fordi `node_modules`, webressurser og genererte Capacitor-filer ikke ligger i Git. Scriptet kjører ingen produksjonsmigreringer. Swift-avhengighetene er låst i prosjektets `Package.resolved`.

Lokalt er det nye post-clone-skriptet kjørt fra start til slutt: 28 tester og webbygg passerer. Et nytt Release-simulatorbygg med det delte skjemaet viser BUILD SUCCEEDED. Første push-utløste GitHub-kjøring [39377204189](https://github.com/MyMiniMuffin/jnm-coaching/actions/runs/39377204189) viser Success (27 sekunder). Tilkobling av repo og aktivering av arbeidsflyt i Xcode Cloud føres inn her når dette er verifisert. Oppsettassistenten i Xcode står på tilkobling av kildekoderepoet; brukerbekreftelse på denne tilgangen er etterspurt.

GitHub-kontrollene endrer ikke eksisterende Netlify-deploy: en push til `main` kan starte både Netlify og kontrollene samtidig. Det er derfor fortsatt nødvendig å teste før push. Nye App Store-versjoner må velges og sendes til Apples vurdering selv om bygg/opplasting automatiseres.

## Manuell behandling av sletteforespørsler

Brukeren har valgt manuell behandling innen 30 dager. Passordbekreftet forespørsel og coach-kø er publisert i backend og i build 2. Nye bildeopplastinger plasseres under `jnm_coaching/users/<id>` for å kunne finne også avbrutte opplastinger.


1. Åpne coach-oversikten og finn forespørselen med frist. Ved behov: kontakt brukeren i den etablerte kanalen for å verifisere identiteten; ikke be om passord eller helseopplysninger i e-post.
2. Arkiver kontoen når behandlingen starter for å stoppe nye innsendinger under oppryddingen. Åpne «Vis bildeliste» før kontoen slettes. Listen henter alle rapporter, ikke bare de siste 150 som normalt vises i appen.
3. Slett alle bilder under brukerens mappe i Cloudinary, inkludert avbrutte opplastinger. Slett også eldre bilder fra listen som ligger direkte i `jnm_coaching`. Kontroller at et bilde ikke er nødvendig for en annen konto før du sletter det. Eldre avbrutte opplastinger i fellesmappen må undersøkes manuelt; de har ikke en lagret brukertilknytning.
4. Slett utøverens konto fra klientlisten. Kontoen, rapporter, gallerireferanser og perioder slettes med eksisterende brukeradministrasjon. Sletteforespørselen beholder frist og eventuell kontaktadresse til behandlingen er bekreftet.
5. Bekreft slettingen til brukerens oppgitte e-post eller etablerte kontaktkanal. Ikke send helseopplysninger eller bilder i bekreftelsen.
6. Velg «Bekreft fullført». Backend krever at kontoen er fjernet, og at du bekrefter bildesletting og beskjed til brukeren. Kontaktadressen fjernes fra forespørselen. For en administratorkonto må sletting utføres av en annen administrator med nødvendig tilgang; ikke fjern siste administrator uten en avtalt overtakelse.
7. Avstem faktisk backup-/loggretensjon og leverandøravtaler med personvernteksten. Ikke gjeninnfør slettede brukere ved gjenoppretting av backup.


## Referanser

- [Apple: App Review](https://developer.apple.com/app-store/review/)
- [Apple: krav til skjermbilder](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple: kontosletting](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
- [Capacitor: miljøoppsett](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor: native HTTP](https://capacitorjs.com/docs/apis/http)
