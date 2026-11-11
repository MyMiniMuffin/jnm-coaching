import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, Check, DotsThree, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { Button, IconButton } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import { parseNamedPlans, serializeNamedPlans } from '../lib/namedPlans';
import PlanSection from './PlanSection';

const MENU_ITEM = 'flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

// Meny for ny/gi nytt navn/slett ved plannavnet. Følger ClientActionsMenu: ikonknapp + role="menu".
const PlanMenu = ({ label, disabled, canDelete, newLabel, onNew, onRename, onDelete }) => {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector('[role="menuitem"]')?.focus();
        const close = (event) => {
            if (event.type === 'keydown') {
                if (event.key === 'Escape') {
                    setOpen(false);
                    menuRef.current?.querySelector('[aria-haspopup="menu"]')?.focus();
                } else if (event.key === 'Tab') {
                    setOpen(false);
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
                    const index = items.indexOf(document.activeElement);
                    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                    items[next]?.focus();
                }
                return;
            }
            if (!menuRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);

    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    const run = (action) => {
        setOpen(false);
        menuRef.current?.querySelector('[aria-haspopup="menu"]')?.focus();
        action();
    };

    return (
        <div className="relative" ref={menuRef}>
            <IconButton
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                className="touch-manipulation disabled:opacity-50"
                onClick={() => setOpen(value => !value)}
            >
                <DotsThree size={18} />
            </IconButton>
            {open && (
                <div role="menu" aria-label={label} className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-surface-200 bg-white p-1 shadow-lg">
                    <button type="button" role="menuitem" className={`${MENU_ITEM} text-ink [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-100`} onClick={() => run(onNew)}>
                        <Plus size={16} /> {newLabel}
                    </button>
                    <button type="button" role="menuitem" className={`${MENU_ITEM} text-ink [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-100`} onClick={() => run(onRename)}>
                        <PencilSimple size={16} /> Gi nytt navn
                    </button>
                    {canDelete && (
                        <button type="button" role="menuitem" className={`${MENU_ITEM} text-error [@media(hover:hover)_and_(pointer:fine)]:hover:bg-error/10`} onClick={() => run(onDelete)}>
                            <Trash size={16} /> Slett
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const NamedPlansSection = ({ type, content, onSave, isReadOnly, isArchived = false }) => {
    const isDiet = type === 'diet';
    const confirmDialog = useConfirm();
    const plans = useMemo(() => parseNamedPlans(content, type), [content, type]);
    const [selectedId, setSelectedId] = useState(plans[0].id);
    const [nameMode, setNameMode] = useState(null);
    const [name, setName] = useState('');
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const selectedPlan = plans.find(plan => plan.id === selectedId) || plans[0];
    const showPlanPicker = plans.length > 1;
    const duplicateName = plans.some(plan =>
        plan.id !== (nameMode === 'rename' ? selectedPlan.id : null)
        && plan.name.toLocaleLowerCase('nb') === name.trim().toLocaleLowerCase('nb')
    );
    const canSaveName = Boolean(name.trim()) && !duplicateName && !isSaving;

    useEffect(() => {
        if (!plans.some(plan => plan.id === selectedId)) setSelectedId(plans[0].id);
    }, [plans, selectedId]);

    const savePlans = async (nextPlans) => {
        setSaveError('');
        setIsSaving(true);
        try {
            await onSave(serializeNamedPlans(nextPlans, type));
        } catch (error) {
            setSaveError(error?.message || 'Kunne ikke lagre. Prøv igjen.');
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const handleNameSubmit = async (event) => {
        event.preventDefault();
        if (!canSaveName) return;

        try {
            if (nameMode === 'rename') {
                await savePlans(plans.map(plan => plan.id === selectedPlan.id ? { ...plan, name: name.trim() } : plan));
            } else {
                const id = globalThis.crypto?.randomUUID?.() || `plan-${Date.now()}`;
                await savePlans([...plans, { id, name: name.trim(), content: '' }]);
                setSelectedId(id);
            }
            setNameMode(null);
            setName('');
        } catch {
            // La navnefeltet stå åpent, så coachen kan prøve igjen.
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirmDialog(`«${selectedPlan.name}» og hele ${isDiet ? 'matplanen' : 'treningsplanen'} i fanen blir slettet.`, {
            title: isDiet ? 'Slett diett?' : 'Slett treningsplan?',
            confirmText: 'Slett',
            destructive: true
        });
        if (!confirmed) return;
        try {
            await savePlans(plans.filter(plan => plan.id !== selectedPlan.id));
            setSelectedId(plans.find(plan => plan.id !== selectedPlan.id).id);
        } catch {
            // Den valgte planen beholdes dersom lagring feiler.
        }
    };

    const handleSavePlan = (value) => savePlans(plans.map(plan =>
        plan.id === selectedPlan.id ? { ...plan, content: value } : plan
    ));

    const planSelector = showPlanPicker ? (
        <div className="relative w-fit min-w-0 max-w-full">
            <select
                aria-label={isDiet ? 'Velg diett' : 'Velg treningsplan'}
                value={selectedPlan.id}
                disabled={isEditingPlan || isSaving}
                onChange={event => {
                    setSelectedId(event.target.value);
                    setNameMode(null);
                }}
                className="min-h-11 w-full max-w-full cursor-pointer appearance-none truncate rounded-lg border border-transparent bg-transparent py-1.5 pl-2 pr-8 text-[1.05rem] font-semibold text-ink outline-none hover:border-surface-200 focus:border-accent focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:coarse)]:border-surface-200"
            >
                {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <CaretDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        </div>
    ) : null;

    const planMenu = !isReadOnly ? (
        <PlanMenu
            label={isDiet ? 'Flere valg for diett' : 'Flere valg for treningsplan'}
            disabled={isEditingPlan || isSaving}
            canDelete={plans.length > 1}
            newLabel={isDiet ? 'Ny diett' : 'Ny plan'}
            onNew={() => {
                setName('');
                setNameMode('new');
            }}
            onRename={() => {
                setName(selectedPlan.name);
                setNameMode('rename');
            }}
            onDelete={handleDelete}
        />
    ) : null;

    const nameForm = !isReadOnly && (nameMode || saveError) ? (
        <div className="border-b border-surface-100 bg-white px-4 py-3 sm:px-5">
            {nameMode && (
                <form onSubmit={handleNameSubmit} className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`${type}-plan-name`}>Navn på {isDiet ? 'diett' : 'treningsplan'}</label>
                    <input
                        id={`${type}-plan-name`}
                        autoFocus
                        maxLength={60}
                        value={name}
                        onChange={event => setName(event.target.value)}
                        placeholder={isDiet ? 'For eksempel: Treningsdager' : 'For eksempel: Deload'}
                        className="h-11 min-w-0 w-full flex-none sm:w-auto sm:flex-1 rounded-xl border border-surface-200 bg-surface-50 px-4 text-base font-medium placeholder-ink-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                    />
                    <Button type="submit" size="sm" disabled={!canSaveName}>
                        <Check size={16} /> {nameMode === 'new' ? 'Opprett' : 'Lagre navn'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={() => setNameMode(null)} aria-label="Avbryt navnendring">
                        <X size={16} />
                    </Button>
                    {duplicateName && <p role="alert" className="w-full text-xs text-error">Dette navnet er allerede i bruk.</p>}
                </form>
            )}
            {saveError && <p role="alert" className={`text-xs text-error ${nameMode ? 'mt-2' : ''}`}>{saveError}</p>}
        </div>
    ) : null;

    return (
        <div className="space-y-5">
            {isArchived && (
                <p role="status" className="rounded-xl border border-surface-200 bg-surface-100 px-4 py-3 text-sm text-ink-muted">
                    Utøveren er arkivert. Gjenopprett utøveren fra utøverlisten før du endrer {isDiet ? 'diettene' : 'treningsplanene'}.
                </p>
            )}

            <PlanSection
                key={selectedPlan.id}
                type={type}
                planTitle={selectedPlan.name}
                content={selectedPlan.content}
                onSave={handleSavePlan}
                isReadOnly={isReadOnly}
                onEditingChange={setIsEditingPlan}
                titleControl={planSelector}
                headerActions={planMenu}
                headerExtra={nameForm}
            />
        </div>
    );
};

export default NamedPlansSection;
