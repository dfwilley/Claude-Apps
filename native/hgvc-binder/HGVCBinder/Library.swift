import Foundation

/// Where HGVC Binder keeps your binder on this iPhone (the app's own Documents folder, included in your iPhone backup):
/// HGVCBinder/binder.json          — properties, points, fees, contacts, notes (account numbers: last 4 digits only)
/// HGVCBinder/binder.previous.json — the version before the last save, just in case
/// HGVCBinder/docs/<id>            — statements, deeds and receipts you added
/// Full contract and member numbers are NOT here — they're in the Keychain (see Vault).
enum Library {
    static var root: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("HGVCBinder", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("docs"), withIntermediateDirectories: true)
        return dir
    }
    static var dbURL: URL { root.appendingPathComponent("binder.json") }
    static var previousURL: URL { root.appendingPathComponent("binder.previous.json") }

    /// Ids come from the app's screens; only letters, digits, - and _ so a name can't point outside the folder.
    static func isSafeId(_ id: String) -> Bool {
        !id.isEmpty && id.count < 80 && id.unicodeScalars.allSatisfy { $0.isASCII } && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
    }
    static func docURL(_ id: String) -> URL? {
        guard isSafeId(id) else { return nil }
        return root.appendingPathComponent("docs").appendingPathComponent(id)
    }

    static func readDB() -> String? { try? String(contentsOf: dbURL, encoding: .utf8) }

    static func writeDB(_ json: String) throws {
        let fm = FileManager.default
        if fm.fileExists(atPath: dbURL.path) {
            try? fm.removeItem(at: previousURL)
            try? fm.copyItem(at: dbURL, to: previousURL)
        }
        try Data(json.utf8).write(to: dbURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func putDoc(_ id: String, data: Data) throws {
        guard let url = docURL(id) else { throw err("Bad document name") }
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func getDoc(_ id: String) throws -> Data {
        guard let url = docURL(id), let d = try? Data(contentsOf: url) else { throw err("That document isn't on this iPhone.") }
        return d
    }
    static func deleteDoc(_ id: String) { if let url = docURL(id) { try? FileManager.default.removeItem(at: url) } }

    /// A temporary copy with a readable name and the right ending, for viewing or sharing.
    static func viewableCopy(_ id: String, name: String, mime: String) throws -> URL {
        let data = try getDoc(id)
        let ext = mime.contains("pdf") ? "pdf" : mime.contains("png") ? "png" : mime.contains("heic") ? "heic" : mime.contains("image") ? "jpg" : "pdf"
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent((safe.isEmpty ? "Document" : safe) + "." + ext)
        try data.write(to: url, options: .atomic)
        return url
    }

    static func err(_ msg: String) -> NSError { NSError(domain: "HGVCBinder", code: 1, userInfo: [NSLocalizedDescriptionKey: msg]) }
}
