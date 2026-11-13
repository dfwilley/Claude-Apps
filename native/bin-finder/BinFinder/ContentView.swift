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
    @State private var listening = false
    @State private var showAbout = false
    /// The place chosen in the Location pull-downs ("" = all locations).
    @State private var homePlace = ""

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
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .bin(let id): BinDetailView(binID: id)
                case .place(let p): PlaceView(place: p)
                case .trip: TripView()
                case .items: AllItemsView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) { menu }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { listening = true } label: { Label("Search by voice", systemImage: "mic.fill").font(.title3) }
                        .accessibilityIdentifier("voiceSearch")
                        .disabled(store.bins.isEmpty)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: addBin) { Label("New bin or box", systemImage: "plus.circle.fill").font(.title3) }
                        .accessibilityIdentifier("addBin")
                }
            }
        }
        .sheet(item: $newBin) { b in BinEditView(bin: b, isNew: true) { saved in router.path = [.bin(saved.id)] } }
        .sheet(isPresented: $listening) {
            VoiceSearchSheet { heard in query = heard }
                .presentationDetents([.height(260)])
        }
        .sheet(item: $share) { ActivityView(items: [$0.url]) }
        .sheet(isPresented: $showAbout) { AboutView() }
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
                    Button { shareLabels(store.bins.filter { BinPlaces.isUnder($0.location, loc) }, name: "Bin Labels - \(loc.replacingOccurrences(of: " › ", with: " - "))") } label: { Text(loc) }
                }
            }
            Section("Backup") {
                Button { backup() } label: { Label("Back up everything", systemImage: "square.and.arrow.up") }
                Button { importing = true } label: { Label("Restore from a backup", systemImage: "square.and.arrow.down") }
            }
            Section {
                Button { showAbout = true } label: { Label("About Bin Finder", systemImage: "info.circle") }
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

    static let noLocation = "No location"
    /// Pull-down value for bins that have no location.
    static let noPlace = "\u{1}none"
    private var chosen: String { homePlace }

    private static func count(_ n: Int) -> String { n == 1 ? "1 bin" : "\(n) bins" }

    /// One group of bins on the main list. The heading opens that place (rename, labels, new bin here).
    private struct BinGroup: Identifiable { let title: String; let place: String; let bins: [Bin]; var id: String { title + "|" + place } }

    /// Nothing chosen: every bin, by top place. A place chosen: the places inside it, then the bins right there.
    private func groups(place: String, none: Bool, noLoc: [Bin]) -> [BinGroup] {
        func under(_ p: String) -> [Bin] { store.bins.filter { BinPlaces.isUnder($0.location, p) }.sorted(by: Bin.byName) }
        let loose = BinGroup(title: Self.noLocation, place: "", bins: noLoc.sorted(by: Bin.byName))
        if none { return [loose] }
        var out = BinPlaces.children(of: place, in: store.bins).map { BinGroup(title: $0.name, place: $0.place, bins: under($0.place)) }
        if place.isEmpty { return noLoc.isEmpty ? out : out + [loose] }
        let depth = BinPlaces.parts(place).count, name = BinPlaces.parts(place).last ?? place
        let here = under(place).filter { BinPlaces.parts($0.location).count == depth }
        if !here.isEmpty || out.isEmpty { out.append(BinGroup(title: out.isEmpty ? name : "Right in \(name)", place: place, bins: here)) }
        return out
    }

    private var browseList: some View {
        let trip = TripList.progress(store.bins, checked: store.tripChecked)
        let noLoc = store.bins.filter { BinPlaces.top($0.location).isEmpty }
        let none = chosen == Self.noPlace && !noLoc.isEmpty
        let place = chosen == Self.noPlace ? "" : BinPlaces.nearest(chosen, in: store.bins)
        let levels = BinPlaces.levels(for: place, in: store.bins)
        return List {
            Section {
                NavigationLink(value: Route.trip) {
                    HStack {
                        Label("Trip checklist", systemImage: "suitcase.fill")
                        Spacer()
                        Text(trip.total == 0 ? "Set up" : "\(trip.done) of \(trip.total) packed").foregroundStyle(.secondary)
                    }
                }
                .accessibilityIdentifier("tripChecklist")
                NavigationLink(value: Route.items) {
                    HStack {
                        Label("All items", systemImage: "list.bullet")
                        Spacer()
                        Text("\(store.bins.reduce(0) { $0 + $1.items.count })").foregroundStyle(.secondary)
                    }
                }
                .accessibilityIdentifier("allItems")
            }
            if !levels.isEmpty {
                Section {
                    ForEach(Array(levels.enumerated()), id: \.offset) { i, level in
                        Picker(i == 0 ? "Location" : "Inside \(level.name)", selection: Binding(
                            get: { i == 0 && none ? Self.noPlace : level.selected },
                            set: { homePlace = $0.isEmpty ? level.parent : $0 })) {
                            Text(i == 0 ? "All locations" : "Everything in \(level.name)").tag("")
                            ForEach(level.choices, id: \.self) { c in Text("\(c.name) · \(Self.count(c.count))").tag(c.place) }
                            if i == 0 && !noLoc.isEmpty { Text("\(Self.noLocation) · \(Self.count(noLoc.count))").tag(Self.noPlace) }
                        }
                        .pickerStyle(.menu)
                        .accessibilityIdentifier("placePicker\(i)")
                    }
                }
            }
            ForEach(groups(place: place, none: none, noLoc: noLoc)) { g in
                Section {
                    ForEach(g.bins) { b in NavigationLink(value: Route.bin(b.id)) { BinRow(bin: b, under: g.place.isEmpty ? nil : g.place) } }
                } header: {
                    if g.place.isEmpty {
                        Text("\(g.title) · \(g.bins.count)")
                    } else {
                        Button { router.path.append(.place(g.place)) } label: {
                            HStack(spacing: 4) { Text("\(g.title) · \(g.bins.count)"); Image(systemName: "chevron.right").font(.caption2.weight(.bold)) }
                        }
                        .accessibilityHint("Opens \(g.title): rename it, print its labels or add a bin there")
                    }
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
                    ForEach(hits) { h in NavigationLink(value: Route.bin(h.bin.id)) { BinRow(bin: h.bin, reasons: h.reasons) } }
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
            Button(action: add) { Label("Add your first bin or box", systemImage: "plus").font(.headline).padding(.horizontal, 12).padding(.vertical, 6) }
                .buttonStyle(.borderedProminent)
            Spacer(); Spacer()
        }
    }
}

struct BinRow: View {
    @EnvironmentObject private var store: BinStore
    let bin: Bin
    var reasons: [String] = []
    /// When listed under a place, show only the part of the location below it.
    var under: String? = nil

    var body: some View {
        HStack(spacing: 12) {
            Thumb(name: bin.photos.first, side: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text(bin.displayName).font(.headline).lineLimit(2)
                Text([bin.kindWord, bin.code, under.map { BinPlaces.below(bin.location, $0) } ?? BinPlaces.tidy(bin.location),
                      reasons.isEmpty ? (store.holder(of: bin).map { "in \($0.displayName)" } ?? "") : ""].filter { !$0.isEmpty }.joined(separator: " · "))
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

extension Bin {
    /// A to Z by name, with Shelf 2 before Shelf 10.
    static func byName(_ a: Bin, _ b: Bin) -> Bool {
        let c = a.displayName.compare(b.displayName, options: [.caseInsensitive, .diacriticInsensitive, .numeric])
        return c != .orderedSame ? c == .orderedAscending : a.code.localizedStandardCompare(b.code) == .orderedAscending
    }
    static func byPlaceThenCode(_ a: Bin, _ b: Bin) -> Bool {
        let pa = BinPlaces.tidy(a.location), pb = BinPlaces.tidy(b.location)
        if pa.localizedCaseInsensitiveCompare(pb) != .orderedSame { return pa.localizedStandardCompare(pb) == .orderedAscending }
        return a.code.localizedStandardCompare(b.code) == .orderedAscending
    }
}
