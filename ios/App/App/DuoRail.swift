import SwiftUI
import UIKit
import WebKit

// MARK: - Items

/// One rail destination. Ids mirror `NAV_ITEMS` in `src/lib/config.js`; the web
/// layer sends the live list (labels included) with every state message.
struct DuoRailItem: Equatable, Identifiable {
    let id: String
    let label: String

    /// SF Symbol per known id. `.symbolVariant(.fill)` marks the active tab.
    var symbol: String { Self.symbols[id] ?? "circle" }

    static let symbols: [String: String] = [
        "dashboard": "house",
        "gallery": "camera",
        "diet": "fork.knife",
        "workout": "dumbbell",
        "checkin": "list.clipboard",
    ]

    /// Shown until the web layer reports its own list.
    static let defaults: [DuoRailItem] = [
        DuoRailItem(id: "dashboard", label: "Hjem"),
        DuoRailItem(id: "gallery", label: "Galleri"),
        DuoRailItem(id: "diet", label: "Mat"),
        DuoRailItem(id: "workout", label: "Trening"),
        DuoRailItem(id: "checkin", label: "Rapport"),
    ]
}

// MARK: - Metrics

/// Rail geometry, ported 1:1 from the old CSS (`html[data-shell="rail"]` in
/// `src/index.css`) so the layout the web rail had is unchanged:
/// - 48pt buttons, 58pt wide capsule, back circle on top, tabs pinned to the bottom
/// - the rail lives in the status column (`--app-rail-col`), nudged ≤5pt left
/// - top clearance under the status cluster (`--app-rail-status-clearance`)
///
/// `DuoRailMetrics.reserveWidth` equals `--app-rail-col`, so web content keeps
/// reserving the same space with its existing CSS.
struct DuoRailMetrics {
    static let buttonSize: CGFloat = 48
    static let capsuleWidth: CGFloat = 58 // 3rem + 0.5rem + 2px
    static let minColumnWidth: CGFloat = capsuleWidth + 12 // + 0.75rem
    static let unfoldedMinWidth: CGFloat = 700

    var size: CGSize
    var safeArea: UIEdgeInsets
    var keyboardTop: CGFloat?
    var itemCount: Int
    var showsBack: Bool

    /// Folded landscape (`max-height: 500px` + landscape) — everything tightens.
    var isCompact: Bool { size.height <= 500 && size.width > size.height }
    var isUnfolded: Bool { size.width >= Self.unfoldedMinWidth }
    var keyboardVisible: Bool { keyboardTop != nil }

    var columnWidth: CGFloat { max(safeArea.right, Self.minColumnWidth) }

    /// `--app-rail-status-nudge`: clamp(0, (inset - 20) * 100, 5)
    var nudge: CGFloat { min(max((safeArea.right - 20) * 100, 0), 5) }

    /// `--app-rail-status-clearance`; the unfolded rule wins over compact (CSS order).
    var statusClearance: CGFloat {
        let raw = (safeArea.right - 20) * 100
        if isUnfolded { return max(52, min(124, raw)) }
        if isCompact { return max(4, min(40, raw)) }
        return max(52, min(172, raw))
    }

    var topPadding: CGFloat { safeArea.top + statusClearance }

    var bottomPadding: CGFloat {
        let base: CGFloat = isCompact ? 5.6 : 12
        return keyboardVisible ? base : max(base, safeArea.bottom)
    }

    var stackGap: CGFloat { isCompact ? 4 : 12 }
    var tabGap: CGFloat { isCompact ? 0 : 2 }
    /// Inner padding (4pt, 2pt compact) + 1pt hairline, as in the CSS capsule.
    var capsuleInset: CGFloat { (isCompact ? 2 : 4) + 1 }

    /// The rail follows the visible area: the keyboard shortens it.
    var availableHeight: CGFloat {
        guard let keyboardTop else { return size.height }
        return max(0, min(size.height, keyboardTop))
    }

    var tabsHeight: CGFloat {
        let n = CGFloat(max(itemCount, 0))
        return n * Self.buttonSize + max(n - 1, 0) * tabGap + capsuleInset * 2
    }

    var requiredHeight: CGFloat {
        topPadding + (showsBack ? Self.buttonSize + stackGap : 0) + tabsHeight + bottomPadding
    }

    /// Nothing is clipped or scrolled: if it does not fit (landscape + keyboard) it hides.
    var fits: Bool { availableHeight >= requiredHeight }

    /// Interactive regions in the rail column's own coordinates (for hit testing).
    var interactiveRects: [CGRect] {
        guard fits else { return [] }
        var rects: [CGRect] = []
        let centerX = columnWidth / 2
        rects.append(CGRect(
            x: centerX - Self.capsuleWidth / 2,
            y: availableHeight - bottomPadding - tabsHeight,
            width: Self.capsuleWidth,
            height: tabsHeight
        ))
        if showsBack {
            rects.append(CGRect(
                x: centerX - Self.buttonSize / 2,
                y: topPadding,
                width: Self.buttonSize,
                height: Self.buttonSize
            ))
        }
        return rects
    }
}

// MARK: - Model

