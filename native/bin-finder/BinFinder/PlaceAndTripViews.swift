import SwiftUI

/// One place (like "Hangar" or "Hangar › Shelf 2"): the places inside it and the bins right there.
struct PlaceView: View {
    @EnvironmentObject private var store: BinStore
    @EnvironmentObject private var router: Router
    let place: String

    @State private var newBin: Bin?
    @State private var renaming = false
    @State private var newName = ""
    @State private var share: ShareItem?
    @State private var message: String?

    private var parts: [String] { BinPlaces.parts(place) }
    private var name: String { parts.last ?? place }
    private var inside: [Bin] { store.bins.filter { BinPlaces.isUnder($0.location, place) } }
    private var here: [Bin] {
        inside.filter { BinPlaces.parts($0.location).count == parts.count }
            .sorted { $0.code.localizedStandardCompare($1.code) == .orderedAscending }
    }
    private var kids: [BinPlaces.Child] { BinPlaces.children(of: place, in: store.bins) }

    var body: some View {
        List {
            if parts.count > 1 {
                Section { Text(BinPlaces.tidy(place)).font(.subheadline).foregroundStyle(.secondary) }
            }
            if !kids.isEmpty {
                Section("Places inside · \(kids.count)") {
                    ForEach(kids, id: \.self) { k in
                        NavigationLink(value: Route.place(k.place)) {
                            HStack {
                                Label(k.name, systemImage: "folder")
                                Spacer()
                                Text(k.count == 1 ? "1 bin" : "\(k.count) bins").foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            if !here.isEmpty || kids.isEmpty {
                Section(kids.isEmpty ? "Bins · \(here.count)" : "Right here · \(here.count)") {
                    if here.isEmpty { Text("No bins here yet.").foregroundStyle(.secondary) }
                    ForEach(here) { b in NavigationLink(value: Route.bin(b.id)) { BinRow(bin: b, under: place) } }
                }
            }
            Section {
                Button { newBin = Bin(location: BinPlaces.tidy(place)) } label: { Label("New bin here", systemImage: "plus.circle") }
                Button { printLabels() } label: { Label("Print labels for everything in \(name) · \(inside.count)", systemImage: "qrcode") }
                Button { newName = BinPlaces.parts(place).joined(separator: " / "); renaming = true } label: {
                    Label("Rename or move this place", systemImage: "pencil")
                }
            } footer: {
                Text("Renaming changes the location of every bin inside. To put it inside another place, type that place first, like RV / \(name).")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $newBin) { b in BinEditView(bin: b, isNew: true) { saved in router.path.append(.bin(saved.id)) } }
        .sheet(item: $share) { ActivityView(items: [$0.url]) }
        .alert("Rename “\(name)”", isPresented: $renaming) {
            TextField("Place, like Hangar / Shelf 2", text: $newName)
            Button("Cancel", role: .cancel) {}
            Button("Rename") { rename() }
        } message: {
            Text("Use / for a place inside a place.")
        }
        .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) {}
        }
    }

    private func printLabels() {
        let bins = inside.sorted { $0.code.localizedStandardCompare($1.code) == .orderedAscending }
        do { share = ShareItem(url: try Labels.pdfFile(for: bins, name: "Bin Labels - \(parts.joined(separator: " - "))")) }
        catch { message = "Couldn't make the labels: \(error.localizedDescription)" }
    }

    private func rename() {
        let to = BinPlaces.tidy(newName)
        guard !to.isEmpty else { message = "A place needs a name."; return }
        guard to != BinPlaces.tidy(place) else { return }
        store.renamePlace(place, to: to)
        // Show the place under its new name.
        if let i = router.path.lastIndex(of: .place(place)) { router.path[i] = .place(to) }
    }
}

/// Packing checklist for an RV trip: check off each thing as it goes in the rig.
struct TripView: View {
    @EnvironmentObject private var store: BinStore
    @AppStorage("hidePacked") private var hidePacked = false
    @State private var choosing = false
    @State private var confirmReset = false

    private var groups: [(String, [Bin])] {
        let d = Dictionary(grouping: store.tripBins) { b -> String in let t = BinPlaces.top(b.location); return t.isEmpty ? "No location" : t }
        return d.keys.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }.map { ($0, d[$0]!.sorted(by: Bin.byPlaceThenCode)) }
    }

    var body: some View {
        let p = TripList.progress(store.bins, checked: store.tripChecked)
        return Group {
            if store.tripBins.isEmpty {
                VStack(spacing: 14) {
                    Spacer()
                    Image(systemName: "suitcase").font(.system(size: 56)).foregroundStyle(.tint)
                    Text("Nothing on the trip list yet.").font(.title3.bold())
                    Text("Choose the bins that go along on RV trips. Before each trip, check things off as they go in the rig.")
                        .multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.horizontal, 32)
                    Button { choosing = true } label: { Text("Choose bins").font(.headline).padding(.horizontal, 12).padding(.vertical, 6) }
                        .buttonStyle(.borderedProminent)
                    Spacer(); Spacer()
                }
            } else {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(p.done == p.total ? "All packed. Have a good trip!" : "\(p.done) of \(p.total) packed").font(.headline)
                                Spacer()
                                Text(store.tripBins.count == 1 ? "1 bin" : "\(store.tripBins.count) bins").foregroundStyle(.secondary)
                            }
                            ProgressView(value: Double(p.done), total: Double(max(p.total, 1)))
                        }
                        .padding(.vertical, 4)
                        Toggle("Hide what's packed", isOn: $hidePacked)
                    }
                    ForEach(groups, id: \.0) { place, bins in
                        let visible = bins.filter { !hidePacked || !allChecked($0) }
                        if !visible.isEmpty {
                            Section(place) {
                                ForEach(visible) { b in binRows(b, under: place) }
                            }
                        }
                    }
                    Section {
                        Button(role: .destructive) { confirmReset = true } label: { Label("Start a new trip (uncheck everything)", systemImage: "arrow.counterclockwise") }
                    } footer: {
                        Text("Check marks stay until you start a new trip. Tap Choose to add or remove bins.")
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Trip checklist")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) { Button("Choose") { choosing = true } } }
        .sheet(isPresented: $choosing) { TripChooseView() }
        .confirmationDialog("Uncheck everything and start a new trip?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Start a new trip", role: .destructive) { store.startNewTrip() }
        }
    }

    private func allChecked(_ b: Bin) -> Bool { TripList.keys(b).allSatisfy { store.tripChecked.contains($0) } }

    @ViewBuilder
    private func binRows(_ b: Bin, under place: String) -> some View {
        let keys = TripList.keys(b)
        let done = keys.filter { store.tripChecked.contains($0) }.count
        let sub = [b.code, BinPlaces.below(b.location, place)].filter { !$0.isEmpty }.joined(separator: " · ")
        CheckRow(checked: done == keys.count, bold: true,
                 title: b.displayName,
                 subtitle: b.items.isEmpty ? sub : "\(sub) · \(done) of \(keys.count)") {
            store.setChecked(keys, done != keys.count)
        }
        ForEach(b.items, id: \.self) { item in
            let k = "\(b.id.uuidString)|\(item)"
            if !(hidePacked && store.tripChecked.contains(k)) {
                CheckRow(checked: store.tripChecked.contains(k), bold: false, title: item, subtitle: nil) {
                    store.setChecked([k], !store.tripChecked.contains(k))
                }
                .padding(.leading, 28)
            }
        }
    }
}

struct CheckRow: View {
    let checked: Bool
    let bold: Bool
    let title: String
    let subtitle: String?
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 12) {
                Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                    .font(.title2).foregroundStyle(checked ? Color.accentColor : Color.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(bold ? .headline : .body)
                        .strikethrough(checked && !bold).foregroundStyle(checked && !bold ? Color.secondary : Color.primary)
                    if let subtitle, !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(checked ? .isSelected : [])
        .accessibilityHint(checked ? "Packed. Double-tap to uncheck." : "Double-tap when it's packed.")
    }
}

/// Turn bins on or off the trip checklist.
struct TripChooseView: View {
    @EnvironmentObject private var store: BinStore
    @Environment(\.dismiss) private var dismiss

    private var groups: [(String, [Bin])] {
        let d = Dictionary(grouping: store.bins) { b -> String in let t = BinPlaces.top(b.location); return t.isEmpty ? ContentView.noLocation : t }
        return d.keys.sorted { a, b in
            if a == ContentView.noLocation { return false }
            if b == ContentView.noLocation { return true }
            return a.localizedCaseInsensitiveCompare(b) == .orderedAscending
        }.map { ($0, d[$0]!.sorted(by: Bin.byPlaceThenCode)) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Turn on each bin that gets loaded for a trip. Bins that live in the RV can stay off, or turn them on to check they're stocked.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(groups, id: \.0) { place, bins in
                    Section(place) {
                        ForEach(bins) { b in
                            Toggle(isOn: Binding(get: { store.bin(b.id)?.trip ?? false }, set: { store.setTrip($0, for: b.id) })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(b.displayName)
                                    Text([b.code, BinPlaces.below(b.location, place)].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Bins that go on trips")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.fontWeight(.semibold) } }
        }
    }
}
