import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, LockKeyhole } from 'lucide-react';
import { uploadOnboardingImage, validateOnboardingImage } from './imageUpload';

const steps = [
    { title: 'Om deg', description: 'Kontakt og utgangspunkt' },
    { title: 'Trening', description: 'Mål, sted og aktivitet' },
    { title: 'Kosthold og hensyn', description: 'Vaner, helse og bilder' },
];

const initialValues = {
    name: '',
    email: '',
    phone: '',
    age: '',
    height: '',
    weight: '',
    'training-location': '',
    'training-goals': '',
    'training-days': '',
    'current-activity': '',
    'current-diet': '',
    'other-information': '',
    consent: false,
    'bot-field': '',
};

const Field = ({ label, hint, children, optional = false }) => (
    <div className="onboarding-field-wrap">
        <label htmlFor={children.props.id} className="onboarding-label mb-2">
            {label}{optional && <span className="font-normal text-black/45"> (valgfritt)</span>}
        </label>
        {children}
    </div>
);

const TextInput = (props) => <input {...props} className="onboarding-field" />;
const TextArea = (props) => <textarea {...props} className="onboarding-field min-h-[116px] resize-y" />;
const Select = ({ children, ...props }) => <select {...props} className="onboarding-field onboarding-select">{children}</select>;

