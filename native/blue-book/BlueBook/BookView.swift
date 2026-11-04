import SwiftUI
import WebKit
import VisionKit

/// The Blue Book screens (bundled inside the app) plus the iPhone-only parts:
/// the document camera, Apple's handwriting reader, file storage, and the share sheet.
struct BookView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> BookController { BookController() }
    func updateUIViewController(_ vc: BookController, context: Context) {}
}

final class BookController: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, VNDocumentCameraViewControllerDelegate {
    private var web: WKWebView!
    private var scanReply: Int?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 20/255, green: 48/255, blue: 94/255, alpha: 1)
        let cfg = WKWebViewConfiguration()
        let dir = Bundle.main.url(forResource: "blue-book", withExtension: nil)!
        cfg.setURLSchemeHandler(SchemeHandler(bundleDir: dir), forURLScheme: SchemeHandler.scheme)
        cfg.userContentController.add(WeakHandler(self), name: "bluebook")
        cfg.allowsInlineMediaPlayback = true
        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 247/255, green: 243/255, blue: 234/255, alpha: 1)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.accessibilityIdentifier = "bookWeb"
        view.addSubview(web)
        web.load(URLRequest(url: URL(string: "bluebook://app/index.html")!))
    }

    // Only the app's own pages may open inside the app; anything else is refused.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let s = action.request.url?.scheme ?? ""
        decisionHandler(s == SchemeHandler.scheme || s == "blob" || s == "about" || s == "data" ? .allow : .cancel)
    }

    // MARK: Messages from the screens
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let cmd = m["cmd"] as? String, let id = m["id"] as? Int else { return }
        switch cmd {
        case "readDB":
            reply(id, value: Library.readDB())
        case "writeDB":
            guard let json = m["json"] as? String else { return replyError(id, "Nothing to save") }
            DispatchQueue.global(qos: .userInitiated).async {
                do { try Library.writeDB(json); self.reply(id, value: true) } catch { self.replyError(id, error.localizedDescription) }
            }
        case "putPhoto":
            guard let pid = m["photoId"] as? String, let b64 = m["base64"] as? String, let data = Data(base64Encoded: b64) else { return replyError(id, "Bad photo") }
            DispatchQueue.global(qos: .userInitiated).async {
                do { try Library.putPhoto(pid, data: data); self.reply(id, value: true) } catch { self.replyError(id, error.localizedDescription) }
            }
        case "deletePhoto":
            if let pid = m["photoId"] as? String { Library.deletePhoto(pid) }
            reply(id, value: true)
        case "ocr":
            guard let pid = m["photoId"] as? String, let url = Library.photoURL(pid) else { return replyError(id, "Bad photo") }
            DispatchQueue.global(qos: .userInitiated).async {
                guard let img = UIImage(contentsOfFile: url.path) else { return self.replyError(id, "Photo not found") }
                do {
                    let words = try PageReader.read(img)
                    let arr = words.map { ["text": $0.text, "conf": $0.conf, "x0": $0.x0, "y0": $0.y0, "x1": $0.x1, "y1": $0.y1] as [String: Any] }
                    self.reply(id, value: arr)
                } catch { self.replyError(id, error.localizedDescription) }
            }
        case "scan":
            guard VNDocumentCameraViewController.isSupported else { return replyError(id, "The document camera isn't available on this device. Use Import photos instead.") }
            scanReply = id
            let cam = VNDocumentCameraViewController(); cam.delegate = self
            present(cam, animated: true)
        case "share":
            guard let name = m["name"] as? String, let b64 = m["base64"] as? String, let data = Data(base64Encoded: b64) else { return replyError(id, "Nothing to share") }
            let safe = name.replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
            do { try data.write(to: url, options: .atomic) } catch { return replyError(id, error.localizedDescription) }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
            sheet.completionWithItemsHandler = { _, _, _, _ in self.reply(id, value: true) }
            present(sheet, animated: true)
        default:
            replyError(id, "Unknown request \(cmd)")
        }
    }

    // MARK: Document camera — finds the page edges and straightens each page itself
    func documentCameraViewController(_ c: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        var ids: [String] = []
        for i in 0..<scan.pageCount { if let pid = try? Library.savePage(scan.imageOfPage(at: i)) { ids.append(pid) } }
        c.dismiss(animated: true)
        if let id = scanReply { reply(id, value: ids) }; scanReply = nil
    }
    func documentCameraViewControllerDidCancel(_ c: VNDocumentCameraViewController) {
        c.dismiss(animated: true); if let id = scanReply { reply(id, value: [String]()) }; scanReply = nil
    }
    func documentCameraViewController(_ c: VNDocumentCameraViewController, didFailWithError error: Error) {
        c.dismiss(animated: true); if let id = scanReply { replyError(id, error.localizedDescription) }; scanReply = nil
    }

    // MARK: Replies to the screens
    private func reply(_ id: Int, value: Any?) {
        let v = value ?? NSNull()
        guard let d = try? JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed]), let s = String(data: d, encoding: .utf8) else { return replyError(id, "Bad reply") }
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.__bbReply(\(id), true, \(s))") }
    }
    private func replyError(_ id: Int, _ msg: String) {
        let d = (try? JSONSerialization.data(withJSONObject: msg, options: [.fragmentsAllowed])) ?? Data("\"error\"".utf8)
        let s = String(data: d, encoding: .utf8) ?? "\"error\""
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.__bbReply(\(id), false, \(s))") }
    }

    // MARK: alert / confirm / prompt boxes used by the screens
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) }); present(a, animated: true)
    }
}

/// Avoids a retain cycle between the web view and its message handler.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ t: WKScriptMessageHandler) { target = t }
    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) { target?.userContentController(uc, didReceive: m) }
}
