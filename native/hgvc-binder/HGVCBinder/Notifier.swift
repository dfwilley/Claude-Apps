import Foundation
import UserNotifications

/// Phone reminders before points expire, the save-by date, and fee due dates.
/// The screens send the full list each time something changes; this replaces what's scheduled.
enum Notifier {
    struct Item { let id: String; let fire: DateComponents; let title: String; let body: String }

    static func parse(_ list: [[String: Any]]) -> [Item] {
        list.compactMap { d in
            guard let id = d["id"] as? String, let fire = d["fire"] as? String, let title = d["title"] as? String else { return nil }
            let parts = fire.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3 else { return nil }
            var c = DateComponents(); c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
            c.hour = (d["hour"] as? Int) ?? 9; c.minute = 0
            return Item(id: id, fire: c, title: title, body: (d["body"] as? String) ?? "")
        }
    }

    static func schedule(_ list: [[String: Any]], done: @escaping (Bool) -> Void) {
        let items = parse(list)
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            center.removeAllPendingNotificationRequests()
            guard granted else { return DispatchQueue.main.async { done(false) } }
            for it in items.prefix(60) {
                let content = UNMutableNotificationContent()
                content.title = it.title; content.body = it.body; content.sound = .default
                let req = UNNotificationRequest(identifier: it.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: it.fire, repeats: false))
                center.add(req)
            }
            DispatchQueue.main.async { done(true) }
        }
    }
}
