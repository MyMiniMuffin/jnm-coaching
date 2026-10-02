import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import { parseNamedPlans, serializeNamedPlans } from '../lib/namedPlans';
import PlanSection from './PlanSection';

const NamedPlansSection = ({ type, content, onSave, isReadOnly, isArchived = false }) => {
    const isDiet = type === 'diet';
    const collectionTitle = isDiet ? 'Dietter' : 'Treningsplaner';
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

    return (
        <div className="space-y-5">
            {isArchived && (
                <p role="status" className="rounded-xl border border-surface-200 bg-surface-100 px-4 py-3 text-sm text-ink-muted">
                    Klienten er arkivert. Gjenopprett klienten under «Klienter» før du endrer {isDiet ? 'diettene' : 'treningsplanene'}.
                </p>
            )}
            {(showPlanPicker || !isReadOnly) && <Card className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-ink">{collectionTitle}</h2>
                        {showPlanPicker && <p className="mt-0.5 text-xs text-ink-muted">Velg {isDiet ? 'dietten' : 'planen'} du vil se.</p>}
                    </div>
                    {!isReadOnly && (
                        <Button variant="secondary" size="sm" disabled={isEditingPlan || isSaving} onClick={() => {
                            setName('');
                            setNameMode('new');
                        }}>
                            <Plus size={16} /> {isDiet ? 'Ny diett' : 'Ny plan'}
                        </Button>
                    )}
                </div>

                {showPlanPicker && <div className="flex gap-2 overflow-x-auto pb-1" aria-label={collectionTitle}>
                    {plans.map(plan => (
                        <button
                            key={plan.id}
                            type="button"
                            aria-current={selectedPlan.id === plan.id ? 'page' : undefined}
                            disabled={isEditingPlan || isSaving}
                            onClick={() => {
                                setSelectedId(plan.id);
                                setNameMode(null);
                            }}
                            className={`min-h-11 max-w-full shrink-0 break-words rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${selectedPlan.id === plan.id ? 'bg-ink text-white' : 'bg-surface-100 text-ink-muted hover:text-ink'}`}
                        >
                            {plan.name}
                        </button>
                    ))}
                </div>}
                {saveError && <p role="alert" className="mt-3 text-xs text-error">{saveError}</p>}

                {!isReadOnly && !isEditingPlan && !nameMode && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" disabled={isSaving} onClick={() => {
                            setName(selectedPlan.name);
                            setNameMode('rename');
                        }}>
                            <Pencil size={15} /> Gi nytt navn
                        </Button>
                        {plans.length > 1 && (
                            <Button variant="ghost" size="sm" disabled={isSaving} onClick={handleDelete} className="text-error hover:bg-error/10">
                                <Trash2 size={15} /> Slett
                            </Button>
                        )}
                    </div>
                )}

                {!isReadOnly && nameMode && (
                    <form onSubmit={handleNameSubmit} className="mt-4 flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`${type}-plan-name`}>Navn på {isDiet ? 'diett' : 'treningsplan'}</label>
                        <input
                            id={`${type}-plan-name`}
                            autoFocus
                            maxLength={60}
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder={isDiet ? 'For eksempel: Treningsdager' : 'For eksempel: Deload'}
                            className="h-11 min-w-0 w-full flex-none sm:w-auto sm:flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                        />
                        <Button type="submit" size="sm" disabled={!canSaveName}>
                            <Check size={16} /> {nameMode === 'new' ? 'Opprett' : 'Lagre navn'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={() => setNameMode(null)} aria-label="Avbryt navnendring">
                            <X size={16} />
                        </Button>
                        {duplicateName && <p className="w-full text-xs text-error">Dette navnet er allerede i bruk.</p>}
                    </form>
                )}
            </Card>}

            <PlanSection
                key={selectedPlan.id}
                type={type}
                planTitle={selectedPlan.name}
                content={selectedPlan.content}
                onSave={handleSavePlan}
                isReadOnly={isReadOnly}
                onEditingChange={setIsEditingPlan}
            />
        </div>
    );
};

export default NamedPlansSection;
