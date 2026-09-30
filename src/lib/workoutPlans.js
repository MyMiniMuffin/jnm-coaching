const COLLECTION_FORMAT = 'jnm-workout-plans';

export const parseWorkoutPlans = (content) => {
    if (content) {
        try {
            const parsed = JSON.parse(content);
            if (parsed?.format === COLLECTION_FORMAT && Array.isArray(parsed.plans) && parsed.plans.length) {
                const plans = parsed.plans.filter(plan =>
                    typeof plan?.id === 'string' && plan.id
                    && typeof plan?.name === 'string' && plan.name.trim()
                    && typeof plan?.content === 'string'
                );
                if (plans.length) return plans;
            }
        } catch {
            // Eldre treningsplaner er lagret direkte som tekst eller én plan.
        }
    }

    return [{ id: 'original', name: 'Treningsplan', content: content || '' }];
};

export const serializeWorkoutPlans = (plans) => JSON.stringify({
    format: COLLECTION_FORMAT,
    version: 1,
    plans: plans.map(({ id, name, content }) => ({ id, name: name.trim(), content }))
});
