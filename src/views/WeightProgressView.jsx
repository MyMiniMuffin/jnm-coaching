import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, Badge, Button, EmptyState, IconButton, PageTitle } from '../components/ui';
import { formatWeight, formatDateNO } from '../lib/formatters';
import { useShellRail } from '../hooks';

const EMPTY_LIST = [];
const EMPTY_CHART = {
    points: '',
    chartPoints: EMPTY_LIST,
    periodMarkers: EMPTY_LIST,
    dividersByEntryId: new Map(),
    yTicks: EMPTY_LIST,
    dateTicks: EMPTY_LIST
};

const WeightProgressView = React.memo(({ checkins = EMPTY_LIST, periods = EMPTY_LIST, onBack }) => {
    const isRail = useShellRail();
    const [selectedIndex, setSelectedIndex] = useState(null);
    const chartRef = useRef(null);
    const [width, setWidth] = useState(360);
    const checkinList = Array.isArray(checkins) ? checkins : EMPTY_LIST;
    const periodList = Array.isArray(periods) ? periods : EMPTY_LIST;

    // OPTIMALISERING: Memoize filtrering og sortering
    const validCheckins = useMemo(() =>
        checkinList.filter(c => Number.isFinite(parseFloat(c.weight)) && parseFloat(c.weight) > 0 && Number.isFinite(c.timestamp)).sort((a, b) => a.timestamp - b.timestamp),
        [checkinList]
    );

    useEffect(() => {
        const element = chartRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, [validCheckins.length]);

    useEffect(() => setSelectedIndex(null), [checkinList]);

    // OPTIMALISERING: Reverser en gang i stedet for i hver map-iterasjon
    const reversedCheckins = useMemo(() => [...validCheckins].reverse(), [validCheckins]);

    const height = 240;
    const chartLeft = 46;
    const chartRight = Math.max(chartLeft + 1, width - 16);
    const chartTop = 24;
    const chartBottom = height - 38;

    // Memoize tunge beregninger (min/max over alle vekter + SVG-koordinater)
    const { points, chartPoints, periodMarkers, dividersByEntryId, yTicks, dateTicks } = useMemo(() => {
        if (!validCheckins.length) return EMPTY_CHART;
        const weights = validCheckins.map(c => parseFloat(c.weight));
        const lowest = Math.min(...weights);
        const highest = Math.max(...weights);
        // Round the scale to readable steps, with at least 2 kg of vertical context.
        const rawStep = Math.max(2, highest - lowest + 1) / 4;
        const magnitude = 10 ** Math.floor(Math.log10(rawStep));
        const step = ([1, 2, 2.5, 5, 10].find(value => value * magnitude >= rawStep) ?? 10) * magnitude;
        if (!Number.isFinite(step) || step <= 0) return EMPTY_CHART;
        const margin = Math.max(0.5, (2 - (highest - lowest)) / 2);
        const minW = Math.floor((lowest - margin) / step) * step;
        const maxW = Math.ceil((highest + margin) / step) * step;
        const range = maxW - minW;
        if (!Number.isFinite(range) || range <= 0) return EMPTY_CHART;
        const yFor = weight => chartBottom - ((weight - minW) / range) * (chartBottom - chartTop);
        const tickCount = Math.min(24, Math.round(range / step) + 1);
        const yTicks = Array.from({ length: Math.max(2, tickCount) }, (_, i) => {
            const value = minW + i * step;
            return { value, y: yFor(value) };
        });
        const timestamps = validCheckins.map(c => c.timestamp);
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);

        const xFor = timestamp => minT === maxT
            ? (chartLeft + chartRight) / 2
            : chartLeft + ((timestamp - minT) / (maxT - minT)) * (chartRight - chartLeft);
        const pts = validCheckins.map(c => ({ x: xFor(c.timestamp), y: yFor(parseFloat(c.weight)) }));
        const dateTickCount = minT === maxT ? 1 : width < 480 ? 2 : width < 680 ? 4 : 6;
        const dateTicks = Array.from({ length: dateTickCount }, (_, i) => {
            const timestamp = minT + (maxT - minT) * (dateTickCount === 1 ? 0 : i / (dateTickCount - 1));
            return { timestamp, x: xFor(timestamp) };
        });

        const markers = periodList
            .filter(period => period?.startDate)
            .map(period => {
                const startTimestamp = new Date(period.startDate).getTime();
                // Only actual starts inside the displayed dates belong on this timeline.
                if (!Number.isFinite(startTimestamp) || startTimestamp < minT || startTimestamp > maxT) return null;
                const x = xFor(startTimestamp);

                return {
                    id: period.id,
                    x,
                    label: period.name || 'Ny runde',
                    shortDate: formatDateNO(period.startDate),
                    tooltipText: `${period.name || 'Ny runde'} startet ${formatDateNO(period.startDate)}`
                };
            })
            .filter(Boolean);

        const sortedPeriods = [...periodList]
            .filter(period => period?.startDate)
            .map(period => ({
                id: period.id,
                label: period.name || 'Ny runde',
                startTimestamp: new Date(period.startDate).getTime(),
                shortDate: formatDateNO(period.startDate)
            }))
            .filter(period => !Number.isNaN(period.startTimestamp))
            .sort((a, b) => b.startTimestamp - a.startTimestamp);

        const dividersByEntryId = new Map();
        for (const period of sortedPeriods) {
            const targetEntry = reversedCheckins.find((entry) => entry.timestamp <= period.startTimestamp);
            const fallbackEntry = reversedCheckins[reversedCheckins.length - 1];
            const entryId = targetEntry?.id ?? fallbackEntry?.id;
            if (!entryId) continue;
            const existing = dividersByEntryId.get(entryId) || [];
            dividersByEntryId.set(entryId, [...existing, {
                id: period.id,
                label: period.label,
                shortDate: period.shortDate
            }]);
        }

        return {
            points: pts.map(p => `${p.x},${p.y}`).join(' '),
            chartPoints: pts,
            periodMarkers: markers,
            dividersByEntryId,
            yTicks,
            dateTicks
        };
    }, [validCheckins, periodList, reversedCheckins, width, chartLeft, chartRight, chartBottom, chartTop]);

    if (validCheckins.length === 0) return (
        <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in" data-testid="weight-progress-view">
            <EmptyState
                title="Ingen vektdata ennå"
                description="Når en ukesrapport med vekt sendes inn, vises utviklingen her."
                action={!isRail ? <Button variant="secondary" onClick={onBack}>Tilbake</Button> : null}
            />
        </div>
    );

    const first = validCheckins[0];
    const last = validCheckins[validCheckins.length - 1];
    const totalChange = (parseFloat(last.weight) - parseFloat(first.weight)).toFixed(1);
    const isDown = parseFloat(totalChange) < 0;
    const isSame = parseFloat(totalChange) === 0;
    const lastIndex = validCheckins.length - 1;
    const activeIndex = Math.max(0, Math.min(Number.isFinite(selectedIndex) ? selectedIndex : lastIndex, lastIndex));
    const activeEntry = validCheckins[activeIndex];
    const activePoint = chartPoints[activeIndex];

    return (
        <div className="space-y-6 animate-slide-up pb-32 duo:pb-8" data-testid="weight-progress-view">
            <div className="flex items-center gap-2">
                {!isRail && (
                    <IconButton onClick={onBack} aria-label="Tilbake til oversikten" className="-ml-2" data-testid="weight-progress-back">
                        <ChevronLeft size={22} />
                    </IconButton>
                )}
                <PageTitle>Vektutvikling</PageTitle>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="p-5">
                    <p className="section-label mb-1">Total endring</p>
                    <div className={`text-2xl font-semibold flex items-center gap-2 ${isSame ? 'text-ink-muted' : 'text-ink'}`}>
                        {totalChange > 0 ? '+' : ''}{totalChange.replace('.', ',')} kg
                        {isDown ? <TrendingDown size={20} /> : isSame ? <Minus size={20} /> : <TrendingUp size={20} />}
                    </div>
                </Card>
                <Card className="p-5">
                    <p className="section-label mb-1">Siste måling</p>
                    <p className="text-2xl font-semibold tabular-nums">{formatWeight(last.weight)} kg</p>
                </Card>
            </div>

            <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <p className="section-label">Utvikling</p>
                    {activeEntry && (
                        <div className="text-right" aria-live="polite" aria-atomic="true">
                            <p className="font-semibold tabular-nums">{formatWeight(activeEntry.weight)} kg</p>
                            <p className="text-xs text-ink-muted">{formatDateNO(activeEntry.date || activeEntry.timestamp)}</p>
                        </div>
                    )}
                </div>
                <div ref={chartRef} className="mt-3">
                    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full overflow-visible" role="group" aria-label="Vektutvikling. Velg et målepunkt for å se dato og vekt.">
                        {yTicks.map(tick => (
                            <g key={tick.value}>
                                <line x1={chartLeft} x2={chartRight} y1={tick.y} y2={tick.y} className="stroke-surface-200" strokeDasharray="3 4" />
                                <text x={chartLeft - 10} y={tick.y} dy="0.35em" textAnchor="end" className="fill-ink-muted text-xs tabular-nums">{tick.value.toLocaleString('nb-NO', { maximumFractionDigits: 1 })}</text>
                            </g>
                        ))}
                        {dateTicks.map((tick, i) => (
                            <text key={tick.timestamp} x={tick.x} y={height - 12} textAnchor={dateTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === dateTicks.length - 1 ? 'end' : 'middle'} className="fill-ink-muted text-xs">
                                {formatDateNO(tick.timestamp)}
                            </text>
                        ))}
                        {periodMarkers.map(marker => (
                            <line key={marker.id} x1={marker.x} x2={marker.x} y1={chartTop} y2={chartBottom} className="stroke-accent/40" strokeWidth="1.5" strokeDasharray="4 4">
                                <title>{marker.tooltipText}</title>
                            </line>
                        ))}
                        <polyline fill="none" className="stroke-accent" strokeWidth="2.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
                        {activePoint && (
                            <line x1={activePoint.x} x2={activePoint.x} y1={chartTop} y2={chartBottom} className="stroke-ink/20" strokeDasharray="2 4" pointerEvents="none" />
                        )}
                        {chartPoints.map((point, i) => (
                            <g
                                key={validCheckins[i].id ?? i}
                                role="button"
                                tabIndex={i === activeIndex ? 0 : -1}
                                aria-label={`${formatDateNO(validCheckins[i].date || validCheckins[i].timestamp)}: ${formatWeight(validCheckins[i].weight)} kg`}
                                aria-pressed={i === activeIndex}
                                className="cursor-pointer outline-none group"
                                onMouseEnter={() => setSelectedIndex(i)}
                                onClick={() => setSelectedIndex(i)}
                                onFocus={() => setSelectedIndex(i)}
                                onKeyDown={event => {
                                    const next = event.key === 'ArrowLeft' ? Math.max(0, i - 1)
                                        : event.key === 'ArrowRight' ? Math.min(chartPoints.length - 1, i + 1)
                                        : event.key === 'Home' ? 0
                                        : event.key === 'End' ? chartPoints.length - 1 : null;
                                    if (next !== null) {
                                        event.preventDefault();
                                        setSelectedIndex(next);
                                        event.currentTarget.parentElement.querySelectorAll('[role="button"]')[next]?.focus();
                                    } else if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setSelectedIndex(i);
                                    }
                                }}
                            >
                                <circle cx={point.x} cy={point.y} r="22" fill="transparent" />
                                <circle cx={point.x} cy={point.y} r="10" className="fill-none stroke-accent opacity-0 group-focus-visible:opacity-100" strokeWidth="2" />
                                <circle cx={point.x} cy={point.y} r={i === activeIndex ? 5 : 3.5} className={i === activeIndex ? 'fill-accent stroke-white' : 'fill-white stroke-accent'} strokeWidth="2" pointerEvents="none" />
                            </g>
                        ))}
                    </svg>
                </div>
            </Card>

            <div className="space-y-2">
                <p className="section-label px-1">Historikk</p>
                {reversedCheckins.map((entry, i) => {
                    const prev = reversedCheckins[i+1];
                    const change = prev ? (parseFloat(entry.weight) - parseFloat(prev.weight)) : 0;
                    const dividers = dividersByEntryId.get(entry.id) || [];

                    return (
                        <div key={entry.id} className="space-y-2">
                            {dividers.map(divider => (
                                <div key={divider.id} className="flex items-center gap-3 px-1 pt-2">
                                    <div className="h-px flex-1 bg-accent/30" />
                                    <div className="text-xs font-medium text-accent">
                                        {divider.label} startet {divider.shortDate}
                                    </div>
                                    <div className="h-px flex-1 bg-accent/30" />
                                </div>
                            ))}
                            <Card className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{formatDateNO(entry.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {prev && change !== 0 && (
                                        <Badge variant="muted">
                                            {change < 0 ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                            {change > 0 ? '+' : ''}{change.toFixed(1).replace('.', ',')}
                                        </Badge>
                                    )}
                                    <span className="font-semibold text-lg tabular-nums">{formatWeight(entry.weight)}</span>
                                </div>
                            </Card>
                        </div>
                    )
                })}
            </div>
        </div>
    );
});

export default WeightProgressView;
