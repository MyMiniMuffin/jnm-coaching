import test from 'node:test';
import assert from 'node:assert/strict';

import { extractPushHint, applyPushHintsToUsers } from '../src/lib/pushHints.js';

test('extractPushHint leser clientId og clientName', () => {
    assert.deepEqual(
        extractPushHint({ data: { clientId: 42, clientName: ' Ada ' } }),
        { clientId: 42, clientName: 'Ada' }
    );
});

test('extractPushHint tåler strenger, tall og manglende felt', () => {
    assert.deepEqual(extractPushHint({ data: { clientId: '7' } }), { clientId: 7, clientName: '' });
    assert.deepEqual(extractPushHint({ data: { clientId: '7', clientName: 5 } }), { clientId: 7, clientName: '' });
    for (const bad of ['abc-1', '007x', '1e5', '0x10', '-3', '1.5', ' ', 1.5, -1, Infinity, {}, [], true]) {
        assert.equal(extractPushHint({ data: { clientId: bad } }), null, `skal avvise ${JSON.stringify(bad)}`);
    }
    assert.equal(extractPushHint({ data: {} }), null);
    assert.equal(extractPushHint({ data: { clientId: '' } }), null);
    assert.equal(extractPushHint({ data: { clientId: NaN } }), null);
    assert.equal(extractPushHint({ data: 'x' }), null);
    assert.equal(extractPushHint(null), null);
    assert.equal(extractPushHint(undefined), null);
});

test('applyPushHintsToUsers markerer hintet utøver med minst 1 ulest', () => {
    const users = [
        { id: 1, name: 'A', unreadCheckins: 0 },
        { id: 2, name: 'B' },
        { id: 3, name: 'C', unreadCheckins: 4 }
    ];
    const next = applyPushHintsToUsers(users, [{ clientId: '1' }, { clientId: 3 }, { clientId: 2 }]);
    assert.equal(next[0].unreadCheckins, 1);
    assert.equal(next[1].unreadCheckins, 1);
    assert.equal(next[2].unreadCheckins, 4);
    assert.equal(users[0].unreadCheckins, 0, 'muterer ikke input');
    assert.equal(next.length, 3);
});

test('applyPushHintsToUsers ignorerer ukjente id-er og rører ikke andre', () => {
    const users = [{ id: 1, unreadCheckins: 0 }, { id: 2, unreadCheckins: 0 }];
    const next = applyPushHintsToUsers(users, [{ clientId: 99 }, { clientId: 1 }, { clientId: 1 }]);
    assert.equal(next.length, 2);
    assert.equal(next[0].unreadCheckins, 1);
    assert.equal(next[1], users[1]);
});

test('applyPushHintsToUsers returnerer samme liste når ingenting endres', () => {
    const users = [{ id: 1, unreadCheckins: 2 }];
    assert.equal(applyPushHintsToUsers(users, [{ clientId: 1 }]), users);
    assert.equal(applyPushHintsToUsers(users, []), users);
    assert.equal(applyPushHintsToUsers(users, [{ clientId: 5 }]), users);
    assert.equal(applyPushHintsToUsers(undefined, [{ clientId: 1 }]), undefined);
});
