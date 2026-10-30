import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject private var store: BinStore
    @EnvironmentObject private var router: Router
    @State private var query = ""
    @State private var newBin: Bin?
    @State private var share: ShareItem?
    @State private var importing = false
    @State private var message: String?

    var body: some View {
        NavigationStack(path: $router.path) {
            Group {
                if store.bins.isEmpty { EmptyStart(add: addBin) }
                else if query.trimmed.isEmpty { browseList }
                else { resultsList }
            }
            .navigationTitle("Bin Finder")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Find something, like spare fuses")
            .autocorrectionDisabled()
            .navigationDestination(for: UUID.self) { BinDetailView(binID: $0) }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { menu }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: addBin) { Label("New bin", systemImage: "plus.circle.fill").font(.title3) }
                        .accessibilityIdentifier("addBin")
                }
            }
        }
        .sheet(item: $newBin) { b in BinEditView(bin: b, isNew: true) { saved in router.path = [saved.id] } }
        .sheet(item: $share) { ActivityView(items: [$0.url]) }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let ok = url.startAccessingSecurityScopedResource()
                defer { if ok { url.stopAccessingSecurityScopedResource() } }
                let n = try store.restore(from: url)
                message = n == 0 ? "Nothing new in that backup." : "Restored \(n) \(n == 1 ? "bin" : "bins")."
            } catch { message = "Couldn't restore: \(error.localizedDescription)" }
        }
        .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) {}
        }
    }

    private func addBin() { newBin = Bin() }

    // MARK: Menu

    private var menu: some View {
        Menu {
            Section("Print QR labels (Avery 5163, 4 × 2 in)") {
                Button { shareLabels(store.bins, name: "Bin Labels - All") } label: { Label("All bins", systemImage: "qrcode") }
                ForEach(store.locations, id: \.self) { loc in
                    Button { shareLabels(store.bins.filter { $0.location.trimmed == loc }, name: "Bin Labels - \(loc)") } label: { Text(loc) }
                }
            }
            Section("Backup") {
                Button { backup() } label: { Label("Back up everything", systemImage: "square.and.arrow.up") }
                Button { importing = true } label: { Label("Restore from a backup", systemImage: "square.and.arrow.down") }
            }
        } label: { Image(systemName: "ellipsis.circle").font(.title3) }
        .accessibilityLabel("More")
        .disabled(store.bins.isEmpty)
    }

    private func shareLabels(_ bins: [Bin], name: String) {
        let sorted = bins.sorted { $0.code.localizedStandardCompare($1.code) == .orderedAscending }
        do { share = ShareItem(url: try Labels.pdfFile(for: sorted, name: name)) }
        catch { message = "Couldn't make the labels: \(error.localizedDescription)" }
    }

    private func backup() {
        do { share = ShareItem(url: try store.makeBackup()) }
        catch { message = "Backup failed: \(error.localizedDescription)" }
    }

    // MARK: Lists

    private var grouped: [(String, [Bin])] {
        let d = Dictionary(grouping: store.bins) { $0.location.trimmed.isEmpty ? "No location" : $0.location.trimmed }
        return d.keys.sorted { a, b in
            if a == "No location" { return false }
            if b == "No location" { return true }
            return a.localizedCaseInsensitiveCompare(b) == .orderedAscending
        }.map { ($0, d[$0]!.sorted { $0.code.localizedStandardCompare($1.code) == .orderedAscending }) }
    }

    private var browseList: some View {
        List {
            ForEach(grouped, id: \.0) { loc, bins in
                Section {
                    ForEach(bins) { b in NavigationLink(value: b.id) { BinRow(bin: b) } }
                } header: {
                    Text("\(loc) · \(bins.count)")
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var resultsList: some View {
        let hits = store.search(query)
        return List {
            if hits.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Nothing found for “\(query.trimmed)”").font(.headline)
                    Text("Try a simpler word, like “fuse” or “drill”. Search looks at bin names, items, labels, locations, notes and words the phone read in your photos.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            } else {
                Section {
                    ForEach(hits) { h in NavigationLink(value: h.bin.id) { BinRow(bin: h.bin, reasons: h.reasons) } }
                } header: {
                    Text(hits.count == 1 ? "1 bin" : "\(hits.count) bins")
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct EmptyStart: View {
    let add: () -> Void
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "shippingbox.and.arrow.backward").font(.system(size: 64)).foregroundStyle(.tint)
            Text("Photograph each bin once.").font(.title2.bold())
            Text("Take a picture of what's inside each bin, shelf or RV compartment and list a few things. Later, just type what you're looking for.")
                .multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.horizontal, 32)
            Button(action: add) { Label("Add your first bin", systemImage: "plus").font(.headline).padding(.horizontal, 12).padding(.vertical, 6) }
                .buttonStyle(.borderedProminent)
            Spacer(); Spacer()
        }
    }
}

struct BinRow: View {
    @EnvironmentObject private var store: BinStore
    let bin: Bin
    var reasons: [String] = []

    var body: some View {
        HStack(spacing: 12) {
            Thumb(name: bin.photos.first, side: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text(bin.displayName).font(.headline).lineLimit(2)
                Text([bin.code, bin.location.trimmed].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                if !reasons.isEmpty {
                    Text(reasons.joined(separator: " · ")).font(.footnote.weight(.medium)).foregroundStyle(.tint).lineLimit(2)
                } else if !bin.items.isEmpty {
                    Text(bin.items.joined(separator: ", ")).font(.footnote).foregroundStyle(.secondary).lineLimit(2)
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

struct Thumb: View {
    @EnvironmentObject private var store: BinStore
    let name: String?
    var side: CGFloat = 64

    var body: some View {
        Group {
            if let name, let img = store.thumbnail(name) {
                Image(uiImage: img).resizable().scaledToFill()
            } else {
                ZStack { Color(.secondarySystemFill); Image(systemName: "shippingbox").font(.title2).foregroundStyle(.secondary) }
            }
        }
        .frame(width: side, height: side)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHidden(true)
    }
}

struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}
