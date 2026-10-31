import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Inbox, Mail, Phone, Instagram, Check, RotateCcw, Loader2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card } from './ui';
import { useConfirm } from './ConfirmDialog';

// Labels match the questions on /coaching/ and /oppstart/.
const FORM_TYPES = {
    'coaching-application': {
        label: 'Søknad',
        fields: [['goal', 'Hva ønsker du å oppnå?'], ['why-now', 'Hvorfor nå?']],
    },
    kundeoppstart: {
        label: 'Kundeoppstart',
        // Short answers shown side by side.
        facts: [['age', 'Alder'], ['height', 'Høyde'], ['weight', 'Vekt']],
        fields: [
            ['training-location', 'Hvor skal du trene?'],
            ['training-days', 'Ønsket antall treninger i uken'],
            ['training-goals', 'Hva er målene dine med treningen?'],
            ['current-activity', 'Hvordan er treningen og aktiviteten din nå?'],
            ['current-diet', 'Hvordan er kostholdet ditt nå?'],
            ['other-information', 'Er det annen informasjon jeg bør vite?'],
            ['consent', 'Samtykke'],
        ],
        photos: [['front-photo-url', 'Forfra'], ['side-photo-url', 'Fra siden'], ['back-photo-url', 'Bakfra']],
    },
};

