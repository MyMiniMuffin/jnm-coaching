import Foundation
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
/// ## Simulator force (never on physical devices)
/// `-ForceDuoDevice` / `JNM_FORCE_DUO=1` apply only under
/// `#if targetEnvironment(simulator)`. Xcode LaunchAction args also reach a
/// physical Debug device, so a physical non-Duo iPhone must ignore them.
/// Release/TestFlight never force. Physical Duo is allowlist-only.
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

    /// Simulator-only launch argument / env (Debug scheme includes the arg).
    static let forceArgument = "-ForceDuoDevice"
    static let forceEnvironmentKey = "JNM_FORCE_DUO"
    /// Legacy opt-out from when Debug forced Duo by default (PR #17).
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

    /// Simulator-only opt-in so Xcode Run on a sim can exercise the Duo rail
    /// without a Duo sim model id. Physical devices always return false —
    /// LaunchAction args still apply when running Debug on hardware.
    static var isForceDuoEnabled: Bool {
        #if targetEnvironment(simulator)
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
        #endif
        return false
    }

    /// Pure decision mirrored by `decideIsDuo` in `duoDeviceModels.js`.
    /// Positive identification only; unknown → false.
    /// `forceDuo` is Simulator-only at the call site (`isForceDuoEnabled`).
    static func decideIsDuo(
        machineId: String,
        forceDuo: Bool,
        simulatorDeviceName: String?
    ) -> Bool {
        if forceDuo { return true }
        if knownMachineIds.contains(machineId) { return true }
        if let name = simulatorDeviceName?.lowercased(), name.contains("duo") {
            return true
        }
        return false
    }

    static var isDuo: Bool {
        decideIsDuo(
            machineId: machineIdentifier,
            forceDuo: isForceDuoEnabled,
            simulatorDeviceName: simulatorDeviceName
        )
    }

    /// Injected at document-start so the first paint sees `html[data-device="duo"]`.
    static var userScriptSource: String {
        if isDuo {
            return "document.documentElement.setAttribute('data-device','duo');"
        }
        return "/* not iPhone Duo (\(machineIdentifier)) */"
    }

    /// Logs detection details in DEBUG so Jonas can confirm on device/sim.
    static func logMachineIdentifierIfNeeded() {
        #if DEBUG
        let machine = machineIdentifier
        let unameId = utsnameMachineIdentifier
        let matched = knownMachineIds.contains(machine)
        let namedDuo = simulatorDeviceName?.lowercased().contains("duo") == true
        let forced = isForceDuoEnabled
        let simName = simulatorDeviceName ?? "(none)"
        log.debug("machine=\(machine, privacy: .public) uname=\(unameId, privacy: .public) simName=\(simName, privacy: .public) isDuo=\(isDuo, privacy: .public) matchedKnown=\(matched, privacy: .public) namedDuo=\(namedDuo, privacy: .public) forceDuo=\(forced, privacy: .public)")
        print("[DuoDevice] machine=\(machine) uname=\(unameId) simName=\(simName) isDuo=\(isDuo) matchedKnown=\(matched) namedDuo=\(namedDuo) forceDuo=\(forced)")
        #endif
    }
}
