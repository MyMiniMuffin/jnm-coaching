import React, { useMemo, useState } from 'react';
import { ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';
import { formatWeight, formatDateNO } from '../lib/formatters';

const WeightProgressView = React.memo(({ checkins, periods = [], onBack }) => {
    const [, setHoveredMarkerId] = useState(null);
    const [activeTooltip, setActiveTooltip] = useState(null);

    // OPTIMALISERING: Memoize filtrering og sortering
    const validCheckins = useMemo(() =>
        checkins.filter(c => c.weight && parseFloat(c.weight) > 0).sort((a, b) => a.timestamp - b.timestamp),
        [checkins]
    );

    // OPTIMALISERING: Reverser en gang i stedet for i hver map-iterasjon
    const reversedCheckins = useMemo(() => [...validCheckins].reverse(), [validCheckins]);

    if (validCheckins.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in text-center px-6">
            <p className="text-ink-muted font-display text-lg italic mb-6">Ingen vektdata enda</p>
            <Button variant="secondary" onClick={onBack}>Tilbake</Button>
        </div>
    );

    const first = validCheckins[0];
    const last = validCheckins[validCheckins.length - 1];
    const totalChange = (parseFloat(last.weight) - parseFloat(first.weight)).toFixed(1);
    const isDown = parseFloat(totalChange) < 0;
    const isSame = parseFloat(totalChange) === 0;

    const width = 300;
    const height = 140;
    const padding = 16;
    const chartTop = padding;
    const chartBottom = height - padding;

    // Memoize tunge beregninger (min/max over alle vekter + SVG-koordinater)
    const { points, chartPoints, periodMarkers } = useMemo(() => {
        const weights = validCheckins.map(c => parseFloat(c.weight));
        const minW = Math.min(...weights) - 0.5;
        const maxW = Math.max(...weights) + 0.5;
        const timestamps = validCheckins.map(c => c.timestamp);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);

        const pts = validCheckins.map(c => {
            const x = minT === maxT ? width / 2 : ((c.timestamp - minT) / (maxT - minT)) * (width - 2 * padding) + padding;
            const y = minW === maxW ? height / 2 : height - padding - ((parseFloat(c.weight) - minW) / (maxW - minW)) * (height - 2 * padding);
            return { x, y };
        });

        const markers = periods
            .filter(period => period?.startDate)
            .map(period => {
                const startTimestamp = new Date(period.startDate).getTime();
                const endTimestamp = period.endDate ? new Date(period.endDate).getTime() : null;
                if (Number.isNaN(startTimestamp)) return null;

                const overlapsChart = startTimestamp <= maxT && (endTimestamp === null || !Number.isNaN(endTimestamp) && endTimestamp >= minT);
                if (!overlapsChart) return null;

                const markerTimestamp = Math.max(minT, Math.min(maxT, startTimestamp));

                const x = minT === maxT
                    ? width / 2
                    : ((markerTimestamp - minT) / (maxT - minT)) * (width - 2 * padding) + padding;

                return {
                    id: period.id,
                    x,
                    label: period.name || 'Ny runde',
                    shortDate: formatDateNO(period.startDate),
                    isClampedToStart: startTimestamp < minT,
                    tooltipText: `${period.name || 'Ny runde'} startet ${formatDateNO(period.startDate)}`
                };
            })
            .filter(Boolean);

        return {
            points: pts.map(p => `${p.x},${p.y}`).join(' '),
            chartPoints: pts,
            periodMarkers: markers
        };
    }, [validCheckins, periods]);

    return (
        <div className="space-y-6 animate-slide-up pb-32">
            <button onClick={onBack} className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors">
                <ChevronLeft size={20} />
                <span className="text-sm font-medium">Tilbake</span>
            </button>

            <div className="grid grid-cols-2 gap-4">
                <Card className="p-5">
                    <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Endring</p>
                    <div className={`text-2xl font-semibold flex items-center gap-2 ${isDown ? 'text-emerald-600' : isSame ? 'text-ink-muted' : 'text-ink'}`}>
                        {totalChange > 0 ? '+' : ''}{totalChange.replace('.', ',')} kg
                        {isDown ? <TrendingDown size={20} /> : isSame ? <Minus size={20} /> : <TrendingUp size={20} />}
                    </div>
                </Card>
                <Card className="p-5">
                    <p className="text-xs text-ink-muted uppercase tracking-wide mb-1">Nåværende</p>
                    <p className="text-2xl font-semibold tabular-nums">{formatWeight(last.weight)} kg</p>
                </Card>
            </div>

            {validCheckins.length > 1 && (
                <Card className="relative p-4 overflow-visible">
                    <p className="text-xs text-ink-muted uppercase tracking-wide mb-3">Utvikling</p>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
                        <defs>
                            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#A3A3A3" />
                                <stop offset="100%" stopColor="#171717" />
                            </linearGradient>
                        </defs>
                        {periodMarkers.map((marker) => (
                            <g
                                key={marker.id}
                                onMouseEnter={() => {
                                    setHoveredMarkerId(marker.id);
                                    setActiveTooltip({
                                        id: marker.id,
                                        xPercent: (marker.x / width) * 100,
                                        text: marker.tooltipText
                                    });
                                }}
                                onMouseLeave={() => {
                                    setHoveredMarkerId(null);
                                    setActiveTooltip(null);
                                }}
                                onFocus={() => {
                                    setHoveredMarkerId(marker.id);
                                    setActiveTooltip({
                                        id: marker.id,
                                        xPercent: (marker.x / width) * 100,
                                        text: marker.tooltipText
                                    });
                                }}
                                onBlur={() => {
                                    setHoveredMarkerId(null);
                                    setActiveTooltip(null);
                                }}
                            >
                                <title>{marker.tooltipText}</title>
                                <line
                                    x1={marker.x}
                                    x2={marker.x}
                                    y1={chartTop}
                                    y2={chartBottom}
                                    stroke="transparent"
                                    strokeWidth="16"
                                />
                                <line
                                    x1={marker.x}
                                    x2={marker.x}
                                    y1={chartTop}
                                    y2={chartBottom}
                                    stroke="#B98D63"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 4"
                                />
                                <circle
                                    cx={marker.x}
                                    cy={chartTop}
                                    r="3"
                                    fill="#B98D63"
                                />
                            </g>
                        ))}
                        <polyline fill="none" stroke="url(#lineGradient)" strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
                        {chartPoints.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#FAFAF9" stroke="#171717" strokeWidth="2" />
                        ))}
                    </svg>
                    {activeTooltip && (
                        <div
                            className="pointer-events-none absolute top-10 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-medium text-surface-50 shadow-lg"
                            style={{
                                left: `${Math.max(20, Math.min(80, activeTooltip.xPercent))}%`
                            }}
                        >
                            {activeTooltip.text}
                        </div>
                    )}
                    {periodMarkers.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {periodMarkers.map((marker) => (
                                <Badge key={marker.id} variant="warning">
                                    {marker.label} · {marker.shortDate}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            <div className="space-y-2">
                <p className="text-xs text-ink-muted uppercase tracking-wide px-1">Historikk</p>
                {reversedCheckins.map((entry, i) => {
                    const prev = reversedCheckins[i+1];
                    const change = prev ? (parseFloat(entry.weight) - parseFloat(prev.weight)) : 0;

                    return (
                        <Card key={entry.id} className="p-4 flex justify-between items-center">
                            <div>
                                <p className="font-medium">{formatDateNO(entry.date)}</p>
                                <p className="text-xs text-ink-muted">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {prev && change !== 0 && (
                                    <Badge variant={change < 0 ? 'success' : 'muted'}>
                                        {change < 0 ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                        {change > 0 ? '+' : ''}{change.toFixed(1).replace('.', ',')}
                                    </Badge>
                                )}
                                <span className="font-semibold text-lg tabular-nums">{formatWeight(entry.weight)}</span>
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
});

export default WeightProgressView;
