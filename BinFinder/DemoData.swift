import UIKit

/// Sample bins for the automated screenshot test (launched with -demoData). Never used in normal runs.
enum DemoData {
    static func seed(_ store: BinStore) {
        let samples: [(String, String, String, [String], String, UIColor, String)] = [
            ("Electrical spares", "Garage", "G-01", ["Spare fuses (ATC 5–30 A)", "Zip ties", "Electrical tape", "Heat-shrink tubing", "Butt connectors"], "bolt.fill", .systemOrange, "FUSES"),
            ("Drill and bits", "Garage", "G-02", ["Cordless drill", "Drill bit index", "Countersink cage", "Step bits"], "wrench.and.screwdriver.fill", .systemBlue, "DRILL BITS"),
            ("Rivet supplies", "Hangar", "H-01", ["AN470 rivets", "Cleco clamps", "Rivet gun", "Bucking bars"], "hammer.fill", .systemGray, "RIVETS"),
            ("Oil and filters", "Hangar", "H-02", ["Aeroshell 15W-50", "Oil filters", "Safety wire", "Funnel"], "drop.fill", .systemBrown, "AEROSHELL"),
            ("Sewer and water", "RV Rear Bay", "RR-01", ["Sewer hose", "Water pressure regulator", "Fresh water hose", "Gloves"], "drop.triangle.fill", .systemTeal, "WATER"),
            ("Leveling blocks", "RV Rear Bay", "RR-02", ["Leveling blocks", "Wheel chocks", "Tire pressure gauge"], "square.stack.3d.up.fill", .systemYellow, "LEVELERS"),
        ]
        for s in samples {
            let b = Bin(name: s.0, location: s.1, code: s.2, items: s.3)
            store.upsert(b)
            store.addPhoto(image(symbol: s.4, color: s.5, label: s.6), to: b.id, analyze: true)
        }
    }

    static func image(symbol: String, color: UIColor, label: String) -> UIImage {
        let size = CGSize(width: 900, height: 700)
        let format = UIGraphicsImageRendererFormat.default(); format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            color.withAlphaComponent(0.25).setFill(); ctx.fill(CGRect(origin: .zero, size: size))
            let cfg = UIImage.SymbolConfiguration(pointSize: 300, weight: .regular)
            if let sym = UIImage(systemName: symbol, withConfiguration: cfg)?.withTintColor(color, renderingMode: .alwaysOriginal) {
                sym.draw(in: CGRect(x: (size.width - sym.size.width) / 2, y: 70, width: sym.size.width, height: sym.size.height))
            }
            let a = NSAttributedString(string: label, attributes: [.font: UIFont.systemFont(ofSize: 90, weight: .black), .foregroundColor: UIColor.black])
            let w = a.size().width
            UIColor.white.setFill(); ctx.fill(CGRect(x: (size.width - w) / 2 - 20, y: 540, width: w + 40, height: 120))
            a.draw(at: CGPoint(x: (size.width - w) / 2, y: 552))
        }
    }
}
