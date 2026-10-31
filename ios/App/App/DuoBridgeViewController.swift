import UIKit
import Capacitor
import WebKit

/// Capacitor bridge that injects the Duo `data-device` marker before the
/// first document paints, so `shellMode` enters rail instead of bottom nav.
///
/// ## Why not only `webViewConfiguration(for:)`?
/// Capacitor 8 replaces `configuration.userContentController` with its own
/// `WebViewDelegationHandler.contentController` *after* that hook returns
/// (`CAPBridgeViewController.prepareWebView`). Scripts added there are discarded.
/// Inject on the live controller in `capacitorDidLoad()` (still before
/// `loadWebView()`), and re-assert with `evaluateJavaScript` after appear.
final class DuoBridgeViewController: CAPBridgeViewController {
    // CAPBridgeViewController (Capacitor 8.5.3) declares these as `open`.
    // Members of a `final` class cannot be `open` — use `public override`.
    public override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        // Still call super; Duo script is added later on the real contentController.
        return super.webViewConfiguration(for: instanceConfiguration)
    }

    public override func capacitorDidLoad() {
        super.capacitorDidLoad()
        DuoDevice.logMachineIdentifierIfNeeded()
        injectDuoUserScript()
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Backup if document-start script missed a navigation or SPA remount.
        ensureDuoDeviceAttribute()
    }

    private func injectDuoUserScript() {
        guard DuoDevice.isDuo else { return }
        guard let controller = webView?.configuration.userContentController else { return }
        let script = WKUserScript(
            source: DuoDevice.userScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        controller.addUserScript(script)
    }

    private func ensureDuoDeviceAttribute() {
        guard DuoDevice.isDuo else { return }
        webView?.evaluateJavaScript(DuoDevice.userScriptSource, completionHandler: nil)
    }
}
