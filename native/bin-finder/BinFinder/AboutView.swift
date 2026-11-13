import SwiftUI

/// What changed in each version. Keep in step with CHANGES in the web version (bin-finder/app.js).
enum AppInfo {
    static var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "" }
    static var build: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "" }

    struct Change: Identifiable { let version: String; let date: String; let notes: [String]; var id: String { version } }
    static let changes: [Change] = [
        Change(version: "1.8", date: "November 13, 2026", notes: ["About screen with the version, build number and what changed."]),
        Change(version: "1.7", date: "November 13, 2026", notes: ["Lists of bins are in A-to-Z order by name.", "Change a container's type or location and its label code follows."]),
        Change(version: "1.6", date: "November 13, 2026", notes: ["Location pull-downs on the main list: choose a place, then a shelf inside it.", "Label codes count each type on its own in each location: G-BIN-1, G-BOX-1, G-1."]),
        Change(version: "1.5", date: "November 12, 2026", notes: ["Container can be None, for a shelf, drawer or compartment."]),
        Change(version: "1.4", date: "November 12, 2026", notes: ["Put a saved bin or box inside another one."]),
        Change(version: "1.3", date: "November 12, 2026", notes: ["Mark each container as a bin or a box.", "All items: one A-to-Z list of everything."]),
    ]
}

/// About: version, build number and what changed. Opened from the ⋯ menu.
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Version", value: AppInfo.version)
                    LabeledContent("Build", value: AppInfo.build)
                } footer: {
                    Text("Bin Finder helps you find things in storage bins. Everything stays on this phone.")
                }
                Section("What changed") {
                    ForEach(AppInfo.changes) { c in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Version \(c.version)").font(.headline)
                            Text(c.date).font(.subheadline).foregroundStyle(.secondary)
                            ForEach(c.notes, id: \.self) { n in Text("• \(n)").font(.footnote) }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