final class DuoRailModel: ObservableObject {
    @Published var items: [DuoRailItem] = DuoRailItem.defaults
    @Published var activeId: String = "dashboard"
    @Published var showsBack = false
    /// Web says the shell is `rail` and the screen has navigation.
    @Published var isVisible = false
    @Published var size: CGSize = .zero
    @Published var safeArea: UIEdgeInsets = .zero
    @Published var keyboardTop: CGFloat?

    var onSelect: ((String) -> Void)?
    var onBack: (() -> Void)?

    var metrics: DuoRailMetrics {
        DuoRailMetrics(
            size: size,
            safeArea: safeArea,
            keyboardTop: keyboardTop,
            itemCount: items.count,
            showsBack: showsBack
        )
    }

    var isShown: Bool { isVisible && size != .zero && metrics.fits }
}

// MARK: - Liquid Glass

/// Liquid Glass on iOS 26+, an equivalent material capsule before that
/// (the old CSS look: translucent warm white, hairline, soft shadow).
private struct RailGlass<S: InsettableShape>: ViewModifier {
    let shape: S

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: shape)
        } else {
            legacy(content)
        }
        #else
        legacy(content)
        #endif
    }

    private func legacy(_ content: Content) -> some View {
        content
            .background(shape.fill(DuoRailPalette.surface.opacity(0.82)))
            .background(.ultraThinMaterial, in: shape)
            .overlay(shape.strokeBorder(Color.black.opacity(0.08), lineWidth: 1))
            .shadow(color: Color.black.opacity(0.10), radius: 10, x: 0, y: 6)
    }
}

private enum DuoRailPalette {
    /// tailwind: surface.50, accent.hover, ink.muted, ink.DEFAULT
    static let surface = Color(red: 247 / 255, green: 247 / 255, blue: 244 / 255)
    static let accent = Color(red: 27 / 255, green: 80 / 255, blue: 83 / 255)
    static let inkMuted = Color(red: 82 / 255, green: 82 / 255, blue: 82 / 255)
    static let ink = Color(red: 23 / 255, green: 23 / 255, blue: 23 / 255)
}

// MARK: - SwiftUI view

struct DuoRailView: View {
    @ObservedObject var model: DuoRailModel

    var body: some View {
        let m = model.metrics
        VStack(spacing: m.stackGap) {
            if model.showsBack {
                backButton
            }
            Spacer(minLength: 0)
            tabs(m)
        }
        .frame(width: DuoRailMetrics.capsuleWidth)
        .padding(.top, m.topPadding)
        .padding(.bottom, m.bottomPadding)
        .frame(width: m.columnWidth, height: m.availableHeight, alignment: .top)
        .opacity(model.isShown ? 1 : 0)
        .allowsHitTesting(model.isShown)
        .animation(.easeOut(duration: 0.2), value: model.isShown)
        .animation(.easeOut(duration: 0.2), value: model.showsBack)
        // Fixed-size content is centred inside the safe-area rect, which shifted the
        // rail ~(left - right inset)/2 into the page. A flexible root lets
        // ignoresSafeArea hand it the full column, so all padding above is exact.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .ignoresSafeArea()
        .preferredColorScheme(.light)
    }

    private var backButton: some View {
        Button {
            model.onBack?()
        } label: {
            Image(systemName: "chevron.left")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(DuoRailPalette.ink)
                .frame(width: DuoRailMetrics.buttonSize, height: DuoRailMetrics.buttonSize)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .modifier(RailGlass(shape: Circle()))
        .accessibilityLabel("Tilbake")
        .accessibilityIdentifier("duo-rail-back")
        .transition(.opacity)
    }

    private func tabs(_ m: DuoRailMetrics) -> some View {
        VStack(spacing: m.tabGap) {
            ForEach(model.items) { item in
                tabButton(item)
            }
        }
        .padding(m.capsuleInset)
        .modifier(RailGlass(shape: Capsule()))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Hovednavigasjon")
    }

    private func tabButton(_ item: DuoRailItem) -> some View {
        let isActive = item.id == model.activeId
        return Button {
            model.onSelect?(item.id)
        } label: {
            ZStack {
                if isActive {
                    Circle()
                        .fill(Color.white.opacity(0.78))
                        .overlay(Circle().strokeBorder(Color.black.opacity(0.06), lineWidth: 1))
                        .shadow(color: Color.black.opacity(0.08), radius: 3, x: 0, y: 1)
                        .transition(.opacity)
                }
                Image(systemName: item.symbol)
                    .symbolVariant(isActive ? .fill : .none)
                    .font(.system(size: 21, weight: isActive ? .semibold : .regular))
                    .foregroundColor(isActive ? DuoRailPalette.accent : DuoRailPalette.inkMuted)
            }
            .frame(width: DuoRailMetrics.buttonSize, height: DuoRailMetrics.buttonSize)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
        .accessibilityAddTraits(isActive ? .isSelected : [])
        .accessibilityIdentifier("duo-rail-\(item.id)")
    }
}

// MARK: - UIKit host

/// Only the pills take touches; the rest of the rail column is the page below.
private final class DuoRailContainerView: UIView {
    var interactiveRects: () -> [CGRect] = { [] }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        interactiveRects().contains { $0.insetBy(dx: -4, dy: -4).contains(point) }
    }
}

/// Forwards script messages without letting the user-content controller retain
/// the rail (and through it the view controller).
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

/// Native iPhone Duo navigation rail: a SwiftUI (Liquid Glass) overlay above the
/// Capacitor web view. The web app stays the source of truth for the active tab
/// and back action; this class only mirrors state in and forwards taps out.
///
/// ```
/// web → native   webkit.messageHandlers.jnmRail.postMessage({type:'state', ...})
/// native → web   window 'jnm:rail' CustomEvent {action:'select'|'back', id?}
/// ```
final class DuoRailController: NSObject, WKScriptMessageHandler {
    static let handlerName = "jnmRail"
    private static let maxItems = 8

