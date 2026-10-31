/**
 * Known `utsname.machine` / `hw.machine` identifiers for iPhone Duo.
 *
 * Hardware model numbers (A3447, A3719, A3720, A3721) all share one machine id
 * in community databases. Keep this list easy to extend when Apple ships
 * additional Duo SKUs.
 *
 * ## Exact-match only — never prefix / range match `iPhone19`
 * The 2026 iPhone 18 Pro family is also in the `iPhone19,*` generation:
 * - iPhone 18 Pro: `iPhone19,2` (AppleDB)
 * - iPhone 18 Pro Max / variants: `iPhone19,3`, `iPhone19,7`
 * - iPhone Duo (community): `iPhone19,4`
 *
 * A `hasPrefix("iPhone19")` (or any range) match would false-positive on
 * regular Pros — that is the class of bug this allowlist exists to prevent.
 *
 * ## Verification
 * `iPhone19,4` is listed by AppleDB / IPSW.dev / Signet as iPhone Duo
 * (board V68AP), but has **not** been confirmed via `utsname.machine` on a
 * physical Duo in this repo. Simulator never matches (`arm64` / `x86_64`).
 * Physical Duo: `utsname.machine`. Duo Simulator: `SIMULATOR_MODEL_IDENTIFIER`
 * (uname is host arch). See `DuoDevice.swift`. DEBUG logs the resolved id —
 * confirm on a real Duo **and** on an iPhone 18 Pro before trusting the list.
 *
 * Sources (community, cross-check; not an Apple public API):
 * - https://appledb.dev/device/identifier/iPhone19,4
 * - https://ipsw.dev/iPhone19,4
 * - https://appledb.dev/device/identifier/iPhone19,2 (iPhone 18 Pro — NOT Duo)
 *
 * If a new Duo variant uses a different machine id, add it here AND in
 * `ios/App/App/DuoDevice.swift`. Do not broaden to a generation prefix.
 *
 * ## Decision function
 * `decideIsDuo` is the pure source of truth mirrored by `DuoDevice.decideIsDuo`
 * in Swift (no iOS test target). Default is NOT Duo when unknown.
 */
export const DUO_MACHINE_IDS = Object.freeze([
    'iPhone19,4',
]);

/** Known non-Duo ids in the same generation / nearby — regression guards only. */
export const NON_DUO_MACHINE_IDS = Object.freeze([
    // iPhone 8 / 8 Plus / X
    'iPhone10,1',
    'iPhone10,2',
    'iPhone10,3',
    'iPhone10,4',
    'iPhone10,5',
    'iPhone10,6',
    // iPhone 17 Pro / Pro Max
    'iPhone18,1',
    'iPhone18,2',
    // iPhone 18 Pro family (same iPhone19,* generation as presumed Duo)
    'iPhone19,1',
    'iPhone19,2',
    'iPhone19,3',
    'iPhone19,5',
    'iPhone19,6',
    'iPhone19,7',
    // Simulator host arch (never a Duo id)
    'arm64',
    'x86_64',
]);

export const isDuoMachineId = (machineId) => (
    typeof machineId === 'string' && DUO_MACHINE_IDS.includes(machineId)
);

/**
 * Pure Duo decision — positive identification only; unknown → false.
 *
 * @param {object} opts
 * @param {string|null|undefined} opts.machineId utsname / simulator model id
 * @param {boolean} [opts.forceDuo=false] Debug opt-in only (`-ForceDuoDevice`)
 * @param {string|null|undefined} [opts.simulatorDeviceName] SIMULATOR_DEVICE_NAME
 * @param {boolean} [opts.hasFoldableDivision=false] UIKit division reserved region
 *   (includeInactive) — definitive foldable hardware signal when available
 */
export const decideIsDuo = ({
    machineId,
    forceDuo = false,
    simulatorDeviceName = null,
    hasFoldableDivision = false,
} = {}) => {
    if (forceDuo === true) return true;
    if (isDuoMachineId(machineId)) return true;
    if (
        typeof simulatorDeviceName === 'string'
        && simulatorDeviceName.toLowerCase().includes('duo')
    ) {
        return true;
    }
    if (hasFoldableDivision === true) return true;
    return false;
};
