/**
 * Meal plans (users.diet_plan) and training programs (users.workout_plan),
 * read and written in the same format as the coach UI:
 *
 * - The column holds a named-plan collection
 *   `{"format":"jnm-diet-plans"|"jnm-workout-plans","version":1,"plans":[{id,name,content}]}`
 *   (src/lib/namedPlans.js), or older plain text/Markdown (shown as one plan).
 * - Each plan's `content` is a structured plan
 *   `{"format":"jnm-plan","version":3,"sections":[{title,items:[{text,sets,reps,subItems}]}]}`
 *   (src/lib/planFormat.js serializePlan), or plain text.
 *
 * The API exposes plans as `{ id, name, sections }` or `{ id, name, text }`.
 */
const crypto = require('node:crypto');
const { z } = require('zod');

const PLAN_TYPES = {
  diet: { column: 'diet_plan', collectionFormat: 'jnm-diet-plans', defaultName: 'Matplan' },
  workout: { column: 'workout_plan', collectionFormat: 'jnm-workout-plans', defaultName: 'Treningsplan' }
};
const PLAN_FORMAT = 'jnm-plan';
const PLAN_VERSION = 3;
// Same limit as data.js plan_update.
const MAX_PLANS_LENGTH = 200000;

const asText = (value) => String(value ?? '').trim();

// --- Storage format (mirrors src/lib/namedPlans.js and src/lib/planFormat.js) ---

const parsePlanContent = (content) => {
  if (content && String(content).trim()) {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.format === PLAN_FORMAT && Array.isArray(parsed.sections)) {
        return {
          sections: parsed.sections.map((section) => ({
            title: typeof section?.title === 'string' ? section.title : '',
            items: (Array.isArray(section?.items) ? section.items : []).map((item) => {
              const source = typeof item === 'string' ? { text: item } : item || {};
              return {
                text: String(source.text || ''),
                sets: String(source.sets || ''),
                reps: String(source.reps || ''),
                subItems: (Array.isArray(source.subItems) ? source.subItems : [])
                  .map((sub) => String(typeof sub === 'string' ? sub : sub?.text || ''))
              };
            })
          }))
        };
      }
    } catch {
      // Plain text or Markdown.
    }
  }
  return { text: content ? String(content) : '' };
};

/** Same output as serializePlan() in src/lib/planFormat.js. */
const serializePlanSections = (sections) => {
  const cleaned = (sections || [])
    .map((section) => ({
      title: asText(section.title),
      items: (section.items || [])
        .map((item) => {
          const source = typeof item === 'string' ? { text: item } : item || {};
          return {
            text: asText(source.text),
            sets: asText(source.sets),
            reps: asText(source.reps),
            subItems: (source.subItems || []).map(asText).filter(Boolean)
          };
        })
        .filter((item) => item.text || item.sets || item.reps || item.subItems.length)
    }))
    .filter((section) => section.title || section.items.length);

  if (!cleaned.length) return '';
  return JSON.stringify({ format: PLAN_FORMAT, version: PLAN_VERSION, sections: cleaned });
};

/** Same rules as parseNamedPlans() in src/lib/namedPlans.js. Returns API-shaped plans. */
const parseStoredPlans = (raw, type) => {
  const config = PLAN_TYPES[type];
  let storedPlans = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.format === config.collectionFormat && Array.isArray(parsed.plans)) {
        const plans = parsed.plans.filter((plan) =>
          typeof plan?.id === 'string' && plan.id
          && typeof plan?.name === 'string' && plan.name.trim()
          && typeof plan?.content === 'string'
        );
        if (plans.length) storedPlans = plans;
      }
    } catch {
      // Older plans are stored as plain text or a single structured plan.
    }
  }
  const storageFormat = storedPlans ? 'named-plans' : (raw ? 'legacy' : 'empty');
  const plans = (storedPlans || [{ id: 'original', name: config.defaultName, content: raw || '' }])
    .map((plan) => ({ id: plan.id, name: plan.name, ...parsePlanContent(plan.content) }));
  return { storageFormat, plans };
};

const planContent = (plan) => (plan.sections ? serializePlanSections(plan.sections) : String(plan.text || ''));

/** Same output as serializeNamedPlans() in src/lib/namedPlans.js. */
const serializeStoredPlans = (plans, type) => JSON.stringify({
  format: PLAN_TYPES[type].collectionFormat,
  version: 1,
  plans: plans.map((plan) => ({ id: plan.id, name: plan.name.trim(), content: planContent(plan) }))
});

