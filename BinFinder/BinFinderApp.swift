import SwiftUI

@main
struct BinFinderApp: App {
    @StateObject private var store: BinStore
    @StateObject private var router = Router()

    init() {
        if ProcessInfo.processInfo.arguments.contains("-demoData") {
            // Sample bins in a throwaway folder, used by the automated screenshot test.
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("demo-\(UUID().uuidString)")
            let s = BinStore(root: dir)
            DemoData.seed(s)
            _store = StateObject(wrappedValue: s)
        } else {
            _store = StateObject(wrappedValue: BinStore(root: BinStore.documents()))
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(router)
                .onOpenURL { url in
                    // Opened by scanning a bin's QR label with the Camera app.
                    if let id = BinLinks.binID(from: url), store.bin(id) != nil { router.path = [id] }
                }
        }
    }
}
