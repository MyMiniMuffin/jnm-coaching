import UIKit
import Capacitor
import WebKit

/// Capacitor bridge that injects the Duo `data-device` marker into the
/// `WKWebViewConfiguration` *before* the first document load.
///
/// Adding a `WKUserScript` after `makeKeyAndVisible()` is not guaranteed to
/// run at document-start on the initial navigation — the configuration hook is.
final class DuoBridgeViewController: CAPBridgeViewController {
    // CAPBridgeViewController (Capacitor 8.5.3) declares these as `open`.
    // Members of a `final` class cannot be `open` — use `public override`.
    public override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let script = WKUserScript(
            source: DuoDevice.userScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(script)
        return configuration
    }

    public override func capacitorDidLoad() {
        super.capacitorDidLoad()
        DuoDevice.logMachineIdentifierIfNeeded()
    }
}