/** Plain-text view used for diffs (same layout as serializePlanAsPlainText()). */
const planAsPlainText = (plan) => {
  if (!plan.sections) return String(plan.text || '');
  return plan.sections
    .map((section) => {
      const lines = (section.items || []).flatMap((item) => {
        const text = asText(item.text);
        const sets = asText(item.sets);
        const reps = asText(item.reps);
        const line = text && (sets || reps) ? `${text}: ${sets || '–'} × ${reps || '–'}` : text;
        return [line, ...(item.subItems || []).map(asText).filter(Boolean).map((sub) => `  - ${sub}`)].filter(Boolean);
      });
      return [asText(section.title) ? `[${asText(section.title)}]` : '', ...lines].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
};

/** Normalizes a plan the way it will be read back after saving (trims, drops empty rows). */
const normalizePlan = (plan) => {
  if (!plan.sections) return { id: plan.id, name: plan.name.trim(), text: String(plan.text || '') };
  const content = serializePlanSections(plan.sections);
  // An empty structured plan is stored as '' and reads back as empty text, like in the app.
  return { id: plan.id, name: plan.name.trim(), ...parsePlanContent(content) };
};

// --- Input validation ---

const shortText = (max) => z.string().max(max, `Maks ${max} tegn`);
const setsOrReps = z.union([shortText(50), z.number().finite()]).transform(String);

const itemSchema = z.union([
  shortText(2000),
  z.object({
    text: shortText(2000).default(''),
    sets: setsOrReps.optional(),
    reps: setsOrReps.optional(),
    subItems: z.array(shortText(2000)).max(50).optional()
  }).strict()
]);

const sectionSchema = z.object({
  title: shortText(200).default(''),
  items: z.array(itemSchema).max(200).default([])
}).strict();

const planIdSchema = z.string().trim().min(1).max(100);
const planNameSchema = z.string().trim().min(1, 'Navn kan ikke være tomt').max(120, 'Maks 120 tegn');
const sectionsSchema = z.array(sectionSchema).max(50);
const textSchema = z.string().max(MAX_PLANS_LENGTH);

const onlyOneBody = (plan) => !(plan.sections !== undefined && plan.text !== undefined);
const ONE_BODY_MESSAGE = 'Bruk enten "sections" (strukturert plan) eller "text" (fritekst), ikke begge';

const fullPlanSchema = z.object({
  id: planIdSchema.optional(),
  name: planNameSchema,
  sections: sectionsSchema.optional(),
  text: textSchema.optional()
}).strict()
  .refine(onlyOneBody, ONE_BODY_MESSAGE)
  .refine((plan) => plan.sections !== undefined || plan.text !== undefined, 'Planen må ha "sections" eller "text"');

const patchPlanSchema = z.object({
  id: planIdSchema.optional(),
  name: planNameSchema.optional(),
  sections: sectionsSchema.optional(),
  text: textSchema.optional()
}).strict()
  .refine(onlyOneBody, ONE_BODY_MESSAGE)
  .refine((plan) => plan.id !== undefined || plan.name !== undefined, 'Planen må ha "id" eller "name"');

const replacePlansSchema = z.object({
  plans: z.array(fullPlanSchema).min(1, 'Minst én plan').max(20),
  dryRun: z.boolean().optional()
}).strict();

const patchPlansSchema = z.object({
  plans: z.array(patchPlanSchema).max(20).default([]),
  removePlanIds: z.array(planIdSchema).max(20).default([]),
  dryRun: z.boolean().optional()
}).strict()
  .refine((body) => body.plans.length || body.removePlanIds.length, 'Ingen endringer: send "plans" og/eller "removePlanIds"');

// --- Applying changes ---

class PlanInputError extends Error {}

const sameName = (a, b) => a.trim().toLocaleLowerCase('nb') === b.trim().toLocaleLowerCase('nb');

const assertUniquePlans = (plans) => {
  plans.forEach((plan, index) => {
    if (plans.findIndex((other) => other.id === plan.id) !== index) {
      throw new PlanInputError(`Plan-ID "${plan.id}" er brukt flere ganger`);
    }
    if (plans.findIndex((other) => sameName(other.name, plan.name)) !== index) {
      throw new PlanInputError(`Navnet "${plan.name}" er brukt flere ganger (som i appen må navnene være unike)`);
    }
  });
};

const bodyOf = (plan) => (plan.sections !== undefined ? { sections: plan.sections } : { text: plan.text });

/** PUT: the given plans replace all existing ones. Plans without id keep the id of a plan with the same name. */
const replacePlans = (beforePlans, input) => {
  const plans = input.plans.map((plan) => {
    const existing = plan.id ? null : beforePlans.find((before) => sameName(before.name, plan.name));
    return normalizePlan({ id: plan.id || existing?.id || crypto.randomUUID(), name: plan.name, ...bodyOf(plan) });
  });
  assertUniquePlans(plans);
  return plans;
};

/** PATCH: update plans matched by id (or name), add new ones, remove listed ids. Others are kept as they are. */
const patchPlans = (beforePlans, input) => {
  const touched = new Set();
  let plans = beforePlans.map((plan) => ({ ...plan }));
  for (const id of input.removePlanIds) {
    if (!plans.some((plan) => plan.id === id)) throw new PlanInputError(`Fant ingen plan med ID "${id}"`);
    plans = plans.filter((plan) => plan.id !== id);
  }
  for (const change of input.plans) {
    const index = change.id !== undefined
      ? plans.findIndex((plan) => plan.id === change.id)
      : plans.findIndex((plan) => sameName(plan.name, change.name));
    if (index >= 0) {
      const current = plans[index];
      const hasBody = change.sections !== undefined || change.text !== undefined;
      touched.add(current.id);
      plans[index] = normalizePlan({
        id: current.id,
        name: change.name ?? current.name,
        ...(hasBody ? bodyOf(change) : bodyOf(current))
      });
    } else {
      if (change.name === undefined) throw new PlanInputError(`Fant ingen plan med ID "${change.id}"`);
      if (change.sections === undefined && change.text === undefined) {
        throw new PlanInputError(`Ny plan "${change.name}" må ha "sections" eller "text"`);
      }
      plans.push(normalizePlan({ id: change.id || crypto.randomUUID(), name: change.name, ...bodyOf(change) }));
    }
  }
  // With no saved plan the app shows an empty placeholder ("original"). Adding a
  // plan should replace it, not leave an empty extra tab next to the new one.
  const isEmptyPlaceholder = (plan) => plan.id === 'original' && !plan.sections && !plan.text && !touched.has(plan.id);
  if (beforePlans.length === 1 && isEmptyPlaceholder(beforePlans[0]) && plans.length > 1) {
    plans = plans.filter((plan) => !isEmptyPlaceholder(plan));
  }
  if (!plans.length) throw new PlanInputError('Kan ikke fjerne alle planene; minst én må være igjen');
  assertUniquePlans(plans);
  return plans;
};

// --- Diff ---

const MAX_DIFF_CELLS = 4_000_000;

/** Line diff (LCS). Returns only changed lines, prefixed with "- " or "+ ". */
const diffLines = (beforeText, afterText) => {
  const a = beforeText ? beforeText.split('\n') : [];
  const b = afterText ? afterText.split('\n') : [];
  if (a.length * b.length > MAX_DIFF_CELLS) {
    return [...a.map((line) => `- ${line}`), ...b.map((line) => `+ ${line}`)];
  }
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) out.push(`- ${a[i++]}`);
    else out.push(`+ ${b[j++]}`);
  }
  while (i < a.length) out.push(`- ${a[i++]}`);
  while (j < b.length) out.push(`+ ${b[j++]}`);
  return out;
};

