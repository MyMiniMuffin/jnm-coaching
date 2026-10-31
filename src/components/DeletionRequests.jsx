import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui';
import { useConfirm } from './ConfirmDialog';

export default function DeletionRequests({ allUsers, onSelectClient }) {
    const [requests, setRequests] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(null);
    const [inventories, setInventories] = useState({});
    const confirm = useConfirm();
    const load = useCallback(async () => {
        try {
            const result = await api.getDeletionRequests();
            if (result.authError) throw new Error('Logg inn på nytt for å se sletteforespørsler.');
            if (!Array.isArray(result.data)) throw new Error('Kunne ikke hente sletteforespørsler.');
            setRequests(result.data);
            setError('');
        } catch (err) { setError(err.message); }
    }, []);
    useEffect(() => {
        load();
        const timer = setInterval(load, 60000);
        return () => clearInterval(timer);
    }, [load, allUsers]);
    const inventory = async (request) => {
        setBusy(request.id);
        try {
            const result = await api.getDeletionAssets(request.id);
            if (result.authError) throw new Error('Logg inn på nytt.');
            setInventories(previous => ({ ...previous, [request.id]: result.data }));
        } catch (err) { setError(err.message); }
        finally { setBusy(null); }
    };
    const complete = async (request) => {
        if (!await confirm('Bekreft at alle tilknyttede bilder er fjernet fra Cloudinary, og at brukeren har fått beskjed om slettingen. Kontaktadressen fjernes fra forespørselen når du fullfører.', { title: 'Fullfør sletteforespørsel?', confirmText: 'Bekreft fullført' })) return;
        setBusy(request.id);
        try {
            const result = await api.completeDeletionRequest(Number(request.id));
            if (result.authError) throw new Error('Logg inn på nytt.');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(null); }
    };
    if (!requests.length && !error) return null;
    return <section className="mb-6 rounded-xl border border-error/30 bg-white p-5" aria-labelledby="deletion-requests-title">
        <h2 id="deletion-requests-title" className="font-semibold text-ink">Sletteforespørsler ({requests.length})</h2>
        <p className="mt-2 text-sm text-ink-muted">Før fristen: noter bildeadressene, fjern bildene i Cloudinary, bekreft til brukeren, og slett kontoen i utøverlisten. Fullfør deretter forespørselen her. Hent bildelisten før kontoen slettes, og ta vare på den til bildene er fjernet.</p>
        {error && <p role="alert" className="mt-3 text-sm text-error">{error} <button type="button" className="underline" onClick={load}>Prøv igjen</button></p>}
        <ul className="mt-4 space-y-4">{requests.map(request => {
            const client = allUsers.find(user => Number(user.id) === Number(request.userId));
            return <li key={request.id} className="border-t border-surface-200 pt-4 text-sm">
                <p className="font-semibold">{request.name || 'Kontoen er slettet'} {request.username ? `(@${request.username})` : ''}</p>
                <p className={new Date(request.dueAt) < new Date() ? 'text-error' : 'text-ink-muted'}>Frist: {new Date(request.dueAt).toLocaleDateString('nb-NO')}</p>
                <p className="text-ink-muted">{request.contactEmail || 'Bekreft via avtalt kontaktkanal.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {request.userId !== null && <Button variant="secondary" disabled={busy !== null} onClick={() => inventory(request)}>Vis bildeliste</Button>}
                    {client?.role === 'athlete' && <Button variant="secondary" onClick={() => onSelectClient(client)}>Åpne utøver</Button>}
                    {client?.role === 'coach' && <p className="text-ink-muted">Administratorkonto. Behandle slettingen med en annen administrator.</p>}
                    <Button variant="secondary" disabled={request.userId !== null || busy !== null} onClick={() => complete(request)}>Bekreft fullført</Button>
                </div>
                {inventories[request.id] && <div className="mt-3 text-ink-muted">
                    <p>Slett alle bilder i Cloudinary-mappen <strong>{inventories[request.id].folder}</strong>, også opplastinger som ikke ble knyttet til en ukesrapport. Eldre bilder kan ligge direkte i jnm_coaching. Bildelistens adresser viser disse.</p>
                    <textarea readOnly aria-label="Bildeliste for sletting" className="mt-2 w-full rounded-lg border border-surface-200 p-3 text-base" rows={4} value={inventories[request.id].urls.join('\n')} />
                </div>}
            </li>;
        })}</ul>
    </section>;
}
