const collectionFormat = (type) => type === 'diet' ? 'jnm-diet-plans' : 'jnm-workout-plans';

export const parseNamedPlans = (content, type = 'workout') => {
    if (content) {
        try {
            const parsed = JSON.parse(content);
            if (parsed?.format === collectionFormat(type) && Array.isArray(parsed.plans) && parsed.plans.length) {
                const plans = parsed.plans.filter(plan =>
                    typeof plan?.id === 'string' && plan.id
                    && typeof plan?.name === 'string' && plan.name.trim()
                    && typeof plan?.content === 'string'
                );
                if (plans.length) return plans;
            }
        } catch {
            // Eldre planer er lagret direkte som tekst eller én strukturert plan.
        }
    }

    return [{ id: 'original', name: type === 'diet' ? 'Matplan' : 'Treningsplan', content: content || '' }];
};

export const serializeNamedPlans = (plans, type = 'workout') => JSON.stringify({
    format: collectionFormat(type),
    version: 1,
    plans: plans.map(({ id, name, content }) => ({ id, name: name.trim(), content }))
});