    private let model: DuoRailModel
    private let container = DuoRailContainerView()
    private let host: UIHostingController<DuoRailView>
    private weak var parent: UIViewController?
    private weak var webView: WKWebView?
    private let haptics = UIImpactFeedbackGenerator(style: .light)
    private var installed = false

    init(parent: UIViewController, webView: WKWebView) {
        self.parent = parent
        self.webView = webView
        let model = DuoRailModel()
        self.model = model
        self.host = UIHostingController(rootView: DuoRailView(model: model))
        super.init()

        model.onSelect = { [weak self] id in self?.select(id) }
        model.onBack = { [weak self] in self?.back() }
        container.interactiveRects = { [weak self] in self?.model.metrics.interactiveRects ?? [] }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: install

    func install() {
        guard !installed, let parent, let webView else { return }
        installed = true

        webView.configuration.userContentController.add(
            WeakScriptMessageHandler(self),
            name: Self.handlerName
        )

        host.view.backgroundColor = .clear
        host.view.isOpaque = false
        if #available(iOS 16.4, *) {
            host.safeAreaRegions = []
        }
        parent.addChild(host)
        container.backgroundColor = .clear
        container.isHidden = true
        container.addSubview(host.view)
        host.view.frame = container.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        parent.view.addSubview(container)
        host.didMove(toParent: parent)

        let center = NotificationCenter.default
        center.addObserver(
            self,
            selector: #selector(keyboardWillChange(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
        layout()
    }

    // MARK: layout

    /// Call from `viewDidLayoutSubviews` (fold / rotate / safe-area changes).
    func layout() {
        guard installed, let view = parent?.view else { return }
        let bounds = view.bounds
        if model.size != bounds.size { model.size = bounds.size }
        if model.safeArea != view.safeAreaInsets { model.safeArea = view.safeAreaInsets }

        let m = model.metrics
        container.frame = CGRect(
            x: bounds.width - m.nudge - m.columnWidth,
            y: 0,
            width: m.columnWidth,
            height: bounds.height
        )
        container.isHidden = !model.isShown
        view.bringSubviewToFront(container)
    }

    // MARK: keyboard

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let view = parent?.view,
              let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue
        else { return }
        let frame = view.convert(end, from: nil)
        let top: CGFloat? = frame.minY < view.bounds.height ? frame.minY : nil
        if model.keyboardTop != top {
            model.keyboardTop = top
            layout()
        }
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        if model.keyboardTop != nil {
            model.keyboardTop = nil
            layout()
        }
    }

    // MARK: web → native

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              body["type"] as? String == "state"
        else { return }

        let visible = body["visible"] as? Bool ?? false
        let active = body["activeId"] as? String
        let showsBack = body["showBack"] as? Bool ?? false
        let items = Self.parseItems(body["items"])

        if let items, model.items != items { model.items = items }
        if let active, !active.isEmpty, model.activeId != active {
            withAnimation(.easeOut(duration: 0.2)) { model.activeId = active }
        }
        if model.showsBack != showsBack { model.showsBack = showsBack }
        if model.isVisible != visible { model.isVisible = visible }
        layout()
    }

    private static func parseItems(_ raw: Any?) -> [DuoRailItem]? {
        guard let list = raw as? [[String: Any]], !list.isEmpty else { return nil }
        let items: [DuoRailItem] = list.prefix(maxItems).compactMap { entry in
            guard let id = entry["id"] as? String, !id.isEmpty, id.count <= 32 else { return nil }
            let label = (entry["label"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? id
            return DuoRailItem(id: id, label: String(label.prefix(32)))
        }
        return items.isEmpty ? nil : items
    }

    // MARK: native → web

    private func select(_ id: String) {
        if id != model.activeId, !UIAccessibility.isReduceMotionEnabled {
            haptics.impactOccurred()
        }
        // Optimistic; the web layer confirms with its next state message.
        withAnimation(.easeOut(duration: 0.2)) { model.activeId = id }
        dispatch(["action": "select", "id": id])
    }

    private func back() {
        if !UIAccessibility.isReduceMotionEnabled { haptics.impactOccurred() }
        dispatch(["action": "back"])
    }

    private func dispatch(_ detail: [String: String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8)
        else { return }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('jnm:rail',{detail:\(json)}));",
            completionHandler: nil
        )
    }
}
