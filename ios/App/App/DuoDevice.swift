import Foundation
import os

/// Known `utsname.machine` identifiers for iPhone Duo.
/// Keep in sync with `src/lib/duoDeviceModels.js`.
///
/// ## Verification status for `iPhone19,4`
/// Community databases (AppleDB, IPSW.dev, Signet) list iPhone Duo as
/// `iPhone19,4` (board V68AP). This has **not** been confirmed on physical
/// Duo hardware in this project yet — simulator returns `arm64` / `x86_64`
/// and never matches. Debug builds log `utsname.machine` so a real device
/// can confirm the id. If a shipped Duo reports a different machine string,
/// add it here and in `duoDeviceModels.js`.
///
/// ## Simulator / Xcode debugging
/// Pass launch argument `-ForceDuoDevice` (Debug scheme includes it) or set
/// env `JNM_FORCE_DUO=1` so the WKWebView gets `data-device="duo"` and the
/// rail shell can be verified without physical Duo hardware. Release builds
/// ignore the override.
///
/// Authoritative cross-checks (community, not Apple public API):
/// - https://appledb.dev/device/identifier/iPhone19,4
/// - https://ipsw.dev/iPhone19,4
enum DuoDevice {
    /// Documented machine ids. Unknown future Duo ids must be added explicitly.
    static let knownMachineIds: Set<String> = [
        "iPhone19,4",
    ]

    /// Launch argument / env key for Debug-only Duo simulation in Xcode.
    static let forceArgument = "-ForceDuoDevice"
    static let forceEnvironmentKey = "JNM_FORCE_DUO"

    private static let log = Logger(subsystem: "co.jnm.coaching", category: "DuoDevice")

    static var machineIdentifier: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: 1) { cString in
                String(cString: cString)
            }
        }
    }

    /// Debug-only override so Simulator/Xcode can exercise the Duo rail.
    static var isForceDuoEnabled: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains(forceArgument) {
            return true
        }
        if ProcessInfo.processInfo.environment[forceEnvironmentKey] == "1" {
            return true
        }
        #endif
        return false
    }

    static var isDuo: Bool {
        if isForceDuoEnabled { return true }
        return knownMachineIds.contains(machineIdentifier)
    }

    /// Injected at document-start so the first paint sees `html[data-device="duo"]`.
    static var userScriptSource: String {
        if isDuo {
            return "document.documentElement.setAttribute('data-device','duo');"
        }
        return "/* not iPhone Duo (\(machineIdentifier)) */"
    }

    /// Logs `utsname.machine` in DEBUG so Jonas can confirm the Duo id on device.
    static func logMachineIdentifierIfNeeded() {
        #if DEBUG
        let machine = machineIdentifier
        let matched = knownMachineIds.contains(machine)
        let forced = isForceDuoEnabled
        log.debug("utsname.machine=\(machine, privacy: .public) isDuo=\(isDuo, privacy: .public) matchedKnown=\(matched, privacy: .public) forceDuo=\(forced, privacy: .public) known=\(knownMachineIds.sorted().joined(separator: ","), privacy: .public)")
        print("[DuoDevice] utsname.machine=\(machine) isDuo=\(isDuo) matchedKnown=\(matched) forceDuo=\(forced)")
        #endif
    }
}
