import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Loader2 } from 'lucide-react';
import { useEscapeKey, useFocusTrap } from '../hooks';
import { Button, TextField } from './ui';
import { api } from '../lib/api';
import { PrivacyContent, SupportContent } from '../legal/LegalContent';

const dateLabel = (value) => new Date(value).toLocaleDateString('nb-NO');

export default function AccountMenu({ user }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('support');
    const [deleting, setDeleting] = useState(false);
    const [pending, setPending] = useState(null);
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const close = () => { if (!busy) { setOpen(false); setDeleting(false); setPassword(''); setError(''); } };
    const focusRef = useFocusTrap(open);
    useEscapeKey(close, open);

    useEffect(() => {
        if (!open || !user) return;
        let active = true;
        api.getDeletionRequest().then(result => {
            if (!active) return;
            if (result.authError) throw new Error('Logg inn på nytt for å administrere kontoen.');
            setPending(result.data);
            setEmail(result.data?.contactEmail || '');
        }).catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [open, user?.id]);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const result = await api.requestAccountDeletion(password, email);
            if (result.authError) throw new Error('Logg inn på nytt for å sende forespørselen.');
            if (!result.data?.requestedAt) throw new Error('Forespørselen ble ikke bekreftet. Prøv igjen.');
            setPending(result.data);
            setPassword('');
            setDeleting(false);
        } catch (err) {
            setError(err.message || 'Kunne ikke sende forespørselen.');
        } finally {
            setBusy(false);
        }
    };

    return <>
        <button type="button" onClick={() => { setTab('support'); setOpen(true); }}
            aria-label={user ? 'Konto, hjelp og personvern' : undefined}
            className={user ? 'min-h-11 min-w-11 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface-100 focus-visible:ring-2 focus-visible:ring-accent' : 'min-h-11 px-3 text-sm text-accent underline underline-offset-4'}>
            {user ? <Settings size={20} /> : 'Hjelp og personvern'}
        </button>
        {open && createPortal(
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/60 p-4" onClick={close}>
                <section ref={focusRef} role="dialog" aria-modal="true" aria-labelledby="account-menu-title"
                    className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-surface-200 bg-white p-5 sm:p-8" onClick={e => e.stopPropagation()}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 id="account-menu-title" className="font-display text-2xl text-ink">{tab === 'privacy' ? 'Personvern' : user ? 'Konto og hjelp' : 'Hjelp og kontakt'}</h2>
                        <button type="button" disabled={busy} onClick={close} aria-label="Lukk" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-surface-100"><X size={20} /></button>
                    </div>
                    <nav aria-label="Konto og informasjon" className="mb-6 flex gap-2 text-sm">
                        <Button variant={tab === 'support' ? 'primary' : 'secondary'} onClick={() => setTab('support')}>Hjelp og konto</Button>
                        <Button variant={tab === 'privacy' ? 'primary' : 'secondary'} onClick={() => setTab('privacy')}>Personvern</Button>
                    </nav>
                    {tab === 'privacy' ? <PrivacyContent /> : <>
                        <SupportContent />
                        {user && <section className="mt-6 border-t border-surface-200 pt-5">
                            <h3 className="font-semibold text-ink">Slett konto og personopplysninger</h3>
                            {pending ? <div className="mt-3 space-y-2 text-sm text-ink-muted" role="status">
                                <p>Forespørselen din er mottatt {dateLabel(pending.requestedAt)}. Vi behandler den innen {dateLabel(pending.dueAt)}.</p>
                                <p>{pending.contactEmail ? `Bekreftelse sendes til ${pending.contactEmail}.` : 'Coachen din bekrefter slettingen gjennom kontaktkanalen dere bruker til oppfølging.'}</p>
                                <p>Kontoen er tilgjengelig frem til slettingen er fullført. Kontakt oss hvis du vil trekke forespørselen.</p>
                            </div> : <>
                                <p className="mt-2 text-sm text-ink-muted">Be om å få kontoen, planene, rapportene og bildene dine slettet. Vi fullfører slettingen manuelt innen 30 dager og bekrefter når den er utført.</p>
                                {!deleting ? <Button variant="danger" className="mt-4" onClick={() => { setDeleting(true); setError(''); }}>Be om kontosletting</Button> : <form className="mt-4 space-y-4" onSubmit={submit}>
                                    <p className="text-sm text-ink-muted">Når slettingen er fullført, mister du tilgangen og historikken kan ikke gjenopprettes i appen. Bekreft med passordet ditt.</p>
                                    <TextField id="deletion-password" type="password" label="Nåværende passord" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
                                    <TextField id="deletion-email" type="email" label="E-post for bekreftelse (valgfritt)" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
                                    <p className="text-xs text-ink-muted">Uten e-post bekrefter coachen slettingen gjennom kontaktkanalen dere bruker til oppfølging.</p>
                                    <div className="flex gap-3"><Button variant="secondary" disabled={busy} onClick={() => { setDeleting(false); setPassword(''); }}>Avbryt</Button><Button variant="danger" type="submit" disabled={busy || !password}>{busy ? <Loader2 size={18} className="animate-spin" /> : 'Send sletteforespørsel'}</Button></div>
                                </form>}
                            </>}
                        </section>}
                    </>}
                    {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
                </section>
            </div>, document.body
        )}
    </>;
}
