import Foundation

/// A made-up family used only by the automated screenshot test (launch argument -demoData).
enum DemoData {
    static func seed(_ s: JarStore) {
        var d = AppData.starter()
        d.setupDone = true
        d.settings.pin = "1234"
        d.settings.sound = false
        d.settings.speak = false
        let ava = Kid(name: "Ava", avatar: "🦊", color: kidColors[0], stars: 0)
        let ben = Kid(name: "Ben", avatar: "🦖", color: kidColors[1], stars: 0)
        d.kids = [ava, ben]
        if let i = d.chores.firstIndex(where: { $0.name == "Feed the dog" }) { d.chores[i].kids = [ben.id]; d.chores[i].stars = 2 }
        let today = Date()
        // Earlier this week, so the week chart has stars in it
        for back in stride(from: 1, through: weekday(today), by: 1) {
            let day = addDays(today, -back)
            for item in d.choresFor(ava.id, day) where item.chore.name != "Clear your plate" || back % 2 == 0 { d.markDone(ava.id, item.chore.id, day, now: day) }
            for item in d.choresFor(ben.id, day).prefix(3) { d.markDone(ben.id, item.chore.id, day, now: day) }
        }
        // Ava has two done today
        for item in d.choresFor(ava.id, today).prefix(2) { d.markDone(ava.id, item.chore.id, today) }
        d.adjust(ava.id, 2, reason: "Helped Granddad wash the airplane")
        s.data = d
    }
}
