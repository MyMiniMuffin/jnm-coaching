import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import { parseWorkoutPlans, serializeWorkoutPlans } from '../lib/workoutPlans';
import PlanSection from './PlanSection';

const WorkoutPlansSection = ({ content, onSave, isReadOnly }) => {
    const confirmDialog = useConfirm();
    const plans = useMemo(() => parseWorkoutPlans(content), [content]);
    const [selectedId, setSelectedId] = useState(plans[0].id);
    const [nameMode, setNameMode] = useState(null);
    const [name, setName] = useState('');
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const selectedPlan = plans.find(plan => plan.id === selectedId) || plans[0];
    const duplicateName = plans.some(plan =>
        plan.id !== (nameMode === 'rename' ? selectedPlan.id : null)
        && plan.name.toLocaleLowerCase('nb') === name.trim().toLocaleLowerCase('nb')
    );
    const canSaveName = Boolean(name.trim()) && !duplicateName && !isSaving;

    useEffect(() => {
        if (!plans.some(plan => plan.id === selectedId)) setSelectedId(plans[0].id);
    }, [plans, selectedId]);

    const savePlans = async (nextPlans) => {
        setSaveError(false);
        setIsSaving(true);
        try {
            await onSave(serializeWorkoutPlans(nextPlans));
        } catch (error) {
            setSaveError(true);
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
        const confirmed = await confirmDialog(`«${selectedPlan.name}» og hele treningsplanen i fanen blir slettet.`, {
            title: 'Slett treningsplan?',
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
            <Card className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-ink">Treningsplaner</h2>
                        <p className="mt-0.5 text-xs text-ink-muted">Velg planen du vil se.</p>
                    </div>
                    {!isReadOnly && (
                        <Button variant="secondary" size="sm" disabled={isEditingPlan || isSaving} onClick={() => {
                            setName('');
                            setNameMode('new');
                        }}>
                            <Plus size={16} /> Ny plan
                        </Button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Treningsplaner">
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
                            className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${selectedPlan.id === plan.id ? 'bg-ink text-white' : 'bg-surface-100 text-ink-muted hover:text-ink'}`}
                        >
                            {plan.name}
                        </button>
                    ))}
                </div>
                {saveError && <p role="alert" className="mt-3 text-xs text-error">Kunne ikke lagre. Prøv igjen.</p>}

                {!isReadOnly && !isEditingPlan && !nameMode && (
                    <div className="mt-3 flex items-center gap-2">
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
                        <label className="sr-only" htmlFor="workout-plan-name">Navn på treningsplan</label>
                        <input
                            id="workout-plan-name"
                            autoFocus
                            maxLength={60}
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder="For eksempel: Deload"
                            className="h-11 min-w-0 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent"
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
            </Card>

            <PlanSection
                key={selectedPlan.id}
                type="workout"
                content={selectedPlan.content}
                onSave={handleSavePlan}
                isReadOnly={isReadOnly}
                onEditingChange={setIsEditingPlan}
            />
        </div>
    );
};

export default WorkoutPlansSection;
