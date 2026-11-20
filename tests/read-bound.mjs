import test from 'node:test';
import assert from 'node:assert/strict';

import { getReadBound } from '../src/lib/readBound.js';

const fresh = (checkins) => ({ authError: false, data: { checkins } });

test('getReadBound returnerer høyeste rapport-id fra ferske data', () => {
    assert.deepEqual(getReadBound(fresh([{ id: 5 }, { id: 12 }, { id: 9 }])), { upToId: 12 });
    assert.deepEqual(getReadBound(fresh([{ id: '41' }])), { upToId: 41 });
});

test('getReadBound avviser data som ikke er ferske', () => {
    assert.equal(getReadBound({ authError: false, networkError: true }), null);
    assert.equal(getReadBound({ authError: false, data: { checkins: [{ id: 3 }] }, fromCache: true, networkError: true }), null);
    assert.equal(getReadBound({ authError: false, data: { checkins: [{ id: 3 }] }, fromCache: true }), null);
    assert.equal(getReadBound({ authError: true }), null);
    assert.equal(getReadBound(undefined), null);
});

test('getReadBound gir ingen grense når coach ikke har sett noen rapporter', () => {
    assert.equal(getReadBound(fresh([])), null);
    assert.equal(getReadBound({ data: {} }), null);
    assert.equal(getReadBound(fresh([{ id: 'abc' }, {}])), null);
});
