import SwiftUI
import Security

/// The optional key for Scan with AI, kept in the iPhone's Keychain (its locked store for passwords). Never put in backups.
enum AIKey {
    private static let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                              kSecAttrService as String: "BinFinder.ai-key",
                                              kSecAttrAccount as String: "anthropic"]

    static func load() -> String {
        var q = base
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return "" }
        return String(data: d, encoding: .utf8) ?? ""
    }

    /// Saves the key; an empty key removes it. Returns false if the phone wouldn't store it.
    @discardableResult
    static func save(_ key: String) -> Bool {
        SecItemDelete(base as CFDictionary)
        guard !key.isEmpty else { return true }
        var q = base
        q[kSecValueData as String] = Data(key.utf8)
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }
}

/// Sends one photo to Anthropic's Claude service and returns the things it names. Used only when Scan with AI is tapped.
enum AIScanner {
    static let model = "claude-haiku-5-5"

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func scan(jpeg: Data, key: String) async throws -> [String] {
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        let source: [String: Any] = ["type": "base64", "media_type": "image/jpeg", "data": jpeg.base64EncodedString()]
        let image: [String: Any] = ["type": "image", "source": source]
        let text: [String: Any] = ["type": "text", "text": BinScan.prompt]
        let message: [String: Any] = ["role": "user", "content": [image, text]]
        let body: [String: Any] = ["model": model, "max_tokens": 1024, "messages": [message]]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: req) }
        catch { throw Failure(message: "Couldn't reach the AI service. Check the internet connection.") }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if status == 401 { throw Failure(message: "Anthropic didn't accept the key. Check it under AI scanning in the ⋯ menu.") }
        if status == 429 || status == 529 { throw Failure(message: "The AI service is busy or over its limit. Try again in a minute.") }
        guard (200..<300).contains(status) else {
            let detail = (json?["error"] as? [String: Any])?["message"] as? String
            throw Failure(message: detail ?? "The AI service answered with error \(status).")
        }
        let parts = (json?["content"] as? [[String: Any]]) ?? []
        let answer = parts.filter { ($0["type"] as? String) == "text" }.compactMap { $0["text"] as? String }.joined(separator: "\n")
        return BinScan.parseAnswer(answer)
    }
}

/// Scan a bin's photos: a checklist of what was found, to add to What's inside.
struct ScanView: View {
    @EnvironmentObject private var store: BinStore
    @Environment(\.dismiss) private var dismiss
    let binID: UUID

    struct Row: Identifiable {
        let id = UUID()
        let text: String
        let ai: Bool
        var on: Bool
    }

    @State private var rows: [Row] = []
    @State private var busy = ""
    @State private var looking = false
    @State private var note = ""
    @State private var key = AIKey.load()
    @State private var showKey = false
    @State private var started = false

