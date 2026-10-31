/**
 * Known `utsname.machine` / `hw.machine` identifiers for iPhone Duo.
 *
 * Hardware model numbers (A3447, A3719, A3720, A3721) all share one machine id
 * in community databases. Keep this list easy to extend when Apple ships
 * additional Duo SKUs.
 *
 * ## Verification
 * `iPhone19,4` is listed by AppleDB / IPSW.dev / Signet as iPhone Duo
 * (board V68AP), but has **not** been confirmed via `utsname.machine` on a
 * physical Duo in this repo. Simulator never matches (`arm64` / `x86_64`).
 * Physical Duo: `utsname.machine`. Duo Simulator: `SIMULATOR_MODEL_IDENTIFIER`
 * (uname is host arch). See `DuoDevice.swift`. DEBUG logs the resolved id.
 *
 * Sources (community, cross-check; not an Apple public API):
 * - https://appledb.dev/device/identifier/iPhone19,4
 * - https://ipsw.dev/iPhone19,4
 *
 * If a new Duo variant uses a different machine id, add it here AND in
 * `ios/App/App/DuoDevice.swift`.
 */
export const DUO_MACHINE_IDS = Object.freeze([
    'iPhone19,4',
]);

export const isDuoMachineId = (machineId) => (
    typeof machineId === 'string' && DUO_MACHINE_IDS.includes(machineId)
);
