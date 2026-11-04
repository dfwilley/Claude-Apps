import Foundation
import LocalAuthentication
import Security

/// Full contract and member numbers live only in this iPhone's Keychain, and only show after Face ID (or your passcode).
/// They are never written to the binder file, the Dropbox data file, or GitHub.
enum Vault {
    static let service = "com.dfwilley.hgvcbinder.numbers"

    /// Asks for Face ID, falling back to the iPhone passcode.
    static func unlock(reason: String, done: @escaping (Result<Void, Error>) -> Void) {
        let ctx = LAContext()
        ctx.localizedCancelTitle = "Cancel"
        var e: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &e) else {
            return done(.failure(Library.err("Set a passcode on this iPhone to lock your numbers.")))
        }
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, error in
            DispatchQueue.main.async {
                if ok { done(.success(())) }
                else if let le = error as? LAError, [.userCancel, .appCancel, .systemCancel].contains(le.code) { done(.failure(Library.err("cancelled"))) }
                else { done(.failure(error ?? Library.err("Couldn't confirm it's you."))) }
            }
        }
    }

    static func isSafeKey(_ key: String) -> Bool {
        !key.isEmpty && key.count < 120 && key.unicodeScalars.allSatisfy { $0.isASCII } && key.allSatisfy { $0.isLetter || $0.isNumber || "-_.".contains($0) }
    }

    static func get(_ key: String) -> String? {
        guard isSafeKey(key) else { return nil }
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key,
                                kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String) throws {
        guard isSafeKey(key) else { throw Library.err("Bad key") }
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        if value.isEmpty { return }
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let s = SecItemAdd(add as CFDictionary, nil)
        guard s == errSecSuccess else { throw Library.err("Couldn't save to the Keychain (\(s)).") }
    }
}
