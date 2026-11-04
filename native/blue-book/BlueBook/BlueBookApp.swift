import SwiftUI

@main
struct BlueBookApp: App {
    var body: some Scene {
        WindowGroup {
            BookView()
                .ignoresSafeArea()
        }
    }
}
