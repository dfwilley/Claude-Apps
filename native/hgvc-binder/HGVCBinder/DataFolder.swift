import Foundation

/// The Dropbox folder (opened through the iPhone Files app) where the scheduled Claude task saves
/// "Claude - HGVC Binder Data <date> <time>.json" (older name: "HGVC Binder Data …"). The app only reads from it.
enum DataFolder {
    static let prefix = "HGVC Binder Data"
    private static let bookmarkKey = "dataFolderBookmark"
    private static let nameKey = "dataFolderName"

    static var isChosen: Bool { UserDefaults.standard.data(forKey: bookmarkKey) != nil }
    static var name: String? { UserDefaults.standard.string(forKey: nameKey) }

    static func remember(_ url: URL) throws {
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        let bm = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        UserDefaults.standard.set(bm, forKey: bookmarkKey)
        UserDefaults.standard.set(url.lastPathComponent, forKey: nameKey)
    }

    /// Picks the newest data file by the date and time in its name.
    static func newest(in names: [String]) -> String? {
        let stamp = { (n: String) -> String in n.components(separatedBy: prefix).last ?? n }
        return names.filter { $0.contains(prefix) && $0.lowercased().hasSuffix(".json") }.max { stamp($0) < stamp($1) }
    }

    /// Reads the newest data file. Returns nil if there isn't one yet.
    static func loadNewest() throws -> (name: String, json: String)? {
        guard let bm = UserDefaults.standard.data(forKey: bookmarkKey) else { throw Library.err("Choose your Dropbox data folder first.") }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: bm, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) else {
            throw Library.err("The app lost access to the Dropbox folder. Choose it again from the menu.")
        }
        guard url.startAccessingSecurityScopedResource() else { throw Library.err("The app lost access to the Dropbox folder. Choose it again from the menu.") }
        defer { url.stopAccessingSecurityScopedResource() }
        if stale, let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) { UserDefaults.standard.set(fresh, forKey: bookmarkKey) }

        var names: [String] = []; var e1: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &e1) { u in
            names = (try? FileManager.default.contentsOfDirectory(atPath: u.path)) ?? []
        }
        if let e1 { throw Library.err("Couldn't read the Dropbox folder (\(e1.localizedDescription)).") }
        guard let newest = newest(in: names) else { return nil }
        var text: String?; var e2: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url.appendingPathComponent(newest), options: [], error: &e2) { u in
            text = try? String(contentsOf: u, encoding: .utf8)
        }
        guard let json = text else { throw Library.err("Couldn't open \(newest). If Dropbox shows it as online-only, open it once in the Files app.") }
        return (newest, json)
    }
}
