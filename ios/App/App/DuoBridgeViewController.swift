import UIKit
import Capacitor
import WebKit

/// Capacitor bridge that injects the Duo `data-device` marker into the
/// `WKWebViewConfiguration` *before* the first document load.
///
/// Adding a `WKUserScript` after `makeKeyAndVisible()` is not guaranteed to
/// run at document-start on the initial navigation — the configuration hook is.
final class DuoBridgeViewController: CAPBridgeViewController {
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let script = WKUserScript(
            source: DuoDevice.userScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(script)
        return configuration
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        DuoDevice.logMachineIdentifierIfNeeded()
    }
}
