import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // DuoBridgeViewController injects the Duo marker via webViewConfiguration(for:)
        // before the first load — do not add WKUserScript after makeKeyAndVisible.
        let bridgeVC = DuoBridgeViewController()
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

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
}
