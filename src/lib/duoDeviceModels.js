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
 * DEBUG iOS builds log the machine string — compare on device before treating
 * the list as authoritative for shipping. Xcode Debug can force Duo via
 * `-ForceDuoDevice` / `JNM_FORCE_DUO=1` (see `DuoDevice.swift`); Simulator
 * never matches a real machine id.
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
