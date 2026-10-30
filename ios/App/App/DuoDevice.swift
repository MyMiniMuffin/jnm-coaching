import Foundation

/// Known `utsname.machine` identifiers for iPhone Duo.
/// Keep in sync with `src/lib/duoDeviceModels.js`.
/// Add new SKUs here when Apple ships additional Duo hardware.
enum DuoDevice {
    /// Documented machine ids. Unknown future Duo ids must be added explicitly.
    static let knownMachineIds: Set<String> = [
        "iPhone19,4",
    ]

    static var machineIdentifier: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: 1) { cString in
                String(cString: cString)
            }
        }
    }

    static var isDuo: Bool {
        knownMachineIds.contains(machineIdentifier)
    }

    /// Injected at document-start so the first paint sees `html[data-device="duo"]`.
    static var userScriptSource: String {
        isDuo
            ? "document.documentElement.setAttribute('data-device','duo');"
            : "/* not iPhone Duo (\(machineIdentifier)) */"
    }
}
