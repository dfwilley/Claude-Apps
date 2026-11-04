import Foundation
import WebKit
import UniformTypeIdentifiers

/// Serves the app's screens from inside the app (hgvc://app/...). Nothing is loaded from the internet.
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "hgvc"
    let bundleDir: URL
    init(bundleDir: URL) { self.bundleDir = bundleDir }

    static func mime(for ext: String) -> String {
        switch ext.lowercased() {
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "html": return "text/html"
        case "svg": return "image/svg+xml"
        case "webmanifest", "json": return "application/json"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return fail(task, 400) }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let candidate = bundleDir.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard candidate.path.hasPrefix(bundleDir.standardizedFileURL.path), let data = try? Data(contentsOf: candidate) else { return fail(task, 404) }
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": Self.mime(for: candidate.pathExtension), "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!
        task.didReceive(resp); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
    private func fail(_ task: WKURLSchemeTask, _ code: Int) {
        let resp = HTTPURLResponse(url: task.request.url ?? URL(string: "hgvc://app/")!, statusCode: code, httpVersion: "HTTP/1.1", headerFields: nil)!
        task.didReceive(resp); task.didReceive(Data()); task.didFinish()
    }
}