const PhotoField = ({ id, label, file, onChange }) => (
    <label htmlFor={id} className="onboarding-photo-field">
        <span className="onboarding-photo-icon">
            {file ? <Check size={18} aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
        </span>
        <span>
            <strong>{label}</strong>
            <small>{file ? file.name : 'JPG, PNG eller WebP'}</small>
        </span>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
    </label>
);

const OnboardingForm = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [values, setValues] = useState(initialValues);
    const [photos, setPhotos] = useState({ front: null, side: null, back: null });
    const [uploadedPhotos, setUploadedPhotos] = useState({});
    const [uploadStatus, setUploadStatus] = useState('');
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const sectionRef = useRef(null);

    useEffect(() => {
        sectionRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    const updateValue = (event) => {
        const { name, type, checked, value } = event.target;
        setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
        if (error) setError('');
    };

    const validateCurrentStep = () => {
        const fields = sectionRef.current?.querySelectorAll('input, select, textarea') ?? [];
        for (const field of fields) {
            const isBlankRequiredField = field.required && typeof field.value === 'string' && !field.value.trim();
            if (isBlankRequiredField || !field.checkValidity()) {
                const fieldLabel = field.labels?.[0]?.textContent
                    ?.replace('(obligatorisk)', '')
                    .replace('*', '')
                    .trim();
                setError(field.type === 'email' && field.validity.typeMismatch
                    ? 'Kontroller e-postadressen. Skriv den for eksempel som navn@epost.no.'
                    : `Kontroller feltet «${fieldLabel || 'obligatorisk felt'}» før du går videre.`);
                field.focus({ preventScroll: true });
                return false;
            }
        }
        setError('');
        return true;
    };

    const nextStep = () => {
        setError('');
        if (!validateCurrentStep()) return;
        setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
    };

    const previousStep = () => {
        setError('');
        setCurrentStep((step) => Math.max(step - 1, 0));
    };

    const preventAutomaticStepChange = (event) => {
        const isSingleLineField = event.target instanceof HTMLInputElement;
        if (event.key === 'Enter' && !event.isComposing && isSingleLineField) {
            event.preventDefault();
        }
    };

    const handlePhotoChange = (position) => (event) => {
        const file = event.target.files?.[0] || null;
        const validationError = validateOnboardingImage(file);

        if (validationError) {
            event.target.value = '';
            setError(validationError);
            return;
        }

        setError('');
        setPhotos((current) => ({ ...current, [position]: file }));
        setUploadedPhotos((current) => {
            const next = { ...current };
            delete next[position];
            return next;
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateCurrentStep()) return;

        setStatus('submitting');
        setError('');

        try {
            const selectedPhotos = Object.entries(photos).filter(([, file]) => file);
            const completedPhotos = { ...uploadedPhotos };

            for (let index = 0; index < selectedPhotos.length; index += 1) {
                const [position, file] = selectedPhotos[index];
                const fileKey = `${file.name}:${file.size}:${file.lastModified}`;

                if (completedPhotos[position]?.fileKey === fileKey) continue;

                setUploadStatus(`Laster opp bilde ${index + 1} av ${selectedPhotos.length}`);
                const result = await uploadOnboardingImage({
                    file,
                    position,
                    botField: values['bot-field'],
                });
                completedPhotos[position] = { fileKey, url: result.url };
                setUploadedPhotos({ ...completedPhotos });
            }

            setUploadStatus('Sender svarene');
            const formData = new URLSearchParams({
                'form-name': 'kundeoppstart',
                subject: 'Ny kundeoppstart – JNM Coaching',
                ...values,
                consent: values.consent ? 'Ja' : 'Nei',
                'front-photo-url': completedPhotos.front?.url || '',
                'side-photo-url': completedPhotos.side?.url || '',
                'back-photo-url': completedPhotos.back?.url || '',
            });

            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
            });
            if (!response.ok) throw new Error('Submission failed');
            setStatus('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (submissionError) {
            setStatus('error');
            setError(submissionError?.message === 'Submission failed'
                ? 'Noe gikk galt under innsendingen. Prøv igjen, eller ta kontakt med meg direkte.'
                : submissionError?.message || 'Bildene kunne ikke lastes opp. Prøv igjen.');
        } finally {
            setUploadStatus('');
        }
    };

    if (status === 'success') {
        return (
            <div className="onboarding-success" role="status">
                <div className="onboarding-success-icon"><Check size={28} aria-hidden="true" /></div>
                <p className="onboarding-eyebrow">Alt er sendt</p>
                <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">Takk, {values.name.split(' ')[0]}.</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-black/60">
                    Jeg har mottatt svarene dine og bruker dem til å forberede oppstarten og planen din.
                </p>
                <a href="/coaching/" className="coaching-button mt-8">Til JNM Coaching</a>
            </div>
        );
    }

    return (
        <form
            name="kundeoppstart"
            method="POST"
            data-netlify="true"
            data-netlify-honeypot="bot-field"
            onSubmit={handleSubmit}
            onKeyDown={preventAutomaticStepChange}
        >
            <input type="hidden" name="form-name" value="kundeoppstart" />
            <input type="hidden" name="subject" data-remove-prefix value="Ny kundeoppstart – JNM Coaching" />
            <p className="hidden">
                <label>Ikke fyll ut dette feltet: <input name="bot-field" value={values['bot-field']} onChange={updateValue} /></label>
            </p>

            <div className="onboarding-progress" aria-label={`Steg ${currentStep + 1} av ${steps.length}`}>
                <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold">Steg {currentStep + 1} av {steps.length}</span>
                    <span className="text-black/45">{steps[currentStep].title}</span>
                </div>
                <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/8"
                    role="progressbar"
                    aria-valuemin="1"
                    aria-valuemax={steps.length}
                    aria-valuenow={currentStep + 1}
                >
                    <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
                </div>
            </div>

            <section ref={sectionRef} tabIndex="-1" className="onboarding-step outline-none" aria-labelledby={`step-${currentStep}-title`}>
                {currentStep === 0 && (
                    <>
                        <div className="onboarding-step-heading">
                            <h2 id="step-0-title">Om deg</h2>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            <Field label="Fullt navn"><TextInput id="name" name="name" type="text" autoComplete="name" required value={values.name} onChange={updateValue} /></Field>
                            <Field label="E-post"><TextInput id="email" name="email" type="email" autoComplete="email" required value={values.email} onChange={updateValue} /></Field>
                            <Field label="Telefon" optional><TextInput id="phone" name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={updateValue} /></Field>
                            <Field label="Alder"><TextInput id="age" name="age" type="text" inputMode="numeric" required value={values.age} onChange={updateValue} /></Field>
                            <Field label="Høyde (cm)"><TextInput id="height" name="height" type="text" inputMode="decimal" required value={values.height} onChange={updateValue} /></Field>
                            <Field label="Vekt (kg)"><TextInput id="weight" name="weight" type="text" inputMode="decimal" required value={values.weight} onChange={updateValue} /></Field>
                        </div>
                    </>
                )}

                {currentStep === 1 && (
                    <>
                        <div className="onboarding-step-heading">
                            <h2 id="step-1-title">Trening og mål</h2>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            <Field label="Hvor skal du trene?" hint="Treningssenter, hjemmegym eller annet. Oppgi gjerne navnet på senteret.">
                                <TextArea id="training-location" name="training-location" required rows="3" value={values['training-location']} onChange={updateValue} />
                            </Field>
                            <Field label="Ønsket antall treninger i uken">
                                <Select id="training-days" name="training-days" required value={values['training-days']} onChange={updateValue}>
                                    <option value="">Velg antall</option>
                                    <option value="1 trening">1 trening</option>
                                    <option value="2 treninger">2 treninger</option>
                                    <option value="3 treninger">3 treninger</option>
                                    <option value="4 treninger">4 treninger</option>
                                    <option value="5 treninger">5 treninger</option>
                                    <option value="6+ treninger">6 eller flere treninger</option>
                                </Select>
                            </Field>
                            <div className="sm:col-span-2">
                                <Field label="Hva er målene dine med treningen?" hint="Ta også med spesifikke øvelser du liker godt eller ønsker å bli bedre i.">
                                    <TextArea id="training-goals" name="training-goals" required rows="4" value={values['training-goals']} onChange={updateValue} />
                                </Field>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Hvordan er treningen og aktiviteten din nå?" hint="For eksempel antall skritt per dag, styrketrening, kondisjon eller annen aktivitet i løpet av uken.">
                                    <TextArea id="current-activity" name="current-activity" required rows="4" value={values['current-activity']} onChange={updateValue} />
                                </Field>
                            </div>
                        </div>
                    </>
                )}

                {currentStep === 2 && (
                    <>
                        <div className="onboarding-step-heading">
                            <h2 id="step-2-title">Kosthold og bilder</h2>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <Field label="Hvordan er kostholdet ditt nå?" hint="Skriv litt om hva og hvordan du vanligvis spiser i løpet av en dag.">
                                    <TextArea id="current-diet" name="current-diet" required rows="5" value={values['current-diet']} onChange={updateValue} />
                                </Field>
                            </div>
                            <div className="sm:col-span-2">
                                <Field label="Er det annen informasjon jeg bør vite?" hint="For eksempel skader, sykdommer, allergier, medisiner eller spesifikke ønsker. Skriv «nei» hvis det ikke er noe å ta hensyn til.">
                                    <TextArea id="other-information" name="other-information" required rows="5" value={values['other-information']} onChange={updateValue} />
                                </Field>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="onboarding-photo-section">
                                    <div>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <h3 className="onboarding-label">Fremgangsbilder</h3>
                                            <span className="text-xs text-black/40">Valgfritt</span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-black/50">Last opp bilder forfra, fra siden og bakfra hvis du ønsker.</p>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                        <PhotoField id="front-photo" label="Forfra" file={photos.front} onChange={handlePhotoChange('front')} />
                                        <PhotoField id="side-photo" label="Fra siden" file={photos.side} onChange={handlePhotoChange('side')} />
                                        <PhotoField id="back-photo" label="Bakfra" file={photos.back} onChange={handlePhotoChange('back')} />
                                    </div>
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="onboarding-consent">
                                    <input name="consent" type="checkbox" required checked={values.consent} onChange={updateValue} />
                                    <span>
                                        <strong>Jeg samtykker til at JNM Coaching behandler svarene og eventuelle bilder</strong>
                                        <small>Opplysningene brukes til å planlegge og følge opp coachingforløpet. Jeg kan trekke samtykket tilbake ved å ta kontakt.</small>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-error" role="alert">{error}</p>}

            <div className="onboarding-actions flex items-center justify-between gap-3">
                {currentStep > 0 ? (
                    <button type="button" onClick={previousStep} className="onboarding-secondary-button">
                        <ArrowLeft size={17} aria-hidden="true" /> Tilbake
                    </button>
                ) : <span />}

                {currentStep < steps.length - 1 ? (
                    <button type="button" onClick={nextStep} className="coaching-button w-full sm:w-auto">
                        Neste <ArrowRight size={17} aria-hidden="true" />
                    </button>
                ) : (
                    <button type="submit" disabled={status === 'submitting'} className="coaching-button">
                        {status === 'submitting' ? (
                            <><Loader2 className="animate-spin" size={18} aria-hidden="true" /> {uploadStatus || 'Sender'}</>
                        ) : <><LockKeyhole size={17} aria-hidden="true" /> Send svarene</>}
                    </button>
                )}
            </div>
        </form>
    );
};

const OnboardingPage = () => (
    <div className="onboarding-page min-h-screen text-ink">
        <header className="onboarding-header">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
                <a href="/coaching/" className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4" aria-label="JNM Coaching">
                    <img src="/jnm-coaching-logo.svg" alt="" className="h-8 w-8 rounded-lg" />
                    <span className="text-sm font-semibold tracking-[-0.02em]">JNM Coaching</span>
                </a>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-black/50"><LockKeyhole size={13} aria-hidden="true" /> Fortrolig skjema</span>
            </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-12 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[0.68fr_1.32fr] lg:gap-20 lg:py-20">
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
                <p className="onboarding-eyebrow">Velkommen inn</p>
                <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                    La oss bygge et godt utgangspunkt<span className="coaching-accent">.</span>
                </h1>
                <p className="mt-6 max-w-md text-lg leading-8 text-black/60">
                    Svar så ærlig og konkret du kan. Det finnes ingen riktige svar – informasjonen hjelper meg å lage et opplegg som faktisk passer deg.
                </p>
                <div className="mt-8 flex items-start gap-3 border-t border-black/10 pt-6 text-sm leading-6 text-black/50">
                    <LockKeyhole className="mt-1 shrink-0 text-accent" size={16} aria-hidden="true" />
                    <p>Sett av omtrent 5–8 minutter. Svarene sendes direkte til JNM Coaching.</p>
                </div>
            </aside>

            <div className="onboarding-card">
                <OnboardingForm />
            </div>
        </main>

        <footer className="border-t border-black/10">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-7 text-xs text-black/45 sm:px-8">
                <span>© {new Date().getFullYear()} JNM Coaching</span>
                <span>Personlig informasjon behandles fortrolig</span>
            </div>
        </footer>
    </div>
);

export default OnboardingPage;
