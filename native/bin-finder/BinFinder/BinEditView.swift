import SwiftUI
import PhotosUI

/// New bin or edit an existing one.
struct BinEditView: View {
    @EnvironmentObject private var store: BinStore
    @Environment(\.dismiss) private var dismiss
    @State var bin: Bin
    let isNew: Bool
    var onSave: (Bin) -> Void

    @State private var itemsText = ""
    @State private var pending: [UIImage] = []
    @State private var showCamera = false
    @State private var picked: [PhotosPickerItem] = []
    @State private var codeTouched = false

    init(bin: Bin, isNew: Bool, onSave: @escaping (Bin) -> Void) {
        _bin = State(initialValue: bin)
        self.isNew = isNew
        self.onSave = onSave
        _itemsText = State(initialValue: bin.items.joined(separator: "\n"))
    }

    var body: some View {
        NavigationStack {
            Form {
                if isNew {
                    Section {
                        if !pending.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(Array(pending.enumerated()), id: \.offset) { i, img in
                                        Image(uiImage: img).resizable().scaledToFill().frame(width: 84, height: 84)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                            .overlay(alignment: .topTrailing) {
                                                Button { pending.remove(at: i) } label: {
                                                    Image(systemName: "xmark.circle.fill").font(.title3).symbolRenderingMode(.palette)
                                                        .foregroundStyle(.white, .black.opacity(0.6))
                                                }
                                                .padding(3)
                                                .accessibilityLabel("Remove photo")
                                            }
                                    }
                                }
                            }
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
                    } header: {
                        Text("Photos of what's inside")
                    } footer: {
                        Text("The phone reads labels and recognizes things in the photos, so search can find them even if you don't list them.")
                    }
                }

                Section {
                    TextField("Name, like Electrical spares", text: $bin.name)
                        .textInputAutocapitalization(.sentences)
                        .accessibilityIdentifier("binName")
                    Picker("Container", selection: $bin.kind) {
                        Text("Bin").tag("bin")
                        Text("Box").tag("box")
                        Text("None").tag("none")
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("binKind")
                    .onChange(of: bin.kind) { _ in autoCode() }
                    HStack {
                        TextField("Location, like Hangar / Shelf 2", text: $bin.location)
                            .textInputAutocapitalization(.words)
                            .onChange(of: bin.location) { _ in autoCode() }
                        if !store.locations.isEmpty {
                            Menu {
                                ForEach(store.locations, id: \.self) { l in Button(l) { bin.location = l } }
                            } label: { Image(systemName: "chevron.down.circle").font(.title3) }
                            .accessibilityLabel("Choose a location")
                        }
                    }
                    HStack {
                        Text("Label")
                        TextField("G-BIN-1", text: Binding(get: { bin.code }, set: { bin.code = $0.uppercased(); codeTouched = true }))
                            .multilineTextAlignment(.trailing)
                            .font(.body.monospacedDigit())
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }
                    Toggle("Pack for trips", isOn: $bin.trip)
                } header: {
                    Text("Bin or box")
                } footer: {
                    Text("Bin is a plastic container, Box is cardboard, and None is for a shelf, drawer or compartment. For a place inside a place, use / or ›, like Hangar / Shelf 2 or RV / Front bay / Left.")
                }

                Section {
                    TextField("One thing per line", text: $itemsText, axis: .vertical)
                        .lineLimit(4...14)
                        .accessibilityIdentifier("itemsText")
                } header: {
                    Text("What's inside")
                } footer: {
                    Text("For example: spare fuses, zip ties, electrical tape. Commas or new lines both work. Tap the microphone on the keyboard to dictate.")
                }

                Section("Notes") {
                    TextField("Anything else", text: $bin.notes, axis: .vertical).lineLimit(2...6)
                }
            }
            .navigationTitle(isNew ? "New bin or box" : "Edit \(bin.kindNoun)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).fontWeight(.semibold).accessibilityIdentifier("saveBin") }
            }
            .onAppear { if isNew && bin.code.isEmpty { bin.code = store.nextCode(for: bin.location, kind: bin.kind) } }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { pending.append($0) }.ignoresSafeArea()
            }
            .onChange(of: picked) { items in
                guard !items.isEmpty else { return }
                let list = items; picked = []
                Task {
                    for it in list {
                        if let data = try? await it.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                            await MainActor.run { pending.append(img) }
                        }
                    }
                }
            }
        }
    }

    static func parseItems(_ text: String) -> [String] {
        text.split(whereSeparator: { $0 == "\n" || $0 == "," || $0 == ";" }).map { String($0).trimmed }.filter { !$0.isEmpty }
    }

    /// The label code follows a change of type or location, unless it was typed by hand.
    private func autoCode() {
        guard !codeTouched else { return }
        if isNew { bin.code = store.nextCode(for: bin.location, kind: bin.kind); return }
        guard let orig = store.bin(bin.id), BinCodes.isAuto(orig) else { return }
        bin.code = BinCodes.stem(for: bin.location, kind: bin.kind) == BinCodes.stem(for: orig.location, kind: orig.kind)
            ? orig.code : store.nextCode(for: bin.location, kind: bin.kind, skipping: bin.id)
    }

    private func save() {
        // Start from the stored copy so photos and words read in the background aren't lost.
        var b = store.bin(bin.id) ?? bin
        b.name = bin.name.trimmed
        b.location = BinPlaces.tidy(bin.location)
        b.trip = bin.trip
        b.kind = bin.kind
        b.code = bin.code.trimmed.isEmpty ? store.nextCode(for: bin.location, kind: bin.kind, skipping: bin.id) : bin.code.trimmed
        b.notes = bin.notes
        b.items = Self.parseItems(itemsText)
        store.upsert(b)
        for img in pending { store.addPhoto(img, to: b.id) }
        onSave(b)
        dismiss()
    }
}
