import SwiftUI
import WebKit
import PDFKit
import QuickLook
import UniformTypeIdentifiers

/// The HGVC Binder screens (bundled inside the app — the same ones as the web version) plus the iPhone-only parts:
/// Face ID + Keychain for full account numbers, phone reminders, the Dropbox data folder, PDF reading, and viewing/sharing files.
struct BinderView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> BinderController { BinderController() }
    func updateUIViewController(_ vc: BinderController, context: Context) {}
}

final class BinderController: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate, QLPreviewControllerDataSource {
    private var web: WKWebView!
    private var folderReply: Int?
    private var previewURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 20/255, green: 48/255, blue: 79/255, alpha: 1)
        let cfg = WKWebViewConfiguration()
        let dir = Bundle.main.url(forResource: "hgvc-binder", withExtension: nil)!
        cfg.setURLSchemeHandler(SchemeHandler(bundleDir: dir), forURLScheme: SchemeHandler.scheme)
        cfg.userContentController.add(WeakHandler(self), name: "hgvc")
        web = WKWebView(frame: view.bounds, configuration: cfg)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 246/255, green: 241/255, blue: 231/255, alpha: 1)
        web.accessibilityIdentifier = "binderWeb"
        view.addSubview(web)
        web.load(URLRequest(url: URL(string: "hgvc://app/index.html")!))
        NotificationCenter.default.addObserver(self, selector: #selector(foreground), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    @objc private func foreground() { web.evaluateJavaScript("window.__hbEvent && window.__hbEvent('foreground')") }

    // Only the app's own pages open inside the app. Phone numbers and web links open in the Phone app / your default browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let s = url.scheme ?? ""
        if s == SchemeHandler.scheme || s == "blob" || s == "about" || s == "data" { return decisionHandler(.allow) }
        if ["tel", "https", "http", "mailto"].contains(s) { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    // MARK: Messages from the screens
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let cmd = m["cmd"] as? String, let id = m["id"] as? Int else { return }
        func bg(_ work: @escaping () throws -> Any?) {
            DispatchQueue.global(qos: .userInitiated).async { do { self.reply(id, value: try work()) } catch { self.replyError(id, error.localizedDescription) } }
        }
        switch cmd {
        case "readDB": reply(id, value: Library.readDB())
        case "writeDB":
            guard let json = m["json"] as? String else { return replyError(id, "Nothing to save") }
            bg { try Library.writeDB(json); return true }
        case "putDoc":
            guard let did = m["docId"] as? String, let b64 = m["base64"] as? String, let data = Data(base64Encoded: b64) else { return replyError(id, "Bad document") }
            bg { try Library.putDoc(did, data: data); return true }
        case "getDoc":
            guard let did = m["docId"] as? String else { return replyError(id, "Bad document") }
            bg { return try Library.getDoc(did).base64EncodedString() }
        case "deleteDoc":
            if let did = m["docId"] as? String { Library.deleteDoc(did) }
            reply(id, value: true)
        case "openDoc":
            guard let did = m["docId"] as? String else { return replyError(id, "Bad document") }
            do {
                previewURL = try Library.viewableCopy(did, name: (m["name"] as? String) ?? "Document", mime: (m["mime"] as? String) ?? "application/pdf")
                let ql = QLPreviewController(); ql.dataSource = self
                present(ql, animated: true); reply(id, value: true)
            } catch { replyError(id, error.localizedDescription) }
        case "unlock":
            Vault.unlock(reason: (m["reason"] as? String) ?? "Show your account number") { r in
                switch r {
                case .success: self.reply(id, value: true)
                case .failure(let e): self.replyError(id, e.localizedDescription)
                }
            }
        case "secretGet":
            reply(id, value: Vault.get((m["key"] as? String) ?? ""))
        case "secretSet":
            do { try Vault.set((m["key"] as? String) ?? "", (m["value"] as? String) ?? ""); reply(id, value: true) } catch { replyError(id, error.localizedDescription) }
        case "schedule":
            Notifier.schedule((m["list"] as? [[String: Any]]) ?? []) { ok in self.reply(id, value: ok) }
        case "folderStatus":
            reply(id, value: ["chosen": DataFolder.isChosen, "name": DataFolder.name ?? ""] as [String: Any])
        case "pickFolder":
            folderReply = id
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.directoryURL = nil
            present(picker, animated: true)
        case "loadFolderData":
            bg { guard let f = try DataFolder.loadNewest() else { return nil }; return ["name": f.name, "json": f.json] }
        case "pdfText":
            guard let b64 = m["base64"] as? String, let data = Data(base64Encoded: b64) else { return replyError(id, "Bad PDF") }
            bg {
                guard let doc = PDFDocument(data: data) else { throw Library.err("That isn't a PDF this iPhone can read.") }
                if doc.isLocked { throw Library.err("That PDF is password-protected.") }
                return (0..<doc.pageCount).compactMap { doc.page(at: $0)?.string }.joined(separator: "\n")
            }
        case "share":
            guard let name = m["name"] as? String, let b64 = m["base64"] as? String, let data = Data(base64Encoded: b64) else { return replyError(id, "Nothing to share") }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name.replacingOccurrences(of: "/", with: "-"))
            do { try data.write(to: url, options: .atomic) } catch { return replyError(id, error.localizedDescription) }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
            sheet.completionWithItemsHandler = { _, _, _, _ in self.reply(id, value: true) }
            present(sheet, animated: true)
        case "openURL":
            if let s = m["url"] as? String, let u = URL(string: s), ["tel", "https", "mailto"].contains(u.scheme ?? "") { UIApplication.shared.open(u) }
            reply(id, value: true)
        default:
            replyError(id, "Unknown request \(cmd)")
        }
    }

    // MARK: Dropbox folder picker
    func documentPicker(_ c: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let id = folderReply, let url = urls.first else { return }
        folderReply = nil
        do { try DataFolder.remember(url); reply(id, value: true) } catch { replyError(id, error.localizedDescription) }
    }
    func documentPickerWasCancelled(_ c: UIDocumentPickerViewController) { if let id = folderReply { reply(id, value: false) }; folderReply = nil }

    // MARK: Viewing a document
    func numberOfPreviewItems(in c: QLPreviewController) -> Int { previewURL == nil ? 0 : 1 }
    func previewController(_ c: QLPreviewController, previewItemAt i: Int) -> QLPreviewItem { previewURL! as NSURL }

    // MARK: Replies to the screens
    private func reply(_ id: Int, value: Any?) {
        let v = value ?? NSNull()
        guard let d = try? JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed]), let s = String(data: d, encoding: .utf8) else { return replyError(id, "Bad reply") }
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.__hbReply(\(id), true, \(s))") }
    }
    private func replyError(_ id: Int, _ msg: String) {
        let d = (try? JSONSerialization.data(withJSONObject: msg, options: [.fragmentsAllowed])) ?? Data("\"error\"".utf8)
        let s = String(data: d, encoding: .utf8) ?? "\"error\""
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.__hbReply(\(id), false, \(s))") }
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
        a.addTextField { $0.text = defaultText; $0.keyboardType = .numbersAndPunctuation }
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
