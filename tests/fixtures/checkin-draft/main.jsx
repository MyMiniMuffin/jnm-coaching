// Syntetisk vert for CheckInView: ingen nettverk, parent-callbackene speiler App.jsx
// (handleNewCheckin legger til lagret rapport, handleDeleteCheckin filtrerer den bort).
import '../../../src/index.css';
import '../../../src/lib/shellMode';
import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../../../src/components/Toast';
import { ConfirmProvider } from '../../../src/components/ConfirmDialog';
import { RailBackProvider } from '../../../src/lib/railBack';
import CheckInView from '../../../src/views/CheckInView';

const REPORTS_KEY = 'fixture_reports';
const readReports = () => {
    try { return JSON.parse(sessionStorage.getItem(REPORTS_KEY)) || []; } catch { return []; }
};

const Host = () => {
    const [checkins, setCheckins] = useState(readReports);
    const persist = (next) => { sessionStorage.setItem(REPORTS_KEY, JSON.stringify(next)); return next; };

    const onNewCheckin = useCallback(async (entry) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        window.__keys = [...(window.__keys || []), entry.idempotencyKey];
        if (window.__failNext) {
            // Lagret på serveren, men svaret gikk tapt.
            window.__failNext = false;
            throw new Error('svar tapt');
        }
        const saved = { ...entry, id: `srv-${entry.id}` };
        window.__submitted = (window.__submitted || 0) + 1;
        setCheckins((prev) => persist([saved, ...prev]));
        return saved;
    }, []);

    const onDelete = useCallback(async (id) => {
        setCheckins((prev) => persist(prev.filter((c) => c.id !== id)));
    }, []);

    return (
        <CheckInView
            checkins={checkins}
            onNewCheckin={onNewCheckin}
            onDelete={onDelete}
            canDelete
            isReadOnly={new URLSearchParams(window.location.search).has('readonly')}
            draftKey="fixture"
        />
    );
};

createRoot(document.getElementById('root')).render(
    <ToastProvider><ConfirmProvider><RailBackProvider><Host /></RailBackProvider></ConfirmProvider></ToastProvider>
);
