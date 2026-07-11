import React from 'react';
import { Check, Footprints, X } from 'lucide-react';

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const ReportMetrics = React.memo(({ report, className = '' }) => {
    const metrics = [
        { label: 'Nøyakt.', value: report.accuracy ?? 0, width: clampPercent((parseInt(report.accuracy, 10) || 0) * 10), color: 'bg-success' },
        { label: 'Energi', value: report.energy ?? 0, width: clampPercent((parseInt(report.energy, 10) || 0) * 10), color: 'bg-accent' },
        { label: 'Søvn', value: report.sleep ?? 0, width: clampPercent((parseInt(report.sleep, 10) || 0) * 10), color: 'bg-accent/60' },
        { label: 'Styrke', value: report.strengthSessions || 0, width: clampPercent(Math.round(((parseInt(report.strengthSessions, 10) || 0) / 7) * 100)), color: 'bg-ink/45' },
        { label: 'Cardio', value: report.cardioSessions || 0, width: clampPercent(Math.round(((parseInt(report.cardioSessions, 10) || 0) / 7) * 100)), color: 'bg-ink/45' },
    ];

    const statusClass = (isActive) => isActive
        ? 'border-success/20 bg-success/10 text-success'
        : 'border-surface-200 bg-surface-100 text-ink-muted';

    return (
        <div className={className}>
            <div className="grid grid-cols-5 gap-2 text-center">
                {metrics.map(metric => (
                    <div key={metric.label} className="min-w-0">
                        <p className="text-lg font-semibold leading-none text-ink tabular-nums">{metric.value}</p>
                        <div className="mx-0.5 mt-2 h-1 overflow-hidden rounded-full bg-surface-200">
                            <div className={`h-full rounded-full ${metric.color}`} style={{ width: `${metric.width}%` }} />
                        </div>
                        <p className="mt-1.5 truncate text-[10px] text-ink-muted">{metric.label}</p>
                    </div>
                ))}
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
