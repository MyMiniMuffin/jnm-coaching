# JNM Coaching – designstandard

Dette dokumentet er fasiten for visuelle valg i appen. Målet er et rolig, varmt og profesjonelt grensesnitt som føles personlig uten å bli dekorativt eller «AI-designet».

Ved nye komponenter skal eksisterende mønstre i `src/components/ui.jsx` gjenbrukes. Designverdier som brukes i kode skal hentes fra `tailwind.config.js` eller CSS-variablene i `src/index.css` fremfor å introdusere nye enkeltverdier.

## 1. Designretning

JNM Coaching skal oppleves som:

- rolig og oversiktlig
- varm, men ikke beige overalt
- personlig, men fortsatt profesjonell
- kompakt nok til at innhold kan skannes raskt
- tydelig uten mange rammer, linjer eller effekter

Innhold og handlinger skal ha høyere visuell prioritet enn dekor. Bruk luft til å gruppere innhold før du legger til en linje, ramme eller bakgrunn.

### Unngå

- mange gradienter, glødende flater eller fargede kort på samme skjerm
- ramme rundt hvert enkelt element
- store overskrifter i innholdstette visninger
- unødvendig stor avstand mellom rader
- flere ulike hjørneradier i samme komponent
- vilkårlige hex-farger når en eksisterende designfarge dekker behovet
- serif-skrift på vanlig brødtekst, skjemafelt eller tabellinnhold
- animasjon som forsinker eller forstyrrer en handling

## 2. Farger

Fargepaletten er definert i `tailwind.config.js`.

| Rolle | Tailwind | Verdi | Bruk |
| --- | --- | --- | --- |
| Hovedbakgrunn | `surface-50` | `#F7F7F4` | Side, felt og lyse flater |
| Sekundær flate | `surface-100` | `#F1F0EC` | Sekundære knapper, valgte områder og gruppering |
| Kant / skille | `surface-200` | `#E4E1DA` | Subtile rammer og skillelinjer |
| Tydelig kant | `surface-300` | `#CCC7BC` | Hover eller felt som trenger mer kontrast |
| Primær tekst | `ink` | `#171717` | Overskrifter, innhold og primærknapper |
| Sekundær tekst | `ink-muted` | `#525252` | Beskrivelser og etiketter |
| Svak tekst | `ink-faint` | `#A3A3A3` | Metadata og inaktive ikoner |
| Aksent | `accent` | `#B5603A` | Fokus, lenker og utvalgte handlinger |
| Aksent hover | `accent-hover` | `#9B4E2A` | Hover på aksentfarge |
| Suksess | `success` | `#16A34A` | Bekreftet eller positiv status |
| Advarsel | `warning` | `#CA8A04` | Noe som krever oppmerksomhet |
| Feil | `error` | `#DC2626` | Feil og destruktive handlinger |

### Fargeregler

- Primær handling er som hovedregel mørk (`bg-ink text-white`), ikke aksentfarget.
- Aksentfargen brukes sparsomt til fokus, lenker og små detaljer.
- Statusfarger skal alltid kombineres med tekst eller ikon. Farge alene skal ikke bære betydning.
- Flater skal normalt være hvite eller `surface-50/100`. Tonede flater brukes kun når de forklarer status eller hierarki.
- Maks én tydelig mørk eller dekorativ hero-flate per skjerm.

## 3. Typografi

### Skrifter

- `font-sans`: Outfit. Brukes til all funksjonell tekst, brødtekst, felt, knapper, tabeller og navigasjon.
- `font-display`: Instrument Serif. Brukes kun til sidetitler, utvalgte hovedoverskrifter og enkelte tomtilstander.

Serif er en aksent, ikke standardskriften for overskrifter. I kompakte eller datatunge komponenter skal også overskrifter bruke Outfit.

### Størrelser

