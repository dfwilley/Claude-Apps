import SwiftUI

@main
struct HGVCBinderApp: App {
    var body: some Scene {
        WindowGroup {
            BinderView()
                .ignoresSafeArea()
        }
    }
}
