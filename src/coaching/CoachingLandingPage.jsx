import React, { useEffect, useRef, useState } from 'react';
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

// Fader inn elementer merket med data-reveal når de kommer inn i bildet.
// Uten JS, IntersectionObserver eller ved redusert bevegelse vises alt med en gang.
const useReveal = () => {
    const rootRef = useRef(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || !('IntersectionObserver' in window)) return undefined;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

        const elements = [...root.querySelectorAll('[data-reveal]')];
        const reveal = (element) => {
            element.classList.add('is-visible');
            observer.unobserve(element);
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                // Vis også elementer over, i tilfelle man har hoppet forbi dem (f.eks. via «Søk nå»).
                elements.slice(0, elements.indexOf(entry.target) + 1).forEach(reveal);
            });
        }, { rootMargin: '0px 0px -10% 0px' });

        elements.forEach((element) => observer.observe(element));
        root.setAttribute('data-reveal-ready', '');

        return () => observer.disconnect();
    }, []);

    return rootRef;
};

// Følger med på om hero-knappen er synlig, så toppmenyen ikke viser to søk-knapper samtidig.
const useHeroCtaVisible = () => {
    const ctaRef = useRef(null);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const cta = ctaRef.current;
        if (!cta || !('IntersectionObserver' in window)) return undefined;

        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
        observer.observe(cta);
        return () => observer.disconnect();
    }, []);

    return [ctaRef, visible];
};

const encodeForm = (formData) => new URLSearchParams(formData).toString();

const ButtonIcon = () => (
    <svg viewBox="0 0 512 512" className="coaching-button-icon" aria-hidden="true" focusable="false">
        <path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2v64H176C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96h96v64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z" />
    </svg>
);

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
                <h3 className="text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl">Søknaden er sendt</h3>
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
                    ) : <><ButtonIcon /> Send søknad</>}
                </button>
            </form>
    );
};

const CoachingLandingPage = () => {
    const rootRef = useReveal();
    const [heroCtaRef, heroCtaVisible] = useHeroCtaVisible();

    return (
    <div ref={rootRef} className="coaching-page min-h-screen overflow-hidden bg-white text-ink">
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
                <a
                        href="#soknad"
                        className="coaching-button coaching-header-cta"
                        data-hidden={heroCtaVisible || undefined}
                        aria-hidden={heroCtaVisible || undefined}
                        tabIndex={heroCtaVisible ? -1 : undefined}
                    >
                        <ButtonIcon /> Søk nå
                    </a>
            </div>
        </header>

        <main>
            <section className="coaching-hero">
                <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
                    <div data-reveal className="max-w-4xl">
                        <h1 className="coaching-title text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                            En plan du faktisk kan følge
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-black/60 sm:text-xl">
                            Personlig coaching for trening og kosthold, med oppfølging underveis.
                        </p>
                        <a ref={heroCtaRef} href="#soknad" className="coaching-button mt-8"><ButtonIcon /> Søk om coaching</a>
                    </div>
                </div>
            </section>

            <section id="opplegget" className="scroll-mt-20 bg-surface-50 py-20 sm:py-28">
                <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
                    <h2 data-reveal className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        Hva du får
                    </h2>

                    <div className="mt-10 grid border-t border-black/15 sm:mt-12 md:grid-cols-3">
                        {pillars.map(({ title, description }, index) => (
                            <article key={title} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="coaching-pillar border-b border-black/15 py-8 md:border-b-0 md:border-l md:py-10 md:px-8 md:first:border-l-0 md:first:pl-0 md:last:pr-0">
                                <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                                <p className="mt-4 max-w-sm text-base leading-7 text-black/60">{description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section id="soknad" className="scroll-mt-16 bg-white py-20 sm:py-28">
                <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24 lg:px-12">
                    <div data-reveal>
                        <h2 className="max-w-lg text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                            Klar for å starte?
                        </h2>
                        <p className="mt-6 max-w-md text-lg leading-8 text-black/60">
                            Send en kort, uforpliktende søknad. Så finner vi ut om dette er riktig for deg.
                        </p>
                    </div>
                    <div data-reveal style={{ '--reveal-delay': '80ms' }}>
                        <ApplicationForm />
                    </div>
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
};

export default CoachingLandingPage;