| Nivå | Anbefalt klasse | Bruk |
| --- | --- | --- |
| Sidetittel | `text-[1.7rem] font-display` | Én hovedtittel øverst på skjermen |
| Hero-tall/tittel | `text-2xl` | Viktigste nøkkeltall eller kort hero-tekst |
| Seksjonstittel | `text-base font-semibold` | Vanlige innholdsseksjoner |
| Kompakt seksjonstittel | `text-[1.05rem] font-semibold` | Matplan, lister og tette flater |
| Brødtekst | `text-sm leading-5` eller `text-base` | Velg `text-sm` i innholdstette visninger |
| Etikett | `text-sm font-medium text-ink-muted` | Skjemafelt og kontroller |
| Metadata | `text-xs text-ink-muted` | Dato, status og sekundær informasjon |
| Mikroetikett | `text-[10px]`–`text-[11px]` | Kun navigasjon eller svært kompakt metadata |

### Typografiregler

- Bruk `font-semibold` for vekt og hierarki; unngå mange forskjellige skriftstørrelser.
- Brødtekst skal normalt bruke `leading-5` eller standard linjehøyde 1.5.
- Store tekstblokker bør ikke være bredere enn appens innholdskolonne.
- Tall som sammenlignes i kolonner skal bruke `tabular-nums`.
- Norsk tekst skal være kort, konkret og skrevet i vanlig setningskasus.

## 4. Avstand og layout

Appen er mobil først og bruker normalt en sentrert innholdskolonne med `max-w-md`.

### Standardavstander

- Skjermkant: `px-4` eller `px-5`
- Kortinnhold: `p-4` eller `p-5`
- Mellom hovedseksjoner: `space-y-5`
- Mellom elementer i en seksjon: `gap-3` eller `space-y-3`
- Mellom tett relaterte elementer: `gap-2`
- Kompakte lister: `py-1.5`, `leading-5` og maks `space-y-0.5`
- Skjemafelt: `space-y-4`

Bruk 4 px-skalaen som utgangspunkt. Verdier som 6, 10, 14 og 20 px kan brukes når de allerede finnes i mønsteret, men ikke introduser tilfeldige avstander for å «finjustere» én skjerm.

### Gruppering

Prioritert rekkefølge for å vise gruppering:

1. avstand
2. typografi
3. svak bakgrunnsforskjell
4. subtil ramme eller skillelinje

Ikke bruk både stor avstand, ramme, skygge og tonet bakgrunn for samme gruppering.

## 5. Former, rammer og skygger

- `rounded-lg` brukes på knapper og mindre kontroller.
- `rounded-xl` brukes på kort, felt, modaler og større interaktive flater.
- `rounded-full` er for avatarer, statusprikker og ekte pillekontroller.
- Standard ramme er `border border-surface-200`.
- Skillelinjer skal være få og gjerne bruke redusert opasitet, for eksempel `border-surface-200/80`.
- Skygger skal være myke og svake. Bruk eksisterende `Card`, `surface-card` eller knappestiler.
- Ikke legg skygge på alle underkomponenter inne i et kort.

## 6. Komponenter

### Knapper

Bruk `Button` fra `src/components/ui.jsx`.

- `primary`: hovedhandlingen på flaten. Normalt bare én per handlingsgruppe.
- `secondary`: trygg alternativ handling.
- `ghost`: lav prioritet, verktøy eller avbryt.
- `danger`: destruktive handlinger.
- Ikon og tekst har `gap-2`; ikonet er vanligvis 16–20 px.
- Klikkeflate skal være minst 40 × 40 px, og helst 44 × 44 px på mobil.

### Ikonknapper

Bruk `IconButton`. Alle ikonknapper må ha et beskrivende `aria-label`. Lucide er standard ikonbibliotek; bland ikke inn ikoner med en annen visuell stil.

### Kort

Bruk `Card` for en selvstendig innholdsgruppe eller interaktiv enhet. Ikke bruk kort bare for å gi hvert avsnitt en bakgrunn. På samme skjerm skal flate lister og kort ikke konkurrere om samme hierarkinivå.

### Skjemafelt

Bruk `TextField`, `SelectField`, `InputLabel`, `ToggleGroup` og `SegmentedControl` der de passer.

- Etikett står over feltet.
- Standard feltbakgrunn er `surface-50`.
- Fokus bruker `ring-2 ring-accent border-accent`.
- Feilmelding står rett under feltet og kobles visuelt til feltet.
- Placeholder er et eksempel, ikke en erstatning for etikett når betydningen kan være uklar.

### Modaler

