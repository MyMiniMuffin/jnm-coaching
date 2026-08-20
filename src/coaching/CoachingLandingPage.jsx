import React, { useState } from 'react';
import {
    ArrowDown,
    ArrowRight,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Dumbbell,
    Loader2,
    MessageCircle,
    Utensils,
} from 'lucide-react';

const benefits = [
    {
        icon: Dumbbell,
        number: '01',
        title: 'En plan tilpasset deg',
        description: 'Treningen bygges rundt målene dine, utgangspunktet ditt og tiden du faktisk har tilgjengelig.',
    },
    {
        icon: Utensils,
        number: '02',
        title: 'Kosthold med rom for livet',
        description: 'Tydelige rammer som gjør det enklere å ta gode valg, uten at hverdagen må settes på pause.',
    },
    {
        icon: MessageCircle,
        number: '03',
        title: 'Oppfølging som holder retningen',
        description: 'Du rapporterer underveis, får konkrete tilbakemeldinger og planen justeres når det er nødvendig.',
    },
];

const process = [
    {
        number: '1',
        title: 'Du sender en kort søknad',
        description: 'Fortell litt om målet ditt, situasjonen din og hva du ønsker hjelp med.',
    },
    {
        number: '2',
        title: 'Vi avklarer om det passer',
        description: 'Du blir kontaktet for en uforpliktende prat om behov, forventninger og veien videre.',
    },
    {
        number: '3',
        title: 'Du får opplegget ditt',
        description: 'Planer og oppfølging samles i JNM-appen, slik at du alltid vet hva du skal gjøre.',
    },
];

const encodeForm = (formData) => new URLSearchParams(formData).toString();

