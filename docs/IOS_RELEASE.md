# JNM Coaching – iOS og App Store

## Status 19. oktober 2026

- Capacitor 8 med lokalt pakket React-grensesnitt og Swift Package Manager.
- Bundle ID: `no.jnmcoaching.app` (registrert som eksplisitt App ID under Apple-teamet).
- Appnavn: JNM Coaching. iOS-versjon 1.0: build 1 er i TestFlight, build 2 er klargjort lokalt med publiseringskravene.
- iOS 15 og nyere, iPhone og iPad.
- API: `https://jnmcoaching.no/.netlify/functions/*`, samme brukere og database som nettleseren.
- Native HTTP bruker eksisterende JWT-autorisasjon. Ingen database- eller Cloudinary-hemmeligheter pakkes i appen.
- iOS-vibrasjon og deling av bilde-/ZIP-eksporter er koblet til native plugins.
- Appikonet bygger på eksisterende ikon. Tillatelsestekster for bilder/kamera og privacy manifest for Filesystem er lagt inn.
- Nettleseren beholder same-origin API-kall og eksisterende PWA/web-push.
- Apple-push/APNs er ikke implementert. Web-push er deaktivert i native runtime.

Web-bygg, 23 automatiske tester og Capacitor-synk er verifisert. Xcode 27.1 er installert. Første native arm64-bygg og signert utviklingsbygg fullførte med BUILD SUCCEEDED 19. oktober 2026. Apple-teamet Perfect Morning AS er valgt i Xcode, og utviklingsprofilen er opprettet. Testappen er installert på Jonas sin iPhone 16 Pro (iOS 27.0.1) via trådløs sammenkobling. Oppstart og innloggingsskjerm er visuelt verifisert på fysisk iPhone. Automatisk fokus på brukernavnfeltet er slått av i native appen etter at første oppstart viste et forstørret/beskåret grensesnitt; nytt signert bygg er installert, og hele innloggingsskjermen vises korrekt. Brukeren har bekreftet vellykket innlogging på fysisk iPhone. Tastaturproblem ble meldt under første forsøk, men innlogging ble deretter fullført; årsaken til tastaturproblemet er ikke fastslått. Brukeren melder at funksjonene ser ut til å fungere etter innlogging; dette er en innledende funksjonstest, ikke full gjennomgang av alle scenarioer. Simulatorer er nå tilgjengelige, men appen er ikke testet på disse. Et Release-arkiv for versjon 1.0, build 1 er opprettet (ARCHIVE SUCCEEDED), og codesign-verifisering av app og innebygde rammeverk passerer. Distribusjonseksport med App Store-signering er fullført (EXPORT SUCCEEDED). Appoppføringen JNM Coaching er opprettet under Perfect Morning AS, med norsk hovedspråk og SKU `jnm-coaching-ios`. Opplasting av 1.0 (1) fullførte 19. oktober 2026 kl. 21:56 norsk tid med «Upload succeeded» og «Uploaded package is processing». Apple viser opplastingen som Complete. Krypteringsspørsmålet for build 1 er besvart med «None of the algorithms mentioned above», basert på innebygd OS-kryptering og kontroll av appkode/plugins. Intern gruppe «JNM intern testing» bruker manuell byggdistribusjon, og brukerens egen Apple-konto er lagt til som intern tester. Build 1.0 (1) er lagt til gruppen, og Apple viser «Testing» med 1 tester og 1 build. Testerstatus er bekreftet som «Invited». Installasjon gjennom TestFlight på telefonen er ennå ikke bekreftet. Byggloggene ligger lokalt i `/private/tmp/jnm-coaching-ios-build.log` og `/private/tmp/jnm-coaching-ios-device-build.log`.

## Første test på iPhone

1. Installer full Xcode fra Mac App Store (Capacitor 8 krever Xcode 26 eller nyere). Åpne Xcode og installer iOS-plattformen som tilbys.
2. Logg inn med Apple Developer-kontoen i Xcode → Settings → Accounts.
3. Kjør fra prosjektroten:

   ```sh
   npm install
   npm test
   npm run ios:sync
   npm run ios:open
   ```

