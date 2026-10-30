import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let bridgeVC = CAPBridgeViewController()
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        injectDuoDeviceMarker(into: bridgeVC)

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func windowScene(_ windowScene: UIWindowScene,
                     didUpdate previousCoordinateSpace: UICoordinateSpace,
                     interfaceOrientation previousInterfaceOrientation: UIInterfaceOrientation,
                     traitCollection previousTraitCollection: UITraitCollection) {
        guard let bridgeVC = window?.rootViewController as? CAPBridgeViewController else { return }
        bridgeVC.view.setNeedsLayout()
        bridgeVC.view.layoutIfNeeded()
        bridgeVC.webView?.setNeedsLayout()
        bridgeVC.webView?.layoutIfNeeded()
    }

    /// Sets `html[data-device="duo"]` at document-start on known Duo hardware.
    private func injectDuoDeviceMarker(into bridgeVC: CAPBridgeViewController) {
        let script = WKUserScript(
            source: DuoDevice.userScriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )

        if let webView = bridgeVC.webView {
            webView.configuration.userContentController.addUserScript(script)
            return
        }

        // webView may not exist yet — attach once the bridge finishes loading.
        DispatchQueue.main.async { [weak bridgeVC] in
            guard let webView = bridgeVC?.webView else { return }
            webView.configuration.userContentController.addUserScript(script)
        }
    }
}
