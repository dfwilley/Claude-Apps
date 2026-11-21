import SwiftUI

@main
struct BrickPileApp: App {
    var body: some Scene {
        WindowGroup {
            PileView()
                .ignoresSafeArea()
        }
    }
}