4. Velg App-prosjektet og App-target → Signing & Capabilities. Velg riktig Team og automatisk signering. Kontroller bundle ID før første registrering.
5. Koble til iPhone, aktiver Developer Mode ved behov, velg telefonen som mål og trykk Run.
6. Test med en egen testbruker: første innlogging/passordbytte, eksisterende innlogging, ut-/innlogging, bakgrunn/forgrunn, hjem, matplan, treningsplan, rapport, bildefilvalg/kamera, bildevisning, bildeeksport og ZIP-eksport. Prøv også manglende nett og utløpt sesjon. Test både coach og utøver, liten iPhone, tastatur og iPad.

Kjør `npm run ios:sync` etter hver endring i React-koden før nytt native bygg. Appgrensesnittet leveres som del av App Store-bygget; innhold og brukerdata hentes fra serveren. Nettleserversjonen følger fortsatt vanlig Netlify-deploy.

`VITE_API_ORIGIN` kan settes ved bygg for en separat HTTPS-testserver. Standardverdien er produksjonsdomenet over. Bruk bare offentlige konfigurasjonsverdier i `VITE_*`.

## TestFlight

Lokalt arkiv: `ios/App/output/JNM-Coaching-1.0-1.xcarchive` (ignorert av Git). Arkiveringslogg: `/private/tmp/jnm-coaching-ios-archive.log`. Privacy manifest, bundle ID, versjon og buildnummer er kontrollert i arkivet. App Store Connect-oppføring: https://appstoreconnect.apple.com/apps/6824649558/distribution . Offentlig utviklernavn Perfect Morning AS er valgt med brukerens bekreftelse. Eksporten ligger i `ios/App/output/testflight/App.ipa`. Opplastingslogg: `/private/tmp/jnm-coaching-ios-upload.log`.


1. Opprett iOS-app i App Store Connect med samme bundle ID, navn, norsk språk og en egen SKU, for eksempel `jnm-coaching-ios`.
2. Kontroller signering, versjon og buildnummer i Xcode. Øk buildnummeret ved hver ny opplasting.
3. Velg Any iOS Device → Product → Archive → Validate App → Distribute App → App Store Connect.
4. Fyll ut eksport-/krypteringsspørsmål ut fra faktisk bruk. Ikke legg inn ubekreftede erklæringer i prosjektet.
5. Etter prosessering: legg til interne TestFlight-testere. Ekstern testing kan kreve Beta App Review.

## Må avklares og ferdigstilles før App Review