const diffPlans = (beforePlans, afterPlans) => {
  const added = [];
  const removed = [];
  const renamed = [];
  const modified = [];
  for (const before of beforePlans) {
    if (!afterPlans.some((after) => after.id === before.id)) removed.push({ id: before.id, name: before.name });
  }
  for (const after of afterPlans) {
    const before = beforePlans.find((plan) => plan.id === after.id);
    if (!before) {
      added.push({ id: after.id, name: after.name, lines: diffLines('', planAsPlainText(after)) });
      continue;
    }
    if (before.name !== after.name) renamed.push({ id: after.id, from: before.name, to: after.name });
    const lines = diffLines(planAsPlainText(before), planAsPlainText(after));
    const formatChanged = Boolean(before.sections) !== Boolean(after.sections);
    if (lines.length || formatChanged) {
      modified.push({ id: after.id, name: after.name, ...(formatChanged ? { format: after.sections ? 'sections' : 'text' } : {}), lines });
    }
  }
  return { added, removed, renamed, modified };
};

module.exports = {
  MAX_PLANS_LENGTH,
  PLAN_TYPES,
  PlanInputError,
  diffLines,
  diffPlans,
  fullPlanSchema,
  parseStoredPlans,
  patchPlanSchema,
  patchPlans,
  patchPlansSchema,
  planAsPlainText,
  replacePlans,
  replacePlansSchema,
  sectionSchema,
  serializePlanSections,
  serializeStoredPlans
};