const formatDate = (value) => new Date(value).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
const isCloudinaryUrl = (url) => typeof url === 'string' && url.startsWith('https://res.cloudinary.com/');
const instagramUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle.replace(/^@/, '').trim())}/`;

const SubmissionDetails = ({ submission }) => {
    const type = FORM_TYPES[submission.formName];
    const { data } = submission;
    const photos = (type?.photos || []).filter(([key]) => isCloudinaryUrl(data[key]));
    return (
        <div className="mt-3 space-y-4 border-t border-surface-200 pt-4">
            <div className="flex flex-wrap gap-2">
                {data.email && (
                    <a href={`mailto:${data.email}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-100 px-3 text-sm text-ink hover:bg-surface-200">
                        <Mail size={16} /> {data.email}
                    </a>
                )}
                {data.phone && (
                    <a href={`tel:${data.phone.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-100 px-3 text-sm text-ink hover:bg-surface-200">
                        <Phone size={16} /> {data.phone}
                    </a>
                )}
                {data.instagram && (
                    <a href={instagramUrl(data.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface-100 px-3 text-sm text-ink hover:bg-surface-200">
                        <Instagram size={16} /> {data.instagram}
                    </a>
                )}
            </div>
            {(type?.facts || []).some(([key]) => data[key]) && (
                <dl className="grid max-w-md grid-cols-3 gap-2">
                    {type.facts.map(([key, label]) => (
                        <div key={key} className="rounded-lg bg-surface-100 px-3 py-2">
                            <dt className="text-xs font-medium text-ink-muted">{label}</dt>
                            <dd className="mt-0.5 break-words text-sm font-medium text-ink">{data[key] || '–'}</dd>
                        </div>
                    ))}
                </dl>
            )}
            <dl className="space-y-3">
                {(type?.fields || []).filter(([key]) => data[key]).map(([key, label]) => (
                    <div key={key}>
                        <dt className="text-xs font-medium text-ink-muted">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{data[key]}</dd>
                    </div>
                ))}
            </dl>
            {photos.length > 0 && (
                <div className="grid max-w-md grid-cols-3 gap-2">
                    {photos.map(([key, label]) => (
                        <a key={key} href={data[key]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <img src={data[key]} alt={`${label}, ${data.name || 'henvendelse'}`} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                            <span className="block px-2 py-1 text-center text-xs text-ink-muted">{label}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

const SubmissionItem = ({ submission, open, onToggle, onSetHandled, onDelete, busy }) => {
    const type = FORM_TYPES[submission.formName];
    const handled = Boolean(submission.handledAt);
    const detailsId = `submission-${submission.id}`;
    return (
        <li className="border-t border-surface-200 first:border-t-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={detailsId}
                className="flex min-h-14 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
            >
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{submission.data.name || 'Uten navn'}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{type?.label || submission.formName} · {formatDate(submission.createdAt)}</span>
                </span>
                {!handled && <Badge variant="warning">Ny</Badge>}
                <ChevronDown size={18} className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {open && (
                <div id={detailsId} className="pb-4">
                    <SubmissionDetails submission={submission} />
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {/* Only handled submissions can be deleted, so a new one never disappears by a mistap. */}
                        {handled && (
                            <Button variant="danger" size="sm" disabled={busy} onClick={() => onDelete(submission)}>
                                <Trash2 size={16} /> Slett
                            </Button>
                        )}
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onSetHandled(submission, !handled)}>
                            {busy
                                ? <Loader2 size={16} className="animate-spin" />
                                : handled ? <RotateCcw size={16} /> : <Check size={16} />}
                            {handled ? 'Flytt til nye' : 'Marker som behandlet'}
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
};

/** Coach inbox for applications and onboarding forms from the public pages. */
export default function FormSubmissions() {
    const [submissions, setSubmissions] = useState([]);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [showHandled, setShowHandled] = useState(false);
    const confirm = useConfirm();

    const load = useCallback(async () => {
        try {
            const result = await api.getFormSubmissions();
            if (result.authError) throw new Error('Logg inn på nytt for å se henvendelser.');
            if (!Array.isArray(result.data)) throw new Error('Kunne ikke hente henvendelser.');
            setSubmissions(result.data);
            setError('');
        } catch (err) { setError(err.message); }
    }, []);

    useEffect(() => {
        load();
        const timer = setInterval(load, 60000);
        return () => clearInterval(timer);
    }, [load]);

    const setHandled = async (submission, handled) => {
        setBusyId(submission.id);
        try {
            const result = await api.setFormSubmissionHandled(Number(submission.id), handled);
            if (result.authError) throw new Error('Logg inn på nytt.');
            setSubmissions((previous) => previous.map((item) => (
                item.id === submission.id ? { ...item, handledAt: result.data.handledAt } : item
            )));
            setOpenId(null);
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    };

    const remove = async (submission) => {
        const photoCount = ['front-photo-url', 'side-photo-url', 'back-photo-url'].filter((key) => submission.data[key]).length;
        const message = `Henvendelsen fra ${submission.data.name || 'ukjent'} slettes permanent${photoCount ? `, sammen med ${photoCount === 1 ? 'bildet' : `de ${photoCount} bildene`}` : ''}. Dette kan ikke angres.`;
        if (!await confirm(message, { title: 'Slett henvendelse?', confirmText: 'Slett', destructive: true })) return;
        setBusyId(submission.id);
        try {
            const result = await api.deleteFormSubmission(Number(submission.id));
            if (result.authError) throw new Error('Logg inn på nytt.');
            setSubmissions((previous) => previous.filter((item) => item.id !== submission.id));
            setOpenId(null);
            setError('');
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    };

    const open = useMemo(() => submissions.filter((item) => !item.handledAt), [submissions]);
    const handled = useMemo(() => submissions.filter((item) => item.handledAt), [submissions]);
    const visible = showHandled ? handled : open;

    if (!submissions.length && !error) return null;

    return (
        <Card className="p-5 duo:p-6" aria-labelledby="form-submissions-title" role="region">
            <div className="flex items-center justify-between gap-3">
                <h2 id="form-submissions-title" className="flex items-center gap-2 font-semibold text-ink">
                    <Inbox size={18} className="text-ink-muted" aria-hidden="true" />
                    {showHandled ? 'Behandlede henvendelser' : 'Henvendelser'}
                    {!showHandled && open.length > 0 && <Badge variant="warning">{open.length} {open.length === 1 ? 'ny' : 'nye'}</Badge>}
                </h2>
                {(handled.length > 0 || showHandled) && (
                    <Button variant="ghost" size="sm" onClick={() => { setShowHandled((value) => !value); setOpenId(null); }}>
                        {showHandled ? 'Vis nye' : `Behandlet (${handled.length})`}
                    </Button>
                )}
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-error">{error} <button type="button" className="underline" onClick={load}>Prøv igjen</button></p>}
            {visible.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">{showHandled ? 'Ingen behandlede henvendelser ennå.' : 'Ingen nye henvendelser.'}</p>
            ) : (
                <ul className="mt-2">
                    {visible.map((submission) => (
                        <SubmissionItem
                            key={submission.id}
                            submission={submission}
                            open={openId === submission.id}
                            onToggle={() => setOpenId((current) => (current === submission.id ? null : submission.id))}
                            onSetHandled={setHandled}
                            onDelete={remove}
                            busy={busyId === submission.id}
                        />
                    ))}
                </ul>
            )}
        </Card>
    );
}