    private var photos: [String] { store.bin(binID)?.photos ?? [] }
    private var photoCount: String { photos.count == 1 ? "1 photo" : "\(photos.count) photos" }
    private var ticked: Int { rows.filter(\.on).count }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if key.isEmpty {
                        Button { showKey = true } label: { Label("Set up Scan with AI", systemImage: "sparkles") }
                    } else {
                        Button { Task { await scanWithAI() } } label: {
                            Label(busy.isEmpty ? "Scan with AI · \(photoCount)" : busy, systemImage: "sparkles")
                        }
                        .disabled(!busy.isEmpty || photos.isEmpty)
                        .accessibilityIdentifier("scanWithAI")
                    }
                } footer: {
                    Text(key.isEmpty
                         ? "AI can name the things in your photos. It needs your own key and sends the photos over the internet. Without it, this screen lists what the phone itself can recognise: printed words and general kinds of things."
                         : "Sends this bin's photos over the internet to Anthropic's Claude service to name what's in them. Well under a cent a photo.")
                }
                if !note.isEmpty {
                    Section { Text(note).foregroundStyle(.secondary) }
                }
                Section {
                    if rows.isEmpty {
                        Text(looking ? "Looking at the photos…" : "Nothing found yet.").foregroundStyle(.secondary)
                    }
                    ForEach($rows) { $row in
                        Button { row.on.toggle() } label: {
                            HStack(spacing: 12) {
                                Image(systemName: row.on ? "checkmark.circle.fill" : "circle").font(.title3)
                                Text(row.text).foregroundStyle(Color.primary)
                                Spacer()
                                Text(row.ai ? "AI" : "on phone").font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityLabel("\(row.text), \(row.on ? "ticked" : "not ticked")")
                    }
                } header: {
                    Text("Found · \(rows.count)")
                } footer: {
                    Text("Tick the ones that are right, then add them to What's inside.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Scan photos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(ticked == 0 ? "Add" : "Add \(ticked)", action: addTicked).fontWeight(.semibold).disabled(ticked == 0)
                }
            }
            .sheet(isPresented: $showKey, onDismiss: { key = AIKey.load() }) { AIKeyView() }
            .task { await scanOnPhone() }
        }
    }

    /// Adds newly found things to the checklist, leaving out repeats and anything already in the bin.
    private func merge(_ found: [String], ai: Bool) -> Int {
        let fresh = BinScan.found(found, items: store.bin(binID)?.items ?? [])
        let keys = Set(fresh.map(BinSearch.normalize))
        if ai {
            rows = fresh.map { Row(text: $0, ai: true, on: true) } + rows.filter { !keys.contains(BinSearch.normalize($0.text)) }
            return fresh.count
        }
        let have = Set(rows.map { BinSearch.normalize($0.text) })
        let new = fresh.filter { !have.contains(BinSearch.normalize($0)) }
        rows += new.map { Row(text: $0, ai: false, on: false) }
        return new.count
    }

    /// What the phone itself can tell: kinds of things it recognises, then the printed words it has read.
    @MainActor
    private func scanOnPhone() async {
        guard !started, let bin = store.bin(binID) else { return }
        started = true; looking = true
        var kinds: [String] = []
        for name in bin.photos {
            if let img = store.image(name) { kinds += await PhotoAnalyzer.objects(in: img) }
        }
        _ = merge(kinds, ai: false)
        _ = merge(bin.autoWords, ai: false)
        looking = false
    }

    @MainActor
    private func scanWithAI() async {
        note = ""
        var found: [String] = []
        let names = photos
        do {
            for (i, name) in names.enumerated() {
                busy = "Asking AI… photo \(i + 1) of \(names.count)"
                guard let data = try? Data(contentsOf: store.photoURL(name)) else { continue }
                found += try await AIScanner.scan(jpeg: data, key: key)
            }
        } catch {
            note = error.localizedDescription
        }
        let added = merge(found, ai: true)
        if note.isEmpty && added == 0 { note = "AI didn't find anything new in the photos." }
        busy = ""
    }

    private func addTicked() {
        for row in rows where row.on { store.addItem(row.text, to: binID) }
        dismiss()
    }
}

/// Where the optional AI key is typed in or removed. Opened from the ⋯ menu and from the Scan photos screen.
struct AIKeyView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var saved = AIKey.load()
    @State private var typed = ""
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if saved.isEmpty {
                        SecureField("Anthropic API key (starts with sk-ant-)", text: $typed)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Save the key") {
                            let k = typed.trimmingCharacters(in: .whitespacesAndNewlines)
                            if AIKey.save(k) { saved = k; typed = "" } else { message = "The phone couldn't store the key." }
                        }
                        .disabled(typed.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    } else {
                        LabeledContent("Key saved", value: "ends in \(saved.suffix(4))")
                        Button("Remove the key", role: .destructive) { AIKey.save(""); saved = "" }
                    }
                } footer: {
                    Text("With a key, a bin's Scan photos screen gets a Scan with AI button. Tapping it sends that bin's photos over the internet to Anthropic's Claude service, which names the things in them. Nothing is sent unless you tap it. Anthropic bills your account, well under a cent a photo. The key is kept only on this phone and is not put in backups.")
                }
            }
            .navigationTitle("AI scanning (optional)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK", role: .cancel) {}
            }
        }
    }
}
