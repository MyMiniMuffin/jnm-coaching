import React from 'react';
import { Check, Footprints, X } from 'lucide-react';
import { getScoreTone } from '../lib/reportStatus';

const clampPercent = (value) => Math.max(0, Math.min(100, value));
const scoreStyles = {
    good: { text: 'text-report-good', bar: 'bg-report-good', label: 'Bra' },
    medium: { text: 'text-report-medium', bar: 'bg-report-medium', label: 'Medium' },
    poor: { text: 'text-report-poor', bar: 'bg-report-poor', label: 'Dårlig' },
    training: { text: 'text-report-training', bar: 'bg-report-training', label: '' },
    neutral: { text: 'text-ink', bar: 'bg-ink/45', label: '' },
};

const ReportMetrics = React.memo(({ report, className = '' }) => {
    const metrics = [
        { label: 'Nøyaktighet', value: report.accuracy ?? '–', tone: getScoreTone(report.accuracy), width: clampPercent((parseInt(report.accuracy, 10) || 0) * 10) },
        { label: 'Energi', value: report.energy ?? '–', tone: getScoreTone(report.energy), width: clampPercent((parseInt(report.energy, 10) || 0) * 10) },
        { label: 'Søvn', value: report.sleep ?? '–', tone: getScoreTone(report.sleep), width: clampPercent((parseInt(report.sleep, 10) || 0) * 10) },
        { label: 'Styrke', value: report.strengthSessions || 0, tone: 'training', width: clampPercent(Math.round(((parseInt(report.strengthSessions, 10) || 0) / 7) * 100)) },
        { label: 'Cardio', value: report.cardioSessions || 0, tone: 'training', width: clampPercent(Math.round(((parseInt(report.cardioSessions, 10) || 0) / 7) * 100)) },
    ];

    const statusClass = (isActive) => isActive
        ? 'border-surface-300 bg-surface-100 text-ink'
        : 'border-surface-200 bg-surface-100 text-ink-muted';

    return (
        <div className={className}>
            <div className="grid grid-cols-5 gap-2 text-center">
                {metrics.map(metric => {
                    const style = scoreStyles[metric.tone || 'neutral'];
                    return (
                    <div key={metric.label} className="min-w-0" title={style.label ? `${metric.label}: ${style.label} (${metric.value}/10)` : metric.label}>
                        <p className={`text-lg font-semibold leading-none tabular-nums ${style.text}`}>{metric.value}</p>
                        <div className="mx-0.5 mt-2 h-1 overflow-hidden rounded-full bg-surface-200">
                            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${metric.width}%` }} />
                        </div>
                        <p className="mt-1.5 truncate text-[10px] text-ink-muted">{metric.label}</p>
                    </div>
                    );
                })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-100 pt-3">
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
    );
});

export default ReportMetrics;
