import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Utensils,
    Dumbbell,
    Pencil,
    Loader2,
    Check,
    FileText,
    RotateCcw,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    ListChecks,
    Download,
    Upload,
    CornerDownRight
} from 'lucide-react';
import { Card, Button, EmptyState } from '../components/ui';
import {
    createSection,
    getPlanTemplate,
    parsePlainTextPlan,
    parsePlan,
    serializePlan,
    serializePlanAsPlainText
} from '../lib/planFormat';

const moveInArray = (items, from, to) => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
};

const SmallIconButton = ({ label, disabled = false, tone = 'neutral', compact = false, children, ...props }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent ${compact ? 'h-9 w-9' : 'h-10 w-10'} ${tone === 'danger' ? 'text-ink-faint hover:bg-error/10 hover:text-error' : 'text-ink-muted hover:bg-surface-100 hover:text-ink'}`}
        {...props}
    >
        {children}
    </button>
);

const AutoGrowTextarea = ({ value, onChange, ...props }) => {
    const ref = useRef(null);

    useEffect(() => {
        const field = ref.current;
        if (!field) return;
        field.style.height = 'auto';
        field.style.height = `${field.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={onChange}
            {...props}
        />
    );
};

const PlanSection = React.memo(({ type, content, onSave, isReadOnly }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draft, setDraft] = useState(() => parsePlan(content, type));
    const [saveState, setSaveState] = useState('idle');
    const [showTextImport, setShowTextImport] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState('');
    const importFileRef = useRef(null);
    const parsedPlan = useMemo(() => parsePlan(content, type), [content, type]);

    useEffect(() => {
        if (isEditing) return;
        setDraft(parsedPlan);
        setSaveState('idle');
    }, [parsedPlan, isEditing]);

    useEffect(() => {
        if (saveState !== 'saved') return;
        const timeoutId = setTimeout(() => setSaveState('idle'), 1800);
        return () => clearTimeout(timeoutId);
    }, [saveState]);

    const Icon = type === 'diet' ? Utensils : Dumbbell;
    const title = type === 'diet' ? 'Matplan' : 'Treningsplan';
    const itemPlaceholder = type === 'diet'
        ? 'For eksempel: Havregrøt med bær'
        : 'For eksempel: Knebøy';
    const editorHint = type === 'diet'
        ? 'Del planen inn i måltider eller andre fokusområder.'
        : 'Del planen inn i treningsdager eller andre fokusområder.';
    const canSave = saveState === 'dirty' && !isSaving;

    const markChanged = useCallback((update) => {
        setDraft(current => typeof update === 'function' ? update(current) : update);
        setSaveState('dirty');
    }, []);

    const handleStartEditing = useCallback(() => {
        setDraft(parsePlan(content, type));
        setSaveState('idle');
        setShowTextImport(false);
        setImportText('');
        setImportError('');
        setIsEditing(true);
    }, [content, type]);

    const handleSave = useCallback(async () => {
        if (!canSave) return;
        setIsSaving(true);
        setSaveState('saving');
        try {
            await onSave(serializePlan(draft));
            setSaveState('saved');
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    }, [canSave, draft, onSave]);

    const handleCancel = useCallback(() => {
        setDraft(parsePlan(content, type));
        setSaveState('idle');
        setShowTextImport(false);
        setImportText('');
        setImportError('');
        setIsEditing(false);
    }, [content, type]);

    const updateSection = useCallback((sectionIndex, update) => {
        markChanged(current => ({
            ...current,
            sections: current.sections.map((section, index) => index === sectionIndex ? update(section) : section)
        }));
    }, [markChanged]);

    const updateItem = useCallback((sectionIndex, itemIndex, field, value) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? { ...item, [field]: value } : item)
        }));
    }, [updateSection]);

    const addItem = useCallback((sectionIndex, afterIndex = null) => {
        const newItem = createSection('', [''], type).items[0];
        updateSection(sectionIndex, section => {
            const items = [...section.items];
            const insertAt = afterIndex === null ? items.length : afterIndex + 1;
            items.splice(insertAt, 0, newItem);
            return { ...section, items };
        });
        requestAnimationFrame(() => {
            const section = document.querySelector(`[data-section="${sectionIndex}"]`);
            const fields = section?.querySelectorAll('textarea');
            const targetIndex = afterIndex === null ? (fields?.length || 1) - 1 : afterIndex + 1;
            fields?.[targetIndex]?.focus();
        });
    }, [type, updateSection]);

    const removeItem = useCallback((sectionIndex, itemIndex) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.filter((_, index) => index !== itemIndex)
        }));
    }, [updateSection]);

    const moveItem = useCallback((sectionIndex, itemIndex, direction) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: moveInArray(section.items, itemIndex, itemIndex + direction)
        }));
    }, [updateSection]);

    const updateSubItem = useCallback((sectionIndex, itemIndex, subItemIndex, value) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? {
                ...item,
                subItems: (item.subItems || []).map((subItem, subIndex) => subIndex === subItemIndex ? { ...subItem, text: value } : subItem)
            } : item)
        }));
    }, [updateSection]);

    const addSubItem = useCallback((sectionIndex, itemIndex) => {
        const subItem = { key: `sub-item-${Date.now()}-${sectionIndex}-${itemIndex}`, text: '' };
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? {
                ...item,
                subItems: [...(item.subItems || []), subItem]
            } : item)
        }));
        requestAnimationFrame(() => document.querySelector(`[data-sub-item="${sectionIndex}-${itemIndex}-new"]`)?.focus());
    }, [updateSection]);

    const removeSubItem = useCallback((sectionIndex, itemIndex, subItemIndex) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? {
                ...item,
                subItems: (item.subItems || []).filter((_, subIndex) => subIndex !== subItemIndex)
            } : item)
        }));
    }, [updateSection]);

    const moveSubItem = useCallback((sectionIndex, itemIndex, subItemIndex, direction) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? {
                ...item,
                subItems: moveInArray(item.subItems || [], subItemIndex, subItemIndex + direction)
            } : item)
        }));
    }, [updateSection]);

    const addSection = useCallback(() => {
        markChanged(current => ({ ...current, sections: [...current.sections, createSection('', [''], type)] }));
        requestAnimationFrame(() => document.querySelector('[data-new-section="true"]')?.focus());
    }, [markChanged, type]);

    const removeSection = useCallback((sectionIndex) => {
        markChanged(current => ({
            ...current,
            sections: current.sections.filter((_, index) => index !== sectionIndex)
        }));
    }, [markChanged]);

    const moveSection = useCallback((sectionIndex, direction) => {
        markChanged(current => ({
            ...current,
            sections: moveInArray(current.sections, sectionIndex, sectionIndex + direction)
        }));
    }, [markChanged]);

    const insertTemplate = useCallback(() => markChanged(getPlanTemplate(type)), [markChanged, type]);

    const handleExportText = useCallback(() => {
        const text = serializePlanAsPlainText(isEditing ? draft : parsedPlan);
        if (!text) return;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'matplan.txt';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }, [draft, isEditing, parsedPlan]);

    const handleOpenTextImport = useCallback(() => {
        setImportText('');
        setImportError('');
        setShowTextImport(true);
    }, []);

    const handleCloseTextImport = useCallback(() => {
        setShowTextImport(false);
        setImportText('');
        setImportError('');
    }, []);

    const handleImportFile = useCallback(async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setImportText(await file.text());
        setImportError('');
        setShowTextImport(true);
    }, []);

    const handleApplyTextImport = useCallback(() => {
        const importedPlan = parsePlainTextPlan(importText, 'diet');
        if (!importedPlan.sections.length || importedPlan.sections.every(section => section.items.length === 0)) {
            setImportError('Lim inn en matplan med minst én matvare.');
            return;
        }
        markChanged(importedPlan);
        handleCloseTextImport();
    }, [handleCloseTextImport, importText, markChanged]);

    const displayPlan = isEditing ? draft : parsedPlan;

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            <Card className="overflow-hidden">
                <div className="flex justify-between items-center gap-3 p-5 border-b border-surface-100 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-surface-100 flex items-center justify-center text-ink-muted">
                            <Icon size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[1.05rem] font-semibold">{title}</h2>
                            {!isReadOnly && isEditing && (
                                <p className="section-label mt-0.5">
                                    {saveState === 'saving' ? 'Lagrer endringer...' : saveState === 'dirty' ? 'Ulagrede endringer' : 'Rediger seksjoner og punkter'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {type === 'diet' && !isEditing && parsedPlan.sections.length > 0 && (
                            <Button aria-label="Eksporter matplan som tekstfil" title="Eksporter matplan som tekstfil" variant="ghost" size="sm" onClick={handleExportText} className="px-2 sm:px-3">
                                <Download size={16} /> <span className="hidden sm:inline">Eksporter</span>
                            </Button>
                        )}
                        {!isReadOnly && (
                            isEditing ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button aria-label="Avbryt redigering" variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="px-2 sm:px-3">
                                        <RotateCcw size={16} /> <span className="hidden sm:inline">Avbryt</span>
                                    </Button>
                                    <Button aria-label="Lagre planen" variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        <span className="hidden sm:inline">{isSaving ? 'Lagrer...' : 'Lagre'}</span>
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="secondary" size="sm" onClick={handleStartEditing}>
                                    <Pencil size={16} /> Rediger
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {isEditing && !isReadOnly && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 bg-white px-5 py-3.5">
                        <p className="text-sm text-ink-muted">{editorHint}</p>
                        <div className="flex flex-wrap gap-2">
                            {type === 'diet' && (
                                <>
                                    <input ref={importFileRef} type="file" accept="text/plain,.txt" className="hidden" onChange={handleImportFile} />
                                    <Button variant="ghost" size="sm" onClick={handleExportText} disabled={draft.sections.length === 0}>
                                        <Download size={16} /> Eksporter
                                    </Button>
                                    <Button variant="secondary" size="sm" onClick={handleOpenTextImport}>
                                        <Upload size={16} /> Importer tekst
                                    </Button>
                                </>
                            )}
                            <Button variant="secondary" size="sm" onClick={insertTemplate}>
                                <FileText size={16} /> Bruk forslag
                            </Button>
                        </div>
                    </div>
                )}

                {type === 'diet' && isEditing && !isReadOnly && showTextImport && (
                    <div className="border-b border-surface-100 bg-surface-50 p-4 sm:p-5">
                        <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-semibold text-ink">Importer matplan fra tekst</h3>
                                <p className="mt-1 text-sm text-ink-muted">Bruk hakeparenteser rundt måltider, én matvare per linje og innrykk for valg.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => importFileRef.current?.click()} className="shrink-0 whitespace-nowrap">
                                Velg .txt-fil
                            </Button>
                        </div>
                        <textarea
                            value={importText}
                            onChange={event => {
                                setImportText(event.target.value);
                                setImportError('');
                            }}
                            rows={10}
                            className={`w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-accent focus:ring-2 focus:ring-accent ${importError ? 'border-error/40' : 'border-surface-200'}`}
                            placeholder={'[Frokost]\nHavregrøt\n  - med bær\n  - med banan\nKaffe eller vann\n\n[Lunsj]\nKylling, ris og grønnsaker'}
                            aria-label="Matplan i ren tekst"
                        />
                        {importError && <p className="mt-1.5 text-xs text-error">{importError}</p>}
                        <p className="mt-2 text-xs text-ink-muted">Importen erstatter innholdet i editoren. Endringen lagres først når du trykker «Lagre».</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCloseTextImport}>Avbryt</Button>
                            <Button size="sm" onClick={handleApplyTextImport} disabled={!importText.trim()}>
                                <Upload size={16} /> Bruk teksten
                            </Button>
                        </div>
                    </div>
                )}

                <div className={type === 'diet' ? 'p-4 sm:p-5' : 'p-5'}>
                    {displayPlan.sections.length === 0 ? (
                        <EmptyState
                            icon={ListChecks}
                            title="Ingen plan enda"
                            description={isReadOnly ? 'Planen kommer her når coachen har lagt den inn.' : 'Start med et forslag eller bygg planen fra bunnen.'}
                            action={isEditing && !isReadOnly ? (
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button variant="secondary" onClick={insertTemplate}><FileText size={17} /> Bruk forslag</Button>
                                    <Button onClick={addSection}><Plus size={17} /> Ny seksjon</Button>
                                </div>
                            ) : null}
                        />
                    ) : isEditing && !isReadOnly ? (
                        <div className="space-y-8">
                            {displayPlan.sections.map((section, sectionIndex) => (
                                <div key={section.key} data-section={sectionIndex}>
                                    <div className="mb-4">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="section-label tabular-nums">Seksjon {String(sectionIndex + 1).padStart(2, '0')}</span>
                                            <div className="flex items-center">
                                                <SmallIconButton label="Flytt seksjonen opp" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}><ArrowUp size={16} /></SmallIconButton>
                                                <SmallIconButton label="Flytt seksjonen ned" disabled={sectionIndex === displayPlan.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}><ArrowDown size={16} /></SmallIconButton>
                                                <SmallIconButton label="Slett seksjonen" tone="danger" onClick={() => removeSection(sectionIndex)}><Trash2 size={16} /></SmallIconButton>
                                            </div>
                                        </div>
                                        <label className="sr-only" htmlFor={`plan-section-${section.key}`}>Seksjonsnavn</label>
                                        <input
                                            id={`plan-section-${section.key}`}
                                            data-new-section={sectionIndex === displayPlan.sections.length - 1 ? 'true' : undefined}
                                            value={section.title}
                                            onChange={event => updateSection(sectionIndex, current => ({ ...current, title: event.target.value }))}
                                            className={`w-full border-0 border-b border-surface-300 bg-transparent px-0 py-2 leading-tight outline-none focus:border-accent focus:ring-0 ${type === 'diet' ? 'text-[1.05rem] font-semibold' : 'font-display text-[1.4rem]'}`}
                                            placeholder={type === 'diet' ? 'For eksempel: Frokost' : 'For eksempel: Dag 1 – Underkropp'}
                                        />
                                    </div>

                                    <div>
                                        {type === 'workout' && section.items.length > 0 && (
                                            <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_5rem] gap-2 bg-surface-50 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem]">
                                                <span className="section-label">Øvelse</span>
                                                <span className="section-label text-center">Sett</span>
                                                <span className="section-label text-center">Reps</span>
                                            </div>
                                        )}
                                        {section.items.map((item, itemIndex) => (
                                            type === 'workout' ? (
                                                <div key={item.key} className="px-3 py-2.5">
                                                    <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_5rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem]">
                                                        <AutoGrowTextarea
                                                            aria-label={`Øvelse ${itemIndex + 1}`}
                                                            data-item={itemIndex}
                                                            value={item.text}
                                                            onChange={event => updateItem(sectionIndex, itemIndex, 'text', event.target.value)}
                                                            onKeyDown={event => {
                                                                if (event.key === 'Enter' && !event.shiftKey) {
                                                                    event.preventDefault();
                                                                    addItem(sectionIndex, itemIndex);
                                                                }
                                                            }}
                                                            className="min-h-[2.5rem] w-full resize-none overflow-hidden rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm leading-6 outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent"
                                                            placeholder={itemPlaceholder}
                                                        />
                                                        <input
                                                            aria-label={`Sett for øvelse ${itemIndex + 1}`}
                                                            value={item.sets || ''}
                                                            onChange={event => updateItem(sectionIndex, itemIndex, 'sets', event.target.value)}
                                                            inputMode="numeric"
                                                            className="h-[2.5rem] w-full rounded-lg border border-surface-200 bg-white px-2 text-center text-sm font-semibold tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                                                            placeholder="3"
                                                        />
                                                        <input
                                                            aria-label={`Reps for øvelse ${itemIndex + 1}`}
                                                            value={item.reps || ''}
                                                            onChange={event => updateItem(sectionIndex, itemIndex, 'reps', event.target.value)}
                                                            inputMode="text"
                                                            className="h-[2.5rem] w-full rounded-lg border border-surface-200 bg-white px-2 text-center text-sm font-semibold tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                                                            placeholder="8–10"
                                                        />
                                                    </div>
                                                    <div className="mt-1.5 flex items-center justify-between">
                                                        <span className="text-[11px] tabular-nums text-ink-faint">Øvelse {String(itemIndex + 1).padStart(2, '0')}</span>
                                                        <div className="flex items-center">
                                                            <SmallIconButton label="Flytt øvelsen opp" disabled={itemIndex === 0} onClick={() => moveItem(sectionIndex, itemIndex, -1)}><ArrowUp size={15} /></SmallIconButton>
                                                            <SmallIconButton label="Flytt øvelsen ned" disabled={itemIndex === section.items.length - 1} onClick={() => moveItem(sectionIndex, itemIndex, 1)}><ArrowDown size={15} /></SmallIconButton>
                                                            <SmallIconButton label="Slett øvelsen" tone="danger" onClick={() => removeItem(sectionIndex, itemIndex)}><Trash2 size={15} /></SmallIconButton>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={item.key} className="py-0.5">
                                                    <div className="flex items-start gap-1.5">
                                                        <span className="mt-1.5 w-5 shrink-0 text-[11px] tabular-nums text-ink-faint">{String(itemIndex + 1).padStart(2, '0')}</span>
                                                        <AutoGrowTextarea
                                                            aria-label={`Punkt ${itemIndex + 1}`}
                                                            data-item={itemIndex}
                                                            value={item.text}
                                                            onChange={event => updateItem(sectionIndex, itemIndex, 'text', event.target.value)}
                                                            onKeyDown={event => {
                                                                if (event.key === 'Enter' && !event.shiftKey) {
                                                                    event.preventDefault();
                                                                    addItem(sectionIndex, itemIndex);
                                                                }
                                                            }}
                                                            className="min-h-8 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:text-ink-faint"
                                                            placeholder={itemPlaceholder}
                                                        />
                                                        <div className="flex shrink-0 items-center">
                                                            <SmallIconButton compact label="Flytt punktet opp" disabled={itemIndex === 0} onClick={() => moveItem(sectionIndex, itemIndex, -1)}><ArrowUp size={14} /></SmallIconButton>
                                                            <SmallIconButton compact label="Flytt punktet ned" disabled={itemIndex === section.items.length - 1} onClick={() => moveItem(sectionIndex, itemIndex, 1)}><ArrowDown size={14} /></SmallIconButton>
                                                            <SmallIconButton compact label="Slett punktet" tone="danger" onClick={() => removeItem(sectionIndex, itemIndex)}><Trash2 size={14} /></SmallIconButton>
                                                        </div>
                                                    </div>

                                                    {(item.subItems || []).map((subItem, subItemIndex) => (
                                                        <div key={subItem.key} className="ml-6 flex items-start gap-1 border-l border-surface-200 pl-2">
                                                            <CornerDownRight className="mt-2 shrink-0 text-ink-faint" size={13} />
                                                            <AutoGrowTextarea
                                                                aria-label={`Valg ${subItemIndex + 1} under punkt ${itemIndex + 1}`}
                                                                data-sub-item={subItemIndex === (item.subItems || []).length - 1 ? `${sectionIndex}-${itemIndex}-new` : undefined}
                                                                value={subItem.text}
                                                                onChange={event => updateSubItem(sectionIndex, itemIndex, subItemIndex, event.target.value)}
                                                                onKeyDown={event => {
                                                                    if (event.key === 'Enter' && !event.shiftKey) {
                                                                        event.preventDefault();
                                                                        addSubItem(sectionIndex, itemIndex);
                                                                    }
                                                                }}
                                                                className="min-h-8 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-1 py-1 text-[0.82rem] leading-5 text-ink-muted outline-none placeholder:text-ink-faint"
                                                                placeholder="For eksempel: med bær"
                                                            />
                                                            <div className="flex shrink-0 items-center">
                                                                <SmallIconButton compact label="Flytt valget opp" disabled={subItemIndex === 0} onClick={() => moveSubItem(sectionIndex, itemIndex, subItemIndex, -1)}><ArrowUp size={13} /></SmallIconButton>
                                                                <SmallIconButton compact label="Flytt valget ned" disabled={subItemIndex === (item.subItems || []).length - 1} onClick={() => moveSubItem(sectionIndex, itemIndex, subItemIndex, 1)}><ArrowDown size={13} /></SmallIconButton>
                                                                <SmallIconButton compact label="Slett valget" tone="danger" onClick={() => removeSubItem(sectionIndex, itemIndex, subItemIndex)}><Trash2 size={13} /></SmallIconButton>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={() => addSubItem(sectionIndex, itemIndex)}
                                                        className="ml-7 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                    >
                                                        <CornerDownRight size={13} /> Legg til valg
                                                    </button>
                                                </div>
                                            )
                                        ))}
                                        <Button variant="ghost" size="sm" onClick={() => addItem(sectionIndex)} className="mt-2">
                                            <Plus size={16} /> {type === 'workout' ? 'Legg til øvelse' : 'Legg til punkt'}
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <Button variant="secondary" onClick={addSection} className="w-full border border-dashed border-surface-300 bg-transparent py-3 shadow-none">
                                <Plus size={17} /> Legg til seksjon
                            </Button>
                        </div>
                    ) : (
                        <div className={type === 'diet' ? 'space-y-4' : 'space-y-7'}>
                            {displayPlan.sections.map(section => (
                                <section key={section.key}>
                                    {section.title && (
                                        <h3 className={`leading-tight text-ink ${type === 'diet' ? 'text-[1.08rem] font-semibold' : 'font-display text-[1.4rem]'}`}>{section.title}</h3>
                                    )}
                                    {section.items.length > 0 && (
                                        type === 'workout' && section.items.some(item => item.sets || item.reps) ? (
                                            <div className={`${section.title ? 'mt-3' : ''} overflow-hidden`}>
                                                <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_5rem] gap-2 bg-surface-50 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem]">
                                                    <span className="section-label">Øvelse</span>
                                                    <span className="section-label text-center">Sett</span>
                                                    <span className="section-label text-center">Reps</span>
                                                </div>
                                                <ul className="divide-y divide-surface-100">
                                                    {section.items.map(item => (
                                                        <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_3.75rem_5rem] items-center gap-2 px-3 py-3 text-[0.95rem] leading-6 text-ink/85 sm:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem]">
                                                            <span className="min-w-0 whitespace-pre-wrap font-medium">{item.text}</span>
                                                            <span className="text-center font-semibold tabular-nums text-ink">{item.sets || '—'}</span>
                                                            <span className="break-words text-center font-semibold tabular-nums leading-5 text-ink">{item.reps || '—'}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <ul className={`${section.title ? 'mt-1.5' : ''} space-y-0`}>
                                                {section.items.map(item => (
                                                    <li key={item.key} className="px-1 py-0.5 text-sm leading-5 text-ink/80">
                                                        <div className="flex items-start gap-2">
                                                            <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
                                                            <span className="whitespace-pre-wrap">{item.text}</span>
                                                        </div>
                                                        {(item.subItems || []).length > 0 && (
                                                            <ul className="ml-4 mt-0.5 space-y-0 border-l border-surface-200 pl-2.5">
                                                                {item.subItems.map(subItem => (
                                                                    <li key={subItem.key} className="flex items-start gap-1.5 py-0 text-[0.82rem] leading-5 text-ink-muted">
                                                                        <span className="text-ink-faint">–</span>
                                                                        <span className="whitespace-pre-wrap">{subItem.text}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )
                                    )}
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
});

export default PlanSection;
