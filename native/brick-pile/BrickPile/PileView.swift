import SwiftUI
import WebKit

/// The Brick Pile screens, bundled inside the app. They are the same files as the web version (the brick-pile folder),
/// so a change there changes the iPhone app too. The iPhone side only shows them and answers their "Are you sure?" questions.
struct PileView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> PileController { PileController() }
    func updateUIViewController(_ vc: PileController, context: Context) {}
}

final class PileController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var web: WKWebView!

    /// A made-up pile and one made-up idea, used only by the screenshot test so there is something to look at.
    static let samplePile = """
    localStorage.setItem('brick-pile:v1', JSON.stringify({ nextId: 6, photos: [], who: 'kid', items: [
      { id: 1, name: '2 x 4 brick', kind: 'brick', color: 'red', count: 6, unsure: false },
      { id: 2, name: '2 x 2 brick', kind: 'brick', color: 'yellow', count: 4, unsure: false },
      { id: 3, name: '1 x 2 plate', kind: 'plate', color: 'white', count: 8, unsure: true },
      { id: 4, name: '2 x 6 plate', kind: 'plate', color: 'dark gray', count: 2, unsure: false },
      { id: 5, name: 'small wheel with tire', kind: 'wheel', color: 'black', count: 4, unsure: false }],
      ideas: [{ name: 'Little race car', level: 'easy', about: 'A low, fast car.', pieces: 8, short: [],
        parts: [{ name: '2 x 6 plate', color: 'dark gray', count: 2 }, { name: 'small wheel with tire', color: 'black', count: 4 }, { name: '2 x 4 brick', color: 'red', count: 2 }],
        steps: ['Lay the two dark gray plates end to end.', 'Push the four wheels under the corners.', 'Put two red bricks on top.'] }] }));
    """

    override func viewDidLoad() {
        super.viewDidLoad()
        let paper = UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 22/255, green: 19/255, blue: 12/255, alpha: 1) : UIColor(red: 1, green: 246/255, blue: 220/255, alpha: 1) }
        view.backgroundColor = paper
        let cfg = WKWebViewConfiguration()
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-resetForUITest") {
            let start = args.contains("-samplePile") ? Self.samplePile : ""
            cfg.userContentController.addUserScript(WKUserScript(source: "localStorage.clear();" + start, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let dir = Bundle.main.url(forResource: "brick-pile", withExtension: nil)!
        cfg.setURLSchemeHandler(SchemeHandler(bundleDir: dir), forURLScheme: SchemeHandler.scheme)
        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = paper
        web.scrollView.backgroundColor = paper
        web.accessibilityIdentifier = "pileWeb"
        view.addSubview(web)
        web.load(URLRequest(url: URL(string: "brickpile://app/index.html")!))
    }

    // Only the app's own screens open inside the app. A web link would open in the phone's browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let s = url.scheme ?? ""
        if s == SchemeHandler.scheme || s == "blob" || s == "about" || s == "data" { return decisionHandler(.allow) }
        if s == "https" { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    // The screens' "OK" and "Are you sure?" boxes.
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(a, animated: true)
    }
}