const ApplicationForm = () => {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus('submitting');
        setError('');

        const form = event.currentTarget;
        const formData = Object.fromEntries(new FormData(form).entries());

        try {
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: encodeForm(formData),
            });

            if (!response.ok) throw new Error('Submission failed');
            form.reset();
            setStatus('success');
        } catch {
            setError('Noe gikk galt. Prøv igjen om litt.');
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-surface-200 bg-white px-6 py-12 text-center shadow-sm" role="status">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-success/10 text-success">
                    <CheckCircle2 size={28} aria-hidden="true" />
                </div>
                <h3 className="mb-3 text-2xl font-display text-ink">Søknaden er sendt</h3>
                <p className="max-w-sm text-ink-muted">
                    Takk for at du tok kontakt. Du hører fra JNM Coaching så snart søknaden er lest.
                </p>
            </div>
        );
    }

    return (
        <form
            name="coaching-application"
            method="POST"
            data-netlify="true"
            data-netlify-honeypot="bot-field"
            onSubmit={handleSubmit}
            className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm sm:p-7"
        >
            <input type="hidden" name="form-name" value="coaching-application" />
            <p className="hidden">
                <label>Ikke fyll ut dette feltet: <input name="bot-field" /></label>
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink-muted">Navn</label>
                    <input id="name" name="name" type="text" autoComplete="name" required className="coaching-field" placeholder="Fornavn og etternavn" />
                </div>
                <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink-muted">E-post</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className="coaching-field" placeholder="navn@eksempel.no" />
                </div>
                <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium text-ink-muted">Telefon <span className="font-normal text-ink-faint">(valgfritt)</span></label>
                    <input id="phone" name="phone" type="tel" autoComplete="tel" className="coaching-field" placeholder="Telefonnummer" />
                </div>
                <div>
                    <label htmlFor="instagram" className="mb-2 block text-sm font-medium text-ink-muted">Instagram <span className="font-normal text-ink-faint">(valgfritt)</span></label>
                    <input id="instagram" name="instagram" type="text" autoComplete="off" className="coaching-field" placeholder="@brukernavn" />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor="goal" className="mb-2 block text-sm font-medium text-ink-muted">Hva ønsker du hjelp med?</label>
                    <textarea id="goal" name="goal" required rows="4" className="coaching-field resize-y" placeholder="Fortell kort om målet ditt og hva du har prøvd tidligere." />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor="why-now" className="mb-2 block text-sm font-medium text-ink-muted">Hvorfor ønsker du coaching nå?</label>
                    <textarea id="why-now" name="why-now" required rows="4" className="coaching-field resize-y" placeholder="Hva gjør at tidspunktet føles riktig?" />
                </div>
            </div>

            {error && (
                <p className="mt-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={status === 'submitting'}
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 font-medium text-white shadow-sm transition-all duration-200 hover:bg-ink/85 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
                {status === 'submitting' ? (
                    <><Loader2 className="animate-spin" size={19} aria-hidden="true" /> Sender søknad</>
                ) : (
                    <>Send søknad <ArrowRight size={19} aria-hidden="true" /></>
                )}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-ink-faint">
                Opplysningene brukes kun til å vurdere søknaden og kontakte deg.
            </p>
        </form>
    );
};

const CoachingLandingPage = () => (
    <div className="min-h-screen overflow-hidden bg-surface-50 text-ink">
        <header className="coaching-header sticky top-0 z-40 border-b border-surface-200/80">
            <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
                <a href="/coaching/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4" aria-label="JNM Coaching – til toppen">
                    <img src="/jnm-coaching-logo.svg" alt="" className="h-10 w-10 rounded-xl" />
                    <span className="text-base font-semibold tracking-[-0.01em]">JNM Coaching</span>
                </a>
                <a href="#soknad" className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                    Søk om coaching <ArrowRight size={16} aria-hidden="true" />
                </a>
            </div>
        </header>

        <main>
            <section className="coaching-hero relative">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:px-8 lg:pb-32 lg:pt-28">
                    <div className="relative z-10 max-w-2xl animate-fade-in">
                        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-accent">Personlig online coaching</p>
                        <h1 className="max-w-2xl text-[3rem] leading-[0.98] font-display text-ink sm:text-[4.4rem] lg:text-[5rem]">
                            En plan du faktisk kan følge.
                        </h1>
                        <p className="mt-7 max-w-xl text-lg leading-8 text-ink-muted sm:text-xl">
                            For deg som vil få struktur på trening og kosthold, med tydelig retning og personlig oppfølging underveis.
                        </p>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <a href="#soknad" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 font-medium text-white shadow-sm transition-all hover:bg-ink/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                                Søk om coaching <ArrowRight size={19} aria-hidden="true" />
                            </a>
                            <a href="#opplegget" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg px-5 py-3.5 font-medium text-ink-muted transition-colors hover:bg-surface-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                                Se hvordan det fungerer <ArrowDown size={17} aria-hidden="true" />
                            </a>
                        </div>
                        <p className="mt-6 text-sm text-ink-faint">Ingen raske løsninger. Bare tydelige prioriteringer og jevn oppfølging.</p>
                    </div>

                    <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end" aria-label="Dette inngår i oppfølgingen">
                        <div className="coaching-orbit" aria-hidden="true" />
                        <div className="relative rounded-xl border border-surface-200 bg-white p-5 shadow-[0_24px_70px_rgba(23,23,23,0.10)] sm:p-7">
                            <div className="mb-7 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-faint">Ditt opplegg</p>
                                    <h2 className="mt-1 text-2xl font-display">Alt samlet på ett sted</h2>
                                </div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-ink">
                                    <ClipboardCheck size={21} aria-hidden="true" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                {[
                                    ['Treningsplan', 'Tilpasset nivå og hverdag'],
                                    ['Kostholdsplan', 'Tydelige og praktiske rammer'],
                                    ['Rapportering', 'Tilbakemelding og justering'],
                                ].map(([title, description]) => (
                                    <div key={title} className="flex items-start gap-3 rounded-xl px-2 py-4">
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                                            <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                                        </span>
                                        <div>
                                            <p className="font-semibold text-ink">{title}</p>
                                            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 rounded-xl bg-surface-50 p-4">
                                <p className="text-sm leading-6 text-ink-muted">
                                    Målet er at du alltid skal vite <span className="font-semibold text-ink">hva du skal gjøre</span> og hvorfor.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="opplegget" className="scroll-mt-24 bg-white py-20 sm:py-24">
                <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
                    <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
                        <div>
                            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent">Opplegget</p>
                            <h2 className="max-w-md text-4xl font-display sm:text-5xl">Struktur som gjør fremgang enklere.</h2>
                            <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
                                Du trenger ikke enda en perfekt plan som bare fungerer på gode dager. Du trenger et opplegg som tåler en vanlig hverdag og kan justeres underveis.
                            </p>
                        </div>
                        <div className="divide-y divide-surface-200 border-y border-surface-200">
                            {benefits.map(({ icon: Icon, number, title, description }) => (
                                <article key={number} className="grid gap-4 py-7 sm:grid-cols-[52px_1fr_auto] sm:items-start sm:gap-5 sm:py-8">
                                    <span className="text-sm font-semibold text-accent">{number}</span>
                                    <div>
                                        <h3 className="text-xl font-semibold text-ink">{title}</h3>
                                        <p className="mt-2 max-w-xl leading-7 text-ink-muted">{description}</p>
                                    </div>
                                    <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-ink-muted sm:flex">
                                        <Icon size={20} aria-hidden="true" />
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-ink py-20 text-white sm:py-24">
                <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-6 lg:grid-cols-2 lg:gap-24 lg:px-8">
                    <div>
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#D89A7D]">Hvem det passer for</p>
                        <h2 className="max-w-lg text-4xl font-display sm:text-5xl">For deg som er klar for å gjøre jobben — med støtte.</h2>
                    </div>
                    <div className="space-y-5 self-end">
                        {[
                            'Du vil ha en tydelig plan, men trenger hjelp til å gjøre den realistisk.',
                            'Du ønsker oppfølging og ansvarlighet uten dårlig samvittighet eller unødvendig press.',
                            'Du er villig til å være ærlig om hva som fungerer, slik at opplegget kan justeres.',
                            'Du ønsker varige vaner fremfor en rask løsning du ikke kan holde over tid.',
                        ].map(item => (
                            <div key={item} className="flex gap-3">
                                <Check className="mt-1 shrink-0 text-[#D89A7D]" size={18} strokeWidth={2.5} aria-hidden="true" />
                                <p className="leading-7 text-white/75">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-surface-50 py-20 sm:py-24">
                <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl text-center">
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent">Fra søknad til oppstart</p>
                        <h2 className="text-4xl font-display sm:text-5xl">En enkel vei inn.</h2>
                        <p className="mt-5 text-lg leading-8 text-ink-muted">Ingen forpliktelser før vi vet at dette er riktig for begge.</p>
                    </div>
                    <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-5">
                        {process.map(({ number, title, description }) => (
                            <article key={number} className="relative border-t border-surface-300 pt-7 md:px-4 md:first:pl-0 md:last:pr-0">
                                <span className="absolute -top-4 left-0 flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-white md:left-4 md:first:left-0">{number}</span>
                                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                                <p className="mt-3 leading-7 text-ink-muted">{description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white py-20 sm:py-24">
                <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:px-8">
                    <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl bg-surface-100 p-8 sm:min-h-[400px]">
                        <div className="coaching-about-mark" aria-hidden="true" />
                        <img src="/jnm-coaching-logo.svg" alt="JNM Coaching" className="relative h-28 w-28 rounded-[2.25rem] shadow-lg sm:h-36 sm:w-36" />
                    </div>
                    <div>
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent">JNM Coaching</p>
                        <h2 className="max-w-xl text-4xl font-display sm:text-5xl">Et samarbeid, ikke et standardopplegg.</h2>
                        <div className="mt-7 max-w-xl space-y-5 text-base leading-8 text-ink-muted">
                            <p>
                                God coaching handler ikke bare om å skrive en plan. Den handler om å forstå hva som står i veien, finne prioriteringene som betyr mest og følge opp det som faktisk skjer mellom rapportene.
                            </p>
                            <p>
                                Derfor skal opplegget være tydelig nok til å gi retning, men fleksibelt nok til å fungere i livet ditt. Du gjør jobben. JNM Coaching hjelper deg å holde kursen.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="soknad" className="scroll-mt-20 bg-surface-50 py-20 sm:py-24">
                <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
                    <div>
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-accent">Søk om coaching</p>
                        <h2 className="max-w-md text-4xl font-display sm:text-5xl">Klar for å finne ut om det passer?</h2>
                        <p className="mt-6 max-w-md text-lg leading-8 text-ink-muted">
                            Svar kort på spørsmålene. Søknaden er uforpliktende og brukes som utgangspunkt for den første praten.
                        </p>
                        <div className="mt-8 flex items-start gap-3 rounded-xl bg-surface-100 p-4 text-sm leading-6 text-ink-muted">
                            <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} aria-hidden="true" />
                            <p>Du trenger ikke ha alt på plass før du søker. Det holder at du vet at du ønsker en endring.</p>
                        </div>
                    </div>
                    <ApplicationForm />
                </div>
            </section>
        </main>

        <footer className="border-t border-surface-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <img src="/jnm-coaching-logo.svg" alt="" className="h-8 w-8 rounded-lg" />
                    <span>© {new Date().getFullYear()} JNM Coaching</span>
                </div>
                <a href="/" className="w-fit rounded-md text-ink-muted underline decoration-surface-300 underline-offset-4 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    Allerede kunde? Åpne appen
                </a>
            </div>
        </footer>
    </div>
);

export default CoachingLandingPage;
