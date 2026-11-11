import React from 'react';
import { Check, Footprints, X } from '@phosphor-icons/react';
import { getScoreTone } from '../lib/reportStatus';

const clampPercent = (value) => Math.max(0, Math.min(100, value));

// Report tone colors belong to the 1–10 ratings only. Session counts stay neutral.
const toneStyles = {
    good: { text: 'text-report-good', bar: 'bg-report-good', label: 'Bra' },
    medium: { text: 'text-report-medium', bar: 'bg-report-medium', label: 'Medium' },
    poor: { text: 'text-report-poor', bar: 'bg-report-poor', label: 'Dårlig' },
    neutral: { text: 'text-ink', bar: 'bg-ink/30', label: '' },
};

const sessionText = (count) => `${count} ${count === 1 ? 'økt' : 'økter'}`;

const ReportMetrics = React.memo(({ report, className = '' }) => {
    const ratings = [
        { label: 'Nøyaktighet', value: report.accuracy },
        { label: 'Energi', value: report.energy },
        { label: 'Søvn', value: report.sleep },
    ].map(rating => ({
        ...rating,
        display: rating.value ?? '–',
        tone: getScoreTone(rating.value),
        width: clampPercent((parseInt(rating.value, 10) || 0) * 10),
    }));

    const sessions = [
        { label: 'Styrke', count: parseInt(report.strengthSessions, 10) || 0 },
        { label: 'Cardio', count: parseInt(report.cardioSessions, 10) || 0 },
    ];

    const statusClass = (isActive) => isActive
        ? 'border-surface-300 bg-surface-100 text-ink'
        : 'border-surface-200 bg-surface-100 text-ink-muted';

    return (
        <div className={className}>
            <div data-testid="report-ratings" className="grid grid-cols-3 gap-3">
                {ratings.map(rating => {
                    const style = toneStyles[rating.tone];
                    const summary = `${rating.label}: ${style.label ? `${style.label}, ` : ''}${rating.display} av 10`;
                    return (
                        <div key={rating.label} className="min-w-0" title={style.label ? `${rating.label}: ${style.label} (${rating.display}/10)` : rating.label}>
                            <span className="sr-only">{summary}</span>
                            <div aria-hidden="true">
                                <p className="text-sm text-ink-muted">{rating.label}</p>
                                <p className="mt-1 flex items-baseline gap-1 tabular-nums">
                                    <span className={`text-2xl font-semibold leading-none ${style.text}`}>{rating.display}</span>
                                    <span className="text-sm text-ink-faint">/10</span>
                                </p>
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-200">
                                    <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${rating.width}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-5 space-y-3 border-t border-surface-100 pt-4">
                <p data-testid="report-sessions" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted tabular-nums">
                    {sessions.map(session => (
                        <span key={session.label}>
                            {session.label} <span className="text-ink">{sessionText(session.count)}</span>
                        </span>
                    ))}
                </p>
                <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(report.stepsReached)}`}>
                        <Footprints size={12} />
                        {report.stepsReached ? 'Skrittmål nådd' : 'Under skrittmål'}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(report.takenSupplements)}`}>
                        {report.takenSupplements ? <Check size={12} /> : <X size={12} />}
                        Tilskudd
                    </span>
                </div>
            </div>
        </div>
    );
});

export default ReportMetrics;