- **Personvern:** Implementert lokalt: `/personvern/`, `/support/` og informasjon inne i appen før og etter innlogging. Ansvarlig: Perfect Morning AS, kontakt@perfectmorning.dev. Publisering av sidene og registrering av URL-er hos Apple gjenstår. Erklæringen og App Privacy i App Store Connect må beskrive faktisk behandling av kontoopplysninger, vekt/rapporter, bilder og aktivitet, inkludert Neon/Netlify/Cloudinary og eksterne fonter. Privacy-manifestet for lokale fil-API-er erstatter ikke dette.
- **Kontosletting:** Implementert lokalt: passordbekreftet sletteforespørsel som lagres i databasen og vises i coach-oversikten. Brukeren har valgt manuell behandling innen 30 dager. Migrering 005 og backend må publiseres før dette kan brukes. Apple krever sletting i appen når en app støtter kontoopprettelse; ikke anta at coach-opprettede kontoer automatisk gir unntak. Se [Apples veiledning](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).
- **Coaching og betaling:** Brukeren har bekreftet at tjenesten er gratis og kun for inviterte brukere. Det er ingen kjøp eller abonnement i appen. Dette er lagt til i utkastet til butikktekst og review-notater. Se [App Review Guidelines, kapittel 3](https://developer.apple.com/app-store/review/guidelines/#business).
- **Review-tilgang:** Brukeren har opprettet `apple_review` og fullført første passordbytte. Demotilgang er lagt inn direkte i App Store Connect; passordet skal ikke lagres i repoet. Legg inn fiktive planer/rapporter slik at Apple kan prøve funksjonene. Ikke bruk klienters helseopplysninger eller bilder i skjermbilder eller demo.
- **Butikkinnhold:** Supportadresse/-URL, personvern-URL, beskrivelse, undertittel, kategori, aldersgrense, rettigheter og skjermbilder fra den faktiske appen på støttede enheter.
- **Native funksjoner:** Verifiser bilde-/ZIP-deling, tastatur og safe areas på fysisk telefon. Bygget er ikke ferdig kvalitetssikret før dette er gjort.
- **Varsler:** Implementer APNs med device-token-lagring og serversending hvis push skal være med i første versjon. Ikke beskriv iOS-push som en tilgjengelig funksjon før det er testet.

Apple vurderer funksjonalitet og opplevelse individuelt; Capacitor er ikke i seg selv en garanti for godkjenning. Se [minimum functionality og øvrige App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality).

## Referanser

- [Capacitor: miljøoppsett](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor: native HTTP](https://capacitorjs.com/docs/apis/http)
- [Capacitor: Filesystem og privacy manifest](https://capacitorjs.com/docs/apis/filesystem)
- [Apple: App Review](https://developer.apple.com/app-store/review/)

## Utgivelseskandidat: build 2

Release-arkivet `/private/tmp/JNM-Coaching-1.0-2.xcarchive` er bygget med ARCHIVE SUCCEEDED. Det inneholder støtte/personvern og sletteforespørsler. `ITSAppUsesNonExemptEncryption` er satt til false etter kontrollen av OS-basert kryptering. Dette bygget er ikke lastet opp ennå. Nettleser, backend og migrering 005 må publiseres samlet før den nye iOS-versjonen tas i bruk. Nye bildeopplastinger plasseres under `jnm_coaching/users/<id>` slik at også avbrutte opplastinger kan identifiseres ved sletting.

### Manuell behandling av sletteforespørsler

1. Åpne coach-oversikten og finn forespørselen med frist. Ved behov: kontakt brukeren i den etablerte kanalen for å verifisere identiteten; ikke be om passord eller helseopplysninger i e-post.
2. Arkiver kontoen når behandlingen starter for å stoppe nye innsendinger under oppryddingen. Åpne «Vis bildeliste» før kontoen slettes. Listen henter alle rapporter, ikke bare de siste 150 som normalt vises i appen.
3. Slett alle bilder under brukerens mappe i Cloudinary, inkludert avbrutte opplastinger. Slett også eldre bilder fra listen som ligger direkte i `jnm_coaching`. Kontroller at et bilde ikke er nødvendig for en annen konto før du sletter det. Eldre avbrutte opplastinger i fellesmappen må undersøkes manuelt; de har ikke en lagret brukertilknytning.
4. Slett utøverens konto fra klientlisten. Kontoen, rapporter, gallerireferanser og perioder slettes med eksisterende brukeradministrasjon. Sletteforespørselen beholder frist og eventuell kontaktadresse til behandlingen er bekreftet.
5. Bekreft slettingen til brukerens oppgitte e-post eller etablerte kontaktkanal. Ikke send helseopplysninger eller bilder i bekreftelsen.
6. Velg «Bekreft fullført». Backend krever at kontoen er fjernet, og at du bekrefter bildesletting og beskjed til brukeren. Kontaktadressen fjernes fra forespørselen. For en administratorkonto må sletting utføres av en annen administrator med nødvendig tilgang; ikke fjern siste administrator uten en avtalt overtakelse.
7. Avstem faktisk backup-/loggretensjon og leverandøravtaler med personvernteksten. Ikke gjeninnfør slettede brukere ved gjenoppretting av backup.
