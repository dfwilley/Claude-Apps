import SwiftUI

/// Everything listed in every bin and box, A to Z. Tap an item to open the bin or box it's in.
struct AllItemsView: View {
    @EnvironmentObject private var store: BinStore
    @State private var filter = ""

    private var rows: [ItemEntry] {
        let all = BinSearch.allItems(store.bins)
        let f = BinSearch.normalize(filter.trimmed)
        return f.isEmpty ? all : all.filter { BinSearch.normalize($0.item).contains(f) }
    }

    /// Rows under their first letter ("#" for numbers and symbols), in order.
    private var sections: [(String, [ItemEntry])] {
        var out: [(String, [ItemEntry])] = []
        for r in rows {
            let first = BinSearch.normalize(r.item).first
            let head = (first.map { $0 >= "a" && $0 <= "z" } ?? false) ? String(first!).uppercased() : "#"
            if out.last?.0 == head { out[out.count - 1].1.append(r) } else { out.append((head, [r])) }
        }
        return out
    }

    var body: some View {
        List {
            if rows.isEmpty {
                Text(store.bins.allSatisfy { $0.items.isEmpty } ? "No items yet. Open a bin or box and add what's inside." : "No items match.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(sections, id: \.0) { head, list in
                    Section(head) {
                        ForEach(list) { r in
                            NavigationLink(value: Route.bin(r.bin.id)) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(r.item).font(.headline)
                                    Text([r.bin.name.trimmed.isEmpty ? r.bin.kindWord : r.bin.name.trimmed, r.bin.code, BinPlaces.tidy(r.bin.location)]
                                        .filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 2)
                                .accessibilityElement(children: .combine)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("All items")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $filter, placement: .navigationBarDrawer(displayMode: .always), prompt: "Narrow the list")
        .autocorrectionDisabled()
    }
}