- Mørk, dempet bakgrunn med svak blur.
- `max-w-sm` for korte oppgaver.
- `p-6`, tydelig tittel og synlig lukkeknapp.
- Én primær handling og én tydelig vei ut.
- Escape skal lukke når det er trygt.

### Badges og status

Badges er metadata, ikke knapper. Bruk de eksisterende variantene og korte etiketter. Ikke fyll en hel skjerm med badges når vanlig tekst eller en liste er enklere.

## 7. Planvisninger

Matplan og treningsplan skal være separate både i data, redigering og presentasjon.

### Matplan

- Skal være tett, enkel og rask å skanne.
- Måltidsoverskrift: omtrent `text-[1.05rem] font-semibold`.
- Matvarer: `text-sm leading-5` med kompakte rader (`py-1.5`).
- Bruk en subtil punktmarkør, ikke kort eller linje rundt hver matvare.
- Avstand skal skille måltider; ikke legg inn skillelinje mellom hver rad.

### Treningsplan

- Øvelse, sett og reps skal være egne felter.
- Bruk et stabilt kolonnemønster for «Øvelse / Sett / Reps» når dataene finnes.
- Treningsdager kan ha mer visuell vekt enn måltider, men skal fortsatt være nøkterne.
- Gangetegnet skal ha god kontrast og nok avstand til tallene.

### Redigering

- Strukturert redigering er standard; brukeren skal ikke behøve å redigere Markdown.
- Redigeringsvisningen skal ligne lesevisningen nok til at resultatet er forutsigbart.
- Legg til og slett skal være tilgjengelig per relevant nivå uten å dominere raden.

## 8. Navigasjon og responsivitet

- Mobil er primær flate; verifiser alltid ved 375 px bredde.
- Ingen horisontal scrolling i hovedinnholdet.
- Fast bunnnavigasjon må ta hensyn til safe area.
- Sticky toppfelt og bunnnavigasjon skal ikke dekke innhold eller fokusert felt.
- Desktop kan gi mer marg og en avgrenset appkolonne, men skal ikke endre informasjonsarkitekturen.
- Hovedinnhold skal ha nok bunnpadding til å gå klar av navigasjonen, normalt `pb-32`.

## 9. Bevegelse og tilbakemelding

- Overganger er korte: omtrent 150–300 ms.
- Bruk bevegelse til å forklare tilstandsendring, navigasjon eller direkte respons.
- Unngå kontinuerlig eller rent dekorativ animasjon.
- Trykkrespons kan bruke en svak skalering, normalt ikke mindre enn `scale-[0.98]` for vanlige knapper.
- `prefers-reduced-motion` skal alltid respekteres.
- Lagring, lasting, tomtilstand, feil og fullført handling skal ha synlig tilbakemelding.

## 10. Tilgjengelighet

- Tekst og interaktive elementer skal ha tydelig kontrast mot bakgrunnen.
- Alle kontroller skal kunne brukes med tastatur.
- Fokusmarkering skal aldri fjernes uten en synlig erstatning.
- Ikonknapper og kontroller uten synlig etikett må ha `aria-label`.
- Modaler bruker `role="dialog"`, `aria-modal="true"` og koblet tittel.
- Ikke bruk `ink-faint` til viktig informasjon eller vanlig brødtekst.
- Bilder skal ha meningsfull alternativtekst, eller tom alternativtekst når de kun er dekorative.
- Feil skal forklares med tekst og ikke bare rød farge.

## 11. Arbeidsflyt for nye skjermer

Før en ny skjerm eller komponent godkjennes:

- gjenbruker den komponentene i `src/components/ui.jsx`?
- bruker den eksisterende farge-, radius- og typografiskala?
- er det tydelig hva som er primær handling?
- kan noen rammer, skygger eller bakgrunner fjernes?
- er tekststørrelse og radavstand tilpasset innholdstettheten?
- fungerer den ved 375 px uten horisontal scrolling?
- fungerer fokus, tastatur og reduced motion?
- er matplan og treningsplan fortsatt separate der de berøres?

Hvis et nytt designmønster faktisk er nødvendig, skal det først legges til som en gjenbrukbar komponent eller token. Oppdater deretter dette dokumentet slik at kode og designstandard ikke glir fra hverandre.
