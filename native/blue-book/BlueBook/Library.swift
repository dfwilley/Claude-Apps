import Foundation
import UIKit

/// Where Blue Book keeps your logbook: the app's own Documents folder on this iPhone (included in your iPhone backup).
/// Documents/BlueBook/bluebook.json  — every page, flight and setting
/// Documents/BlueBook/bluebook.previous.json — the version before the last save, just in case
/// Documents/BlueBook/photos/<id>.jpg — the straightened logbook page photos
enum Library {
    static var root: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = docs.appendingPathComponent("BlueBook", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir.appendingPathComponent("photos"), withIntermediateDirectories: true)
        return dir
    }
    static var dbURL: URL { root.appendingPathComponent("bluebook.json") }
    static var previousURL: URL { root.appendingPathComponent("bluebook.previous.json") }

    /// Photo ids come from the app's screens; only letters, digits, - and _ are allowed so a name can't point outside the folder.
    static func isSafeId(_ id: String) -> Bool {
        !id.isEmpty && id.count < 80 && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } && id.unicodeScalars.allSatisfy { $0.isASCII }
    }
    static func photoURL(_ id: String) -> URL? {
        guard isSafeId(id) else { return nil }
        return root.appendingPathComponent("photos").appendingPathComponent(id + ".jpg")
    }

    static func readDB() -> String? { try? String(contentsOf: dbURL, encoding: .utf8) }

    static func writeDB(_ json: String) throws {
        let fm = FileManager.default
        if fm.fileExists(atPath: dbURL.path) {
            try? fm.removeItem(at: previousURL)
            try? fm.copyItem(at: dbURL, to: previousURL)
        }
        try json.data(using: .utf8)!.write(to: dbURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func putPhoto(_ id: String, data: Data) throws {
        guard let url = photoURL(id) else { throw NSError(domain: "BlueBook", code: 1, userInfo: [NSLocalizedDescriptionKey: "Bad photo name"]) }
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func deletePhoto(_ id: String) {
        if let url = photoURL(id) { try? FileManager.default.removeItem(at: url) }
    }

    /// Saves a scanned page: no bigger than 2600 pixels on the long side, JPEG.
    static func savePage(_ image: UIImage) throws -> String {
        let id = "pg-" + UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(14)
        let img = image.resized(maxSide: 2600)
        guard let data = img.jpegData(compressionQuality: 0.88) else { throw NSError(domain: "BlueBook", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not save the photo"]) }
        try putPhoto(String(id), data: data)
        return String(id)
    }
}

extension UIImage {
    func resized(maxSide: CGFloat) -> UIImage {
        let longSide = max(size.width, size.height)
        guard longSide > maxSide else { return normalizedUp() }
        let s = maxSide / longSide
        let newSize = CGSize(width: (size.width * s).rounded(), height: (size.height * s).rounded())
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
    /// Bakes the rotation into the pixels so every reader sees the page upright.
    func normalizedUp() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in draw(in: CGRect(origin: .zero, size: size)) }
    }
}
