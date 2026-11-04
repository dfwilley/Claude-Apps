import Foundation
import WebKit
import UniformTypeIdentifiers

/// Serves the app's screens from inside the app (bluebook://app/...) and your page photos from the app's folder
/// (bluebook://app/_files/photos/...). Nothing is loaded from the internet.
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "bluebook"
    let bundleDir: URL
    init(bundleDir: URL) { self.bundleDir = bundleDir }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return fail(task, 400) }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let rel = String(path.dropFirst())
        let fileURL: URL?
        if rel.hasPrefix("_files/") {
            let rest = rel.dropFirst("_files/".count)
            let parts = rest.split(separator: "/")
            if parts.count == 2, parts[0] == "photos", parts[1].hasSuffix(".jpg") {
                fileURL = Library.photoURL(String(parts[1].dropLast(4)).removingPercentEncoding ?? "")
            } else { fileURL = nil }
        } else {
            let candidate = bundleDir.appendingPathComponent(rel).standardizedFileURL
            fileURL = candidate.path.hasPrefix(bundleDir.standardizedFileURL.path) ? candidate : nil
        }
        guard let f = fileURL, let data = try? Data(contentsOf: f) else { return fail(task, 404) }
        let mime = UTType(filenameExtension: f.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!
        task.didReceive(resp); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
    private func fail(_ task: WKURLSchemeTask, _ code: Int) {
        let resp = HTTPURLResponse(url: task.request.url ?? URL(string: "bluebook://app/")!, statusCode: code, httpVersion: "HTTP/1.1", headerFields: nil)!
        task.didReceive(resp); task.didReceive(Data()); task.didFinish()
    }
}
