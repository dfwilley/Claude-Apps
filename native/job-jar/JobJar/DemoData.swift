import Foundation
import UIKit

/// A made-up family used only by the automated screenshot test (launch argument -demoData).
enum DemoData {
    static func seed(_ s: JarStore) {
        var d = AppData.starter()
        d.setupDone = true
        d.settings.pin = "1234"
        d.settings.sound = false
        d.settings.speak = false
        let ava = Kid(name: "Ava", avatar: "🦊", color: kidColors[0], stars: 0, photo: demoPhoto())
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

    /// A drawn smiley "photo" so screenshots show a picture avatar without using anyone's real photo.
    static func demoPhoto() -> String {
        let img = UIGraphicsImageRenderer(size: CGSize(width: 300, height: 300)).image { c in
            UIColor(red: 0.49, green: 0.78, blue: 0.89, alpha: 1).setFill(); c.fill(CGRect(x: 0, y: 0, width: 300, height: 300))
            UIColor(red: 0.91, green: 0.36, blue: 0.46, alpha: 1).setFill(); c.fill(CGRect(x: 60, y: 220, width: 180, height: 80))
            UIColor(red: 0.96, green: 0.79, blue: 0.63, alpha: 1).setFill(); c.cgContext.fillEllipse(in: CGRect(x: 80, y: 50, width: 140, height: 160))
            UIColor.darkGray.setFill()
            c.cgContext.fillEllipse(in: CGRect(x: 115, y: 105, width: 18, height: 18)); c.cgContext.fillEllipse(in: CGRect(x: 167, y: 105, width: 18, height: 18))
            UIColor(red: 0.69, green: 0.19, blue: 0.19, alpha: 1).setStroke()
            let smile = UIBezierPath(arcCenter: CGPoint(x: 150, y: 145), radius: 32, startAngle: 0.3, endAngle: .pi - 0.3, clockwise: true); smile.lineWidth = 7; smile.stroke()
        }
        return photoString(from: img.pngData() ?? Data()) ?? ""
    }
}
