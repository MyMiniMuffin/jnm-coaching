import Foundation
import UIKit
import os

/// Known `utsname.machine` identifiers for iPhone Duo.
/// Keep in sync with `src/lib/duoDeviceModels.js` (`decideIsDuo` / `DUO_MACHINE_IDS`).
///
/// ## Exact-match only — never prefix / range match `iPhone19`
/// The 2026 iPhone 18 Pro family shares the `iPhone19,*` generation:
/// - iPhone 18 Pro: `iPhone19,2` (AppleDB)
/// - iPhone 18 Pro Max / variants: `iPhone19,3`, `iPhone19,7`
/// - iPhone Duo (community): `iPhone19,4`
/// A generation prefix would false-positive on regular Pros (bug class we guard against).
///
/// ## Verification status for `iPhone19,4`
/// Community databases (AppleDB, IPSW.dev, Signet) list iPhone Duo as
/// `iPhone19,4` (board V68AP). On a **physical** Duo, `uname` should report
/// that string. The **iPhone Duo Simulator** reports `arm64`/`x86_64` from
/// `uname`, but sets `SIMULATOR_MODEL_IDENTIFIER` (typically `iPhone19,4`)
/// and `SIMULATOR_DEVICE_NAME` (`iPhone Duo`) — we read those too.
///
/// DEBUG builds log the resolved id so Jonas can confirm on device/sim.
/// Confirm on a real Duo **and** on an iPhone 18 Pro (`iPhone19,2`). If a
/// shipped Duo reports a different machine string, add it here and in
/// `duoDeviceModels.js` — do not broaden to a prefix.
///
/// ## Debug override (opt-in only)
/// Debug builds do **not** force Duo by default (that made every Debug iPhone
/// show the rail — PR #17 regression). Opt in with `-ForceDuoDevice` (Debug
/// scheme includes it) or `JNM_FORCE_DUO=1`. Release/TestFlight never force.
///
/// ## Foldable capability
/// When a UIView reports a `.division` reserved region (including inactive),
/// that is a definitive foldable signal and counts as Duo even if the machine
/// id is not yet on the allowlist. Outer-display / pre-view paths still rely
/// on the exact allowlist.
///
/// Authoritative cross-checks (community, not Apple public API):
/// - https://appledb.dev/device/identifier/iPhone19,4
/// - https://ipsw.dev/iPhone19,4
/// - https://appledb.dev/device/identifier/iPhone19,2 (iPhone 18 Pro — NOT Duo)
enum DuoDevice {
    /// Documented machine ids. Unknown future Duo ids must be added explicitly.
    static let knownMachineIds: Set<String> = [
        "iPhone19,4",
    ]

    /// Launch argument / env key for Debug-only Duo simulation in Xcode.
    static let forceArgument = "-ForceDuoDevice"
    static let forceEnvironmentKey = "JNM_FORCE_DUO"
    /// Legacy opt-out from when Debug forced Duo by default (PR #17). Kept so
    /// old schemes with `-NoForceDuoDevice` still launch cleanly.
    static let noForceArgument = "-NoForceDuoDevice"

    private static let log = Logger(subsystem: "co.jnm.coaching", category: "DuoDevice")

    /// Hardware / simulated model id used for Duo matching.
    /// Simulator: prefer `SIMULATOR_MODEL_IDENTIFIER` over `uname` (which is
    /// the host arch, never `iPhone19,4`).
    static var machineIdentifier: String {
        #if targetEnvironment(simulator)
        if let simModel = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"],
           !simModel.isEmpty {
            return simModel
        }
        #endif
        return utsnameMachineIdentifier
    }

