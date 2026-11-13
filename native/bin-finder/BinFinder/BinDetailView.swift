import SwiftUI
import PhotosUI

struct BinDetailView: View {
    @EnvironmentObject private var store: BinStore
    @EnvironmentObject private var router: Router
    let binID: UUID

    @State private var newItem = ""
    @State private var editing: Bin?
    @State private var showLabel = false
    @State private var confirmDelete = false
    @State private var viewing: PhotoRef?
    @State private var showCamera = false
    @State private var picked: [PhotosPickerItem] = []
    @FocusState private var itemFocused: Bool

    var body: some View {
        if let bin = store.bin(binID) {
            content(bin)
        } else {
            Text("This bin or box was deleted.").foregroundStyle(.secondary)
        }
    }

    private func content(_ bin: Bin) -> some View {
        List {
            // Photos
            Section {
                if bin.photos.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "camera").font(.largeTitle).foregroundStyle(.secondary)
                        Text("No photos yet. Take one of what's inside.").foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
                } else {
                    TabView {
                        ForEach(bin.photos, id: \.self) { name in
                            PhotoTile(name: name)
                                .onTapGesture { viewing = PhotoRef(name: name) }
                                .accessibilityAddTraits(.isButton)
                                .accessibilityLabel("Photo. Double-tap to view full screen.")
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: bin.photos.count > 1 ? .always : .never))
                    .frame(height: 280)
                    .listRowInsets(EdgeInsets())
                }
                HStack {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { showCamera = true } label: { Label("Take photo", systemImage: "camera.fill") }
                            .buttonStyle(.borderless)
                        Spacer()
                    }
                    PhotosPicker(selection: $picked, maxSelectionCount: 6, matching: .images) {
                        Label("Add from Photos", systemImage: "photo.on.rectangle")
                    }
                    .buttonStyle(.borderless)
                    if !UIImagePickerController.isSourceTypeAvailable(.camera) { Spacer() }
                }
                .font(.body.weight(.semibold))
            }

            // Label line
            Section {
                LabeledContent("Container", value: bin.kindLabel)
                LabeledContent("Label", value: bin.code)
                if bin.location.trimmed.isEmpty {
                    LabeledContent("Location", value: "None")
                } else {
                    NavigationLink(value: Route.place(bin.location)) { LabeledContent("Location", value: BinPlaces.tidy(bin.location)) }
                }
                if let holder = store.holder(of: bin) {
                    NavigationLink(value: Route.bin(holder.id)) { LabeledContent("Inside", value: holder.displayName) }
                        .accessibilityIdentifier("insideHolder")
                }
                Toggle("Pack for trips", isOn: Binding(get: { store.bin(binID)?.trip ?? false }, set: { store.setTrip($0, for: binID) }))
                    .accessibilityIdentifier("packForTrips")
            } footer: {
                Text("“Pack for trips” puts this bin on the trip checklist.")
            }

            // Items
            let kids = store.held(by: bin)
            let canAdd = store.canGoInside(bin)
            Section {
                ForEach(kids) { k in
                    NavigationLink(value: Route.bin(k.id)) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(k.displayName)
                                Text([k.kindWord, k.code, k.items.count == 1 ? "1 item" : "\(k.items.count) items"].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "shippingbox.fill") }
                    }
                    .swipeActions(edge: .trailing) {
                        Button("Take out") { store.put(k.id, inside: nil) }.tint(.orange)
                    }
                }
                ForEach(Array(bin.items.enumerated()), id: \.offset) { _, item in Text(item) }
                    .onDelete { store.removeItems(at: $0, from: binID) }
                HStack {
                    TextField("Add an item", text: $newItem)
                        .focused($itemFocused)
                        .submitLabel(.done)
                        .onSubmit(addItem)
                        .accessibilityIdentifier("newItem")
                    Button(action: addItem) { Image(systemName: "plus.circle.fill").font(.title2) }
                        .buttonStyle(.borderless)
                        .disabled(newItem.trimmed.isEmpty)
                        .accessibilityLabel("Add item")
                }
                if !canAdd.isEmpty {
                    Menu {
                        ForEach(canAdd) { c in
                            Button { store.put(c.id, inside: binID) } label: {
                                Text([c.displayName, c.code].joined(separator: " · ") + (store.holder(of: c).map { " (now in \($0.displayName))" } ?? ""))
                            }
                        }
                    } label: { Label("Add a saved bin or box", systemImage: "shippingbox") }
                    .accessibilityIdentifier("addSavedBin")
                }
            } header: {
                Text("What's inside · \(kids.count + bin.items.count)")
            } footer: {
                Text(kids.isEmpty ? "Swipe left on an item to remove it." : "Tap a bin or box to open it. Swipe left to take it out (it isn't deleted) or to remove an item.")
            }

            // Words found in photos
            let suggestions = suggestedWords(bin)
            if !suggestions.isEmpty {
                Section {
                    FlowChips(words: suggestions) { store.addItem($0, to: binID) }
                        .padding(.vertical, 4)
                } header: {
                    Text("Seen in the photos")
                } footer: {
                    Text("The phone read these from your photos. Search finds them anyway; tap one to add it to the list.")
                }
            }

            if !bin.notes.trimmed.isEmpty {
                Section("Notes") { Text(bin.notes) }
            }

            Section {
                Button { showLabel = true } label: { Label("Show QR label", systemImage: "qrcode") }
                Button { editing = bin } label: { Label("Edit name, type, location or notes", systemImage: "pencil") }
                Button(role: .destructive) { confirmDelete = true } label: { Label("Delete this \(bin.kindNoun)", systemImage: "trash") }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(bin.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { itemFocused = false } }
        }
        .sheet(item: $editing) { b in BinEditView(bin: b, isNew: false) { _ in } }
        .sheet(isPresented: $showLabel) { LabelView(bin: bin) }
        .fullScreenCover(item: $viewing) { ref in PhotoViewer(name: ref.name, binID: binID) }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { img in store.addPhoto(img, to: binID) }.ignoresSafeArea()
        }
        .onChange(of: picked) { items in
            guard !items.isEmpty else { return }
            let list = items; picked = []
            Task {
                for it in list {
                    if let data = try? await it.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                        await MainActor.run { _ = store.addPhoto(img, to: binID) }
                    }
                }
            }
        }
        .confirmationDialog("Delete “\(bin.displayName)”?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete \(bin.kindNoun) and its photos", role: .destructive) {
                router.path.removeAll { $0 == .bin(binID) }
                store.delete(binID)
            }
        } message: {
            Text("This can't be undone unless it's in a backup.")
        }
    }

    private func addItem() {
        store.addItem(newItem, to: binID)
        newItem = ""
    }

    private func suggestedWords(_ bin: Bin) -> [String] {
        let have = Set(bin.items.map(BinSearch.normalize))
        return bin.autoWords.filter { w in !have.contains(where: { $0.contains(BinSearch.normalize(w)) }) }.prefix(24).map { $0 }
    }
}

struct PhotoRef: Identifiable { let name: String; var id: String { name } }

struct PhotoTile: View {
    @EnvironmentObject private var store: BinStore
    let name: String
    var body: some View {
        GeometryReader { g in
            if let img = store.image(name) {
                Image(uiImage: img).resizable().scaledToFill().frame(width: g.size.width, height: g.size.height).clipped()
            } else {
                Color(.secondarySystemFill)
            }
        }
    }
}

/// Wrapping row of tappable word chips.
struct FlowChips: View {
    let words: [String]
    let tap: (String) -> Void
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(words, id: \.self) { w in
                Button { tap(w) } label: {
                    Label(w, systemImage: "plus").font(.subheadline).lineLimit(1).minimumScaleFactor(0.75)
                        .padding(.horizontal, 10).padding(.vertical, 7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.accentColor.opacity(0.12), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add \(w) to items")
            }
        }
    }
}
