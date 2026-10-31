import React from 'react';

export const SUPPORT_EMAIL = 'kontakt@perfectmorning.dev';
export const PRIVACY_UPDATED = '31. oktober 2026';

export const SupportContent = () => (
    <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
        <p>JNM Coaching er en gratis tjeneste for inviterte brukere. Kontoen opprettes av coachen din. Det finnes ingen kjøp eller abonnement i appen.</p>
        <p>Trenger du hjelp med innlogging, planer, rapporter eller bilder? Kontakt Perfect Morning AS på <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
        <p>Oppgi gjerne hvilken enhet du bruker og hva som skjer. Ikke send passord, helseopplysninger eller fremgangsbilder i en vanlig e-post.</p>
        <p>Du kan også kontakte oss for innsyn, retting, eksport eller sletting av opplysningene dine.</p>
    </div>
);

export const PrivacyContent = () => (
    <div className="space-y-5 text-sm leading-relaxed text-ink-muted">
        <p>Sist oppdatert: {PRIVACY_UPDATED}. Denne informasjonen gjelder JNM Coaching-appen og innlogget bruk på jnmcoaching.no.</p>
        <section><h3 className="font-semibold text-ink mb-1">Ansvarlig og kontakt</h3><p>Perfect Morning AS er ansvarlig for behandlingen av personopplysninger i JNM Coaching. Kontakt: <a className="text-accent underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Opplysninger i tjenesten</h3><p>Vi lagrer navn, brukernavn, en intern bruker-ID, rolle og passord i hashet form. Ved sletteforespørsler lagrer vi tidspunkt og en valgfri kontaktadresse for bekreftelse. Vi lagrer også planer, oppfølgingsperioder og det du eller coachen din legger inn: vekt, mål, søvn, energi, treningsaktivitet, skritt, kostholdsetterlevelse, kosttilskudd, kommentarer og bilder. Flere av disse opplysningene kan være helseopplysninger. Siste aktivitet i appen registreres for å gi coachen oversikt over oppfølgingen.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Hvorfor opplysningene brukes</h3><p>Opplysningene brukes til innlogging, personlig oppfølging, planer, rapporter og visning av fremgang. Du trenger ikke laste opp bilder for å bruke appen. Informasjonen er tilgjengelig for deg og autoriserte coacher; den publiseres ikke som en offentlig profil eller et sosialt nettverk.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Lagring og leverandører</h3><p>Nettstedet og API-et kjører på en server hos Oracle Cloud i Sverige, Neon lagrer kontodata, rapporter og innsendte skjemaer, og Cloudinary lagrer bilder. Appen laster skrifttyper fra Google Fonts. Ved nettverkskall mottar leverandørene teknisk informasjon, som IP-adresse. Leverandørenes underliggende behandling kan skje utenfor Norge/EØS. Innlogging og en lokal kopi av appdata lagres på enheten for å beholde sesjonen og gjøre appen raskere. Denne lokale kopien slettes når du logger ut.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Varsler, reklame og sporing</h3><p>Vi bruker ikke annonsesporing eller selger personopplysningene dine. Coachen kan velge å aktivere varsler om nye rapporter. På nett lagres et nettleserabonnement; i iOS-appen lagres et enhetstoken hos Apple Push Notification-tjenesten for å levere varslene. Varslene brukes kun til appfunksjonalitet.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Lagringstid og sletting</h3><p>Kontodata og historikk beholdes så lenge kontoen finnes, også når den er pauset. Du kan be om sletting fra «Konto og hjelp» i appen. Forespørselen fullføres manuelt innen 30 dager og omfatter kontoen, planer, rapporter og tilknyttede bilder. Vi bekrefter når slettingen er fullført, til e-postadressen du oppgir eller gjennom kontaktkanalen du bruker med coachen. Sikkerhetskopier og tekniske logger kan ha egne lagringsperioder hos leverandørene. Opplysningene skal ikke tas tilbake i aktiv bruk etter sletting.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Dine valg og rettigheter</h3><p>Du kan be om innsyn, retting, eksport og sletting ved å kontakte oss. Arkivering eller pause av en konto sletter ikke historikken. Ikke del innloggingen din med andre. Dersom du bruker appen på en delt enhet, bør du logge ut når du er ferdig.</p></section>
        <section><h3 className="font-semibold text-ink mb-1">Spørsmål om personvern</h3><p>Send spørsmål til {SUPPORT_EMAIL}. Vi kan be deg bekrefte identiteten din før vi utleverer eller sletter personopplysninger. Du kan klage på behandlingen til Datatilsynet.</p></section>
    </div>
);
