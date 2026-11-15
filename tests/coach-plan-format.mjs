// The coach API writes plans for the app: the app's own parsers must read them back unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseNamedPlans, serializeNamedPlans } from '../src/lib/namedPlans.js';
import { parsePlan, serializePlan } from '../src/lib/planFormat.js';

const require = createRequire(import.meta.url);
const { parseStoredPlans, serializeStoredPlans, serializePlanSections } = require('../coach-api/plans.js');

const sections = [
  { title: ' Dag 1 ', items: [{ text: 'Knebøy', sets: '4', reps: '6' }, 'Utfall', { text: '', sets: '', reps: '' }] },
  { title: 'Frokost', items: [{ text: 'Egg', subItems: ['2 stk', ' '] }] },
  { title: '', items: [] }
];

test('structured plan content matches serializePlan() from the app', () => {
  assert.equal(serializePlanSections(sections), serializePlan({ sections }));
  assert.equal(serializePlanSections([]), serializePlan({ sections: [] }));
});

test('the app reads plans written by the API', () => {
  for (const type of ['diet', 'workout']) {
    const raw = serializeStoredPlans([
      { id: 'a', name: 'Plan A ', sections },
      { id: 'b', name: 'Plan B', text: 'Fritekst' }
    ], type);
    const appPlans = parseNamedPlans(raw, type);
    assert.deepEqual(appPlans.map((plan) => [plan.id, plan.name]), [['a', 'Plan A'], ['b', 'Plan B']]);
    const appSections = parsePlan(appPlans[0].content, type).sections;
    assert.deepEqual(appSections.map((section) => section.title), ['Dag 1', 'Frokost']);
    assert.deepEqual(appSections[0].items.map((item) => [item.text, item.sets, item.reps]), [['Knebøy', '4', '6'], ['Utfall', '', '']]);
    assert.equal(appPlans[1].content, 'Fritekst');
  }
});

test('the API reads plans written by the app', () => {
  const raw = serializeNamedPlans([
    { id: 'x', name: 'Hviledag', content: serializePlan({ sections }) },
    { id: 'y', name: 'Gammel', content: '# Markdown\n- linje' }
  ], 'diet');
  const { storageFormat, plans } = parseStoredPlans(raw, 'diet');
  assert.equal(storageFormat, 'named-plans');
  assert.equal(plans[0].sections[1].items[0].subItems[0], '2 stk');
  assert.equal(plans[1].text, '# Markdown\n- linje');
  // Wrong collection type falls back to one plan with the raw text, like parseNamedPlans().
  assert.deepEqual(parseStoredPlans(raw, 'workout').plans.map((plan) => plan.id), parseNamedPlans(raw, 'workout').map((plan) => plan.id));
});
