import Foundation
import os

/// Known `utsname.machine` identifiers for iPhone Duo.
/// Keep in sync with `src/lib/duoDeviceModels.js`.
///
/// ## Verification status for `iPhone19,4`
/// Community databases (AppleDB, IPSW.dev, Signet) list iPhone Duo as
/// `iPhone19,4` (board V68AP). On a **physical** Duo, `uname` should report
/// that string. The **iPhone Duo Simulator** reports `arm64`/`x86_64` from
/// `uname`, but sets `SIMULATOR_MODEL_IDENTIFIER` (typically `iPhone19,4`)
/// and `SIMULATOR_DEVICE_NAME` (`iPhone Duo`) — we read those too.
///
/// DEBUG builds log the resolved id so Jonas can confirm on device/sim.
/// If a shipped Duo reports a different machine string, add it here and in
/// `duoDeviceModels.js`.
///
/// ## Debug override
/// Debug builds also force Duo by default so rail menus work even if the
/// simulator env vars are missing. Opt out with `-NoForceDuoDevice` or
/// `JNM_FORCE_DUO=0`. Release/TestFlight never force.
///
/// Authoritative cross-checks (community, not Apple public API):
/// - https://appledb.dev/device/identifier/iPhone19,4
/// - https://ipsw.dev/iPhone19,4
enum DuoDevice {
    /// Documented machine ids. Unknown future Duo ids must be added explicitly.
    static let knownMachineIds: Set<String> = [
        "iPhone19,4",
    ]

    /// Opt out of Debug Duo forcing (scheme / `simctl` launch args).
    static let noForceArgument = "-NoForceDuoDevice"
    /// Legacy explicit force (Debug already forces by default).
    static let forceArgument = "-ForceDuoDevice"
    static let forceEnvironmentKey = "JNM_FORCE_DUO"

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

    /// True when the simulator (or device name) clearly identifies as Duo.
    private static var isSimulatorNamedDuo: Bool {
        guard let name = simulatorDeviceName?.lowercased() else { return false }
        return name.contains("duo")
    }

    /// Debug builds force Duo rail by default (belt-and-suspenders for Simulator).
    static var isForceDuoEnabled: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains(noForceArgument) {
            return false
        }
        if ProcessInfo.processInfo.environment[forceEnvironmentKey] == "0" {
            return false
        }
        return true
        #else
        return false
        #endif
    }

    static var isDuo: Bool {
        if isForceDuoEnabled { return true }
        if knownMachineIds.contains(machineIdentifier) { return true }
        if isSimulatorNamedDuo { return true }
        return false
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
        let namedDuo = isSimulatorNamedDuo
        let forced = isForceDuoEnabled
        let simName = simulatorDeviceName ?? "(none)"
        log.debug("machine=\(machine, privacy: .public) uname=\(unameId, privacy: .public) simName=\(simName, privacy: .public) isDuo=\(isDuo, privacy: .public) matchedKnown=\(matched, privacy: .public) namedDuo=\(namedDuo, privacy: .public) forceDuo=\(forced, privacy: .public)")
        print("[DuoDevice] machine=\(machine) uname=\(unameId) simName=\(simName) isDuo=\(isDuo) matchedKnown=\(matched) namedDuo=\(namedDuo) forceDuo=\(forced)")
        #endif
    }
}
