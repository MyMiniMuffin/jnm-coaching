import React, { useState } from 'react';
import { Instagram, Loader2 } from 'lucide-react';

const pillars = [
    {
        title: 'Trening',
        description: 'En plan bygget rundt nivået ditt, målet ditt og tiden du faktisk har.',
    },
    {
        title: 'Kosthold',
        description: 'Tydelige rammer som fungerer i hverdagen, uten rigide regler.',
    },
    {
        title: 'Oppfølging',
        description: 'Konkrete tilbakemeldinger og justeringer når livet eller behovene endrer seg.',
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
            <div className="flex min-h-[360px] flex-col justify-center border-t border-black/10 py-16" role="status">
                <h3 className="text-4xl font-semibold tracking-[-0.045em] text-ink sm:text-5xl">Søknaden er sendt.</h3>
                <p className="mt-5 max-w-md text-lg leading-8 text-ink-muted">
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
            className="border-t border-black/10 pt-10 sm:pt-12"
        >
            <input type="hidden" name="form-name" value="coaching-application" />
            <p className="hidden">
                <label>Ikke fyll ut dette feltet: <input name="bot-field" /></label>
            </p>

            <div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
                <div>
                    <label htmlFor="name" className="coaching-label">Navn</label>
                    <input id="name" name="name" type="text" autoComplete="name" required className="coaching-field" />
                </div>
                <div>
                    <label htmlFor="email" className="coaching-label">E-post</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className="coaching-field" />
                </div>
                <div>
                    <label htmlFor="phone" className="coaching-label">Telefon <span>valgfritt</span></label>
                    <input id="phone" name="phone" type="tel" autoComplete="tel" className="coaching-field" />
                </div>
                <div>
                    <label htmlFor="instagram" className="coaching-label">Instagram <span>valgfritt</span></label>
                    <input id="instagram" name="instagram" type="text" autoComplete="off" className="coaching-field" />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor="goal" className="coaching-label">Hva ønsker du å oppnå?</label>
                    <textarea id="goal" name="goal" required rows="3" className="coaching-field resize-y" />
                </div>
                <div className="sm:col-span-2">
                    <label htmlFor="why-now" className="coaching-label">Hvorfor nå?</label>
                    <textarea id="why-now" name="why-now" required rows="3" className="coaching-field resize-y" />
                </div>
            </div>

            {error && <p className="mt-5 text-sm text-error" role="alert">{error}</p>}

            <button
                type="submit"
                disabled={status === 'submitting'}
                className="coaching-button mt-8 w-full sm:w-auto"
            >
                {status === 'submitting' ? (
                    <><Loader2 className="animate-spin" size={18} aria-hidden="true" /> Sender</>
                ) : 'Send søknad'}
            </button>
        </form>
    );
};

const CoachingLandingPage = () => (
    <div className="coaching-page min-h-screen overflow-hidden bg-white text-ink">
        <header className="coaching-header sticky top-0 z-40">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
                <a
                    href="/coaching/"
                    className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4"
                    aria-label="JNM Coaching – til toppen"
                >
                    <img src="/jnm-coaching-logo.svg" alt="" className="h-8 w-8 rounded-lg" />
                    <span className="text-sm font-semibold tracking-[-0.02em]">JNM Coaching</span>
                </a>
                <a href="#soknad" className="coaching-nav-link">Søk nå</a>
            </div>
        </header>

        <main>
            <section className="coaching-hero flex min-h-[calc(100svh-4rem)] items-center">
                <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
                    <div className="max-w-6xl">
                        <h1 className="coaching-title text-[3.65rem] font-semibold leading-[0.92] tracking-[-0.065em] sm:text-[6.4rem] lg:text-[8.25rem]">
                            En plan du faktisk kan følge<span className="coaching-accent">.</span>
                        </h1>
                        <p className="mt-8 max-w-2xl text-xl leading-8 text-black/60 sm:mt-10 sm:text-2xl sm:leading-9">
                            Personlig coaching for trening, kosthold og fremgang som varer.
                        </p>
                        <a href="#soknad" className="coaching-button mt-9 sm:mt-11">Søk om coaching</a>
                    </div>
                </div>
            </section>

            <section id="opplegget" className="scroll-mt-20 bg-surface-50 py-24 sm:py-32 lg:py-40">
                <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
                    <h2 className="max-w-5xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                        Tydelig retning. Tilpasset livet ditt.
                    </h2>

                    <div className="mt-20 grid border-t border-black/15 sm:mt-28 md:grid-cols-3">
                        {pillars.map(({ title, description }) => (
                            <article key={title} className="coaching-pillar border-b border-black/15 py-8 md:border-b-0 md:border-l md:py-10 md:px-8 md:first:border-l-0 md:first:pl-0 md:last:pr-0">
                                <h3 className="text-2xl font-semibold tracking-[-0.035em]">{title}</h3>
                                <p className="mt-4 max-w-sm text-base leading-7 text-black/60">{description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="coaching-statement py-28 text-white sm:py-36 lg:py-44">
                <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
                    <p className="max-w-5xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                        Bygget for deg.<br /><span>Fulgt opp av meg.</span>
                    </p>
                </div>
            </section>

            <section id="soknad" className="scroll-mt-16 bg-white py-24 sm:py-32 lg:py-40">
                <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-12">
                    <div>
                        <h2 className="max-w-lg text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
                            Klar for å starte?
                        </h2>
                        <p className="mt-6 max-w-md text-lg leading-8 text-black/60">
                            Send en kort, uforpliktende søknad. Så finner vi ut om dette er riktig for deg.
                        </p>
                    </div>
                    <ApplicationForm />
                </div>
            </section>
        </main>

        <footer className="border-t border-black/10 bg-white">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-black/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                <span>© {new Date().getFullYear()} JNM Coaching</span>
                <div className="flex items-center gap-6">
                    <a
                        href="https://www.instagram.com/jnm.coaching/"
                        target="_blank"
                        rel="noreferrer"
                        className="coaching-social-link"
                        aria-label="JNM Coaching på Instagram (åpnes i ny fane)"
                    >
                        <Instagram size={16} aria-hidden="true" /> Instagram
                    </a>
                    <a href="/" className="w-fit transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
                        Åpne appen
                    </a>
                </div>
            </div>
        </footer>
    </div>
);

export default CoachingLandingPage;
