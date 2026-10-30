/**
 * Known `utsname.machine` / `hw.machine` identifiers for iPhone Duo.
 *
 * Hardware model numbers (A3447, A3719, A3720, A3721) all share one machine id.
 * Keep this list easy to extend when Apple ships additional Duo SKUs.
 *
 * Sources: AppleDB / EveryiPhone / IPSW (iPhone19,4).
 * If a new Duo variant uses a different machine id, add it here AND in
 * `ios/App/App/DuoDevice.swift`.
 */
export const DUO_MACHINE_IDS = Object.freeze([
    'iPhone19,4',
]);

export const isDuoMachineId = (machineId) => (
    typeof machineId === 'string' && DUO_MACHINE_IDS.includes(machineId)
);