    private static var utsnameMachineIdentifier: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: 1) { cString in
                String(cString: cString)
            }
        }
    }

    /// Simulator device display name, e.g. "iPhone Duo".
    private static var simulatorDeviceName: String? {
        #if targetEnvironment(simulator)
        ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"]
        #else
        nil
        #endif
    }

    /// Debug-only opt-in so Simulator/Xcode can exercise the Duo rail.
    /// Release/TestFlight always false. Default in Debug is also false —
    /// require an explicit launch arg / env (scheme ships `-ForceDuoDevice`).
    static var isForceDuoEnabled: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains(noForceArgument) {
            return false
        }
        if ProcessInfo.processInfo.environment[forceEnvironmentKey] == "0" {
            return false
        }
        if ProcessInfo.processInfo.arguments.contains(forceArgument) {
            return true
        }
        if ProcessInfo.processInfo.environment[forceEnvironmentKey] == "1" {
            return true
        }
        #endif
        return false
    }

    /// Pure decision mirrored by `decideIsDuo` in `duoDeviceModels.js`.
    /// Positive identification only; unknown → false.
    static func decideIsDuo(
        machineId: String,
        forceDuo: Bool,
        simulatorDeviceName: String?,
        hasFoldableDivision: Bool
    ) -> Bool {
        if forceDuo { return true }
        if knownMachineIds.contains(machineId) { return true }
        if let name = simulatorDeviceName?.lowercased(), name.contains("duo") {
            return true
        }
        if hasFoldableDivision { return true }
        return false
    }

    /// Definitive foldable signal: a division reserved region (fold), including
    /// inactive (flat/open). Regular iPhones do not report a hinge division.
    /// Soft-fails on older SDKs / when the view is not in a window yet.
    static func hasFoldableDivision(in view: UIView?) -> Bool {
        guard let view else { return false }
        // QueryOptions.includeInactive is iOS 27.1+ (fold present but inactive when flat).
        if #available(iOS 27.1, *) {
            let regions = view.reservedRegions(kind: .division, options: .includeInactive)
            return !regions.isEmpty
        }
        return false
    }

    static var isDuo: Bool {
        isDuo(hasFoldableDivision: false)
    }

    static func isDuo(hasFoldableDivision: Bool) -> Bool {
        decideIsDuo(
            machineId: machineIdentifier,
            forceDuo: isForceDuoEnabled,
            simulatorDeviceName: simulatorDeviceName,
            hasFoldableDivision: hasFoldableDivision
        )
    }

    /// Injected at document-start so the first paint sees `html[data-device="duo"]`.
    static var userScriptSource: String {
        userScriptSource(hasFoldableDivision: false)
    }

    static func userScriptSource(hasFoldableDivision: Bool) -> String {
        if isDuo(hasFoldableDivision: hasFoldableDivision) {
            return "document.documentElement.setAttribute('data-device','duo');"
        }
        return "/* not iPhone Duo (\(machineIdentifier)) */"
    }

    /// Logs detection details in DEBUG so Jonas can confirm on device/sim.
    static func logMachineIdentifierIfNeeded(hasFoldableDivision: Bool = false) {
        #if DEBUG
        let machine = machineIdentifier
        let unameId = utsnameMachineIdentifier
        let matched = knownMachineIds.contains(machine)
        let namedDuo = simulatorDeviceName?.lowercased().contains("duo") == true
        let forced = isForceDuoEnabled
        let foldable = hasFoldableDivision
        let simName = simulatorDeviceName ?? "(none)"
        let duo = isDuo(hasFoldableDivision: hasFoldableDivision)
        log.debug("machine=\(machine, privacy: .public) uname=\(unameId, privacy: .public) simName=\(simName, privacy: .public) isDuo=\(duo, privacy: .public) matchedKnown=\(matched, privacy: .public) namedDuo=\(namedDuo, privacy: .public) forceDuo=\(forced, privacy: .public) foldableDivision=\(foldable, privacy: .public)")
        print("[DuoDevice] machine=\(machine) uname=\(unameId) simName=\(simName) isDuo=\(duo) matchedKnown=\(matched) namedDuo=\(namedDuo) forceDuo=\(forced) foldableDivision=\(foldable)")
        #endif
    }
}
