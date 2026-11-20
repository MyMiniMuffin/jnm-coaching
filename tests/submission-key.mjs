import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { getSubmissionKey, clearSubmissionKey } from '../src/lib/submissionKey.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
    };
});

test('samme utkast gir samme nøkkel ved gjentatte forsøk', () => {
    const first = getSubmissionKey('draft-7');
    assert.match(first, KEY_PATTERN);
    assert.equal(getSubmissionKey('draft-7'), first);
});

test('nøkkelen overlever en ny sideinnlasting, men ikke et lagret utkast', () => {
    const first = getSubmissionKey('draft-7');
    assert.equal(getSubmissionKey('draft-7'), first);
    clearSubmissionKey('draft-7');
    const second = getSubmissionKey('draft-7');
    assert.match(second, KEY_PATTERN);
    assert.notEqual(second, first);
});

test('ulike utkast får ulike nøkler', () => {
    assert.notEqual(getSubmissionKey('draft-1'), getSubmissionKey('draft-2'));
});

test('fungerer uten localStorage', () => {
    delete globalThis.localStorage;
    assert.match(getSubmissionKey('draft-7'), KEY_PATTERN);
});
