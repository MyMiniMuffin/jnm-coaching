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
    ListChecks
} from 'lucide-react';
import { Card, Button, EmptyState } from '../components/ui';
import { createSection, getPlanTemplate, parsePlan, serializePlan } from '../lib/planFormat';

const moveInArray = (items, from, to) => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
};

const SmallIconButton = ({ label, disabled = false, tone = 'neutral', children, ...props }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent ${tone === 'danger' ? 'text-ink-faint hover:bg-red-50 hover:text-red-600' : 'text-ink-muted hover:bg-surface-100 hover:text-ink'}`}
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
    const [draft, setDraft] = useState(() => parsePlan(content));
    const [saveState, setSaveState] = useState('idle');
    const parsedPlan = useMemo(() => parsePlan(content), [content]);

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
        : 'For eksempel: Knebøy – 4 × 6';
    const canSave = saveState === 'dirty' && !isSaving;

    const markChanged = useCallback((update) => {
        setDraft(current => typeof update === 'function' ? update(current) : update);
        setSaveState('dirty');
    }, []);

    const handleStartEditing = useCallback(() => {
        setDraft(parsePlan(content));
        setSaveState('idle');
        setIsEditing(true);
    }, [content]);

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
        setDraft(parsePlan(content));
        setSaveState('idle');
        setIsEditing(false);
    }, [content]);

    const updateSection = useCallback((sectionIndex, update) => {
        markChanged(current => ({
            ...current,
            sections: current.sections.map((section, index) => index === sectionIndex ? update(section) : section)
        }));
    }, [markChanged]);

    const updateItem = useCallback((sectionIndex, itemIndex, text) => {
        updateSection(sectionIndex, section => ({
            ...section,
            items: section.items.map((item, index) => index === itemIndex ? { ...item, text } : item)
        }));
    }, [updateSection]);

    const addItem = useCallback((sectionIndex, afterIndex = null) => {
        const newItem = createSection('', ['']).items[0];
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
    }, [updateSection]);

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

    const addSection = useCallback(() => {
        markChanged(current => ({ ...current, sections: [...current.sections, createSection('', [''])] }));
        requestAnimationFrame(() => document.querySelector('[data-new-section="true"]')?.focus());
    }, [markChanged]);

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

    const displayPlan = isEditing ? draft : parsedPlan;

    return (
        <div className="space-y-5 pb-32 animate-slide-up">
            <Card className="overflow-hidden">
                <div className="flex justify-between items-center gap-3 p-5 border-b border-surface-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 bg-surface-100 rounded-xl flex items-center justify-center text-ink-muted">
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

                {isEditing && !isReadOnly && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 bg-surface-50/70 px-5 py-3.5">
                        <p className="text-sm text-ink-muted">Én seksjon per måltid, treningsdag eller fokusområde.</p>
                        <Button variant="secondary" size="sm" onClick={insertTemplate}>
                            <FileText size={16} /> Bruk forslag
                        </Button>
                    </div>
                )}

                <div className="p-5">
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
                        <div className="space-y-4">
                            {displayPlan.sections.map((section, sectionIndex) => (
                                <div key={section.key} data-section={sectionIndex} className="rounded-xl border border-surface-200 bg-surface-50/65 p-3.5 sm:p-4">
                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <label className="section-label mb-1.5 block" htmlFor={`plan-section-${section.key}`}>Seksjonsnavn</label>
                                            <input
                                                id={`plan-section-${section.key}`}
                                                data-new-section={sectionIndex === displayPlan.sections.length - 1 ? 'true' : undefined}
                                                value={section.title}
                                                onChange={event => updateSection(sectionIndex, current => ({ ...current, title: event.target.value }))}
                                                className="w-full rounded-lg border border-surface-200 bg-white px-3.5 py-2.5 font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                                                placeholder={type === 'diet' ? 'For eksempel: Frokost' : 'For eksempel: Dag 1 – Underkropp'}
                                            />
                                        </div>
                                        <div className="flex items-center pt-5">
                                            <SmallIconButton label="Flytt seksjonen opp" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}><ArrowUp size={16} /></SmallIconButton>
                                            <SmallIconButton label="Flytt seksjonen ned" disabled={sectionIndex === displayPlan.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}><ArrowDown size={16} /></SmallIconButton>
                                            <SmallIconButton label="Slett seksjonen" tone="danger" onClick={() => removeSection(sectionIndex)}><Trash2 size={16} /></SmallIconButton>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <p className="section-label">Punkter</p>
                                        {section.items.map((item, itemIndex) => (
                                            <div key={item.key} className="flex items-start gap-2 rounded-lg bg-white p-2 border border-surface-100">
                                                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold text-ink-muted">{itemIndex + 1}</span>
                                                <AutoGrowTextarea
                                                    data-item={itemIndex}
                                                    value={item.text}
                                                    onChange={event => updateItem(sectionIndex, itemIndex, event.target.value)}
                                                    onKeyDown={event => {
                                                        if (event.key === 'Enter' && !event.shiftKey) {
                                                            event.preventDefault();
                                                            addItem(sectionIndex, itemIndex);
                                                        }
                                                    }}
                                                    className="min-h-[2.5rem] min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-ink-faint"
                                                    placeholder={itemPlaceholder}
                                                />
                                                <div className="flex shrink-0 items-center">
                                                    <SmallIconButton label="Flytt punktet opp" disabled={itemIndex === 0} onClick={() => moveItem(sectionIndex, itemIndex, -1)}><ArrowUp size={15} /></SmallIconButton>
                                                    <SmallIconButton label="Flytt punktet ned" disabled={itemIndex === section.items.length - 1} onClick={() => moveItem(sectionIndex, itemIndex, 1)}><ArrowDown size={15} /></SmallIconButton>
                                                    <SmallIconButton label="Slett punktet" tone="danger" onClick={() => removeItem(sectionIndex, itemIndex)}><Trash2 size={15} /></SmallIconButton>
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="ghost" size="sm" onClick={() => addItem(sectionIndex)} className="mt-1">
                                            <Plus size={16} /> Legg til punkt
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <Button variant="secondary" onClick={addSection} className="w-full border border-dashed border-surface-300 bg-transparent shadow-none">
                                <Plus size={17} /> Legg til seksjon
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {displayPlan.sections.map(section => (
                                <section key={section.key} className="rounded-xl border border-surface-200 bg-gradient-to-b from-white to-surface-50/55 p-4 sm:p-5">
                                    {section.title && <h3 className="font-display text-[1.3rem] leading-tight text-ink">{section.title}</h3>}
                                    {section.items.length > 0 && (
                                        <ul className={`${section.title ? 'mt-3' : ''} space-y-2.5`}>
                                            {section.items.map(item => (
                                                <li key={item.key} className="flex items-start gap-3 text-[0.95rem] leading-6 text-ink/85">
                                                    <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/75" />
                                                    <span className="whitespace-pre-wrap">{item.text}</span>
                                                </li>
                                            ))}
                                        </ul>
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
