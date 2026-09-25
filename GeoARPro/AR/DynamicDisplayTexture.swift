//
//  DynamicDisplayTexture.swift
//  GeoAR Pro: Surveying Simulator
//
//  Live texture for in-scene screens (instrument LCD, GNSS field tablet).
//  Content is rendered with Core Graphics and pushed into an existing
//  `TextureResource` with `replace(withImage:)`, so every material that
//  references the texture updates without rebuilding entities.
//

import Foundation
import RealityKit
import UIKit

struct DisplayContent: Equatable {
    struct Line: Equatable {
        var label: String
        var value: String
        var unit: String = ""
    }

    enum Style: Equatable {
        /// Monochrome reflective instrument LCD.
        case lcd
        /// Colour field-controller screen.
        case tablet
    }

    var title: String
    var status: String
    var lines: [Line]
    var style: Style
    var alert: String?
}

@MainActor
final class DynamicDisplayTexture {
    let texture: TextureResource
    let pixelSize: CGSize
    private var lastContent: DisplayContent?

    init?(pixelSize: CGSize = CGSize(width: 384, height: 192), initial: DisplayContent) {
        guard let image = Self.render(initial, size: pixelSize),
              let texture = try? TextureResource.generate(from: image, options: .init(semantic: .color))
        else { return nil }
        self.texture = texture
        self.pixelSize = pixelSize
        self.lastContent = initial
    }

    /// Re-renders only when the content actually changed (the caller throttles too).
    func update(_ content: DisplayContent) {
        guard content != lastContent, let image = Self.render(content, size: pixelSize) else { return }
        lastContent = content
        try? texture.replace(withImage: image, options: .init(semantic: .color))
    }

    private static func render(_ content: DisplayContent, size: CGSize) -> CGImage? {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { ctx in
            switch content.style {
            case .lcd: drawLCD(content, in: ctx.cgContext, size: size)
            case .tablet: drawTablet(content, in: ctx.cgContext, size: size)
            }
        }
        return image.cgImage
    }

    // MARK: - Instrument LCD

    private static func drawLCD(_ content: DisplayContent, in g: CGContext, size: CGSize) {
        // Reflective STN background: grey-green gradient with a faint backlight.
        let colors = [UIColor(red: 0.70, green: 0.76, blue: 0.68, alpha: 1).cgColor,
                      UIColor(red: 0.58, green: 0.65, blue: 0.57, alpha: 1).cgColor] as CFArray
        if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            g.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
        let ink = UIColor(red: 0.07, green: 0.09, blue: 0.08, alpha: 1)

        // Title bar with inverted text.
        let barHeight = size.height * 0.2
        g.setFillColor(ink.cgColor)
        g.fill(CGRect(x: 0, y: 0, width: size.width, height: barHeight))
        let barFont = UIFont.monospacedSystemFont(ofSize: barHeight * 0.62, weight: .bold)
        draw(content.title, font: barFont, color: UIColor(red: 0.70, green: 0.76, blue: 0.68, alpha: 1),
             at: CGPoint(x: 10, y: barHeight * 0.14))
        drawRight(content.status, font: barFont, color: UIColor(red: 0.70, green: 0.76, blue: 0.68, alpha: 1),
                  rightEdge: size.width - 10, y: barHeight * 0.14)

        let rowHeight = (size.height - barHeight - 8) / CGFloat(max(content.lines.count, 3))
        let labelFont = UIFont.monospacedSystemFont(ofSize: rowHeight * 0.52, weight: .semibold)
        let valueFont = UIFont.monospacedDigitSystemFont(ofSize: rowHeight * 0.72, weight: .bold)
        for (i, line) in content.lines.enumerated() {
            let y = barHeight + 4 + CGFloat(i) * rowHeight
            draw(line.label, font: labelFont, color: ink, at: CGPoint(x: 10, y: y + rowHeight * 0.2))
            drawRight(line.value + (line.unit.isEmpty ? "" : " " + line.unit), font: valueFont, color: ink,
                      rightEdge: size.width - 12, y: y + rowHeight * 0.08)
        }

        if let alert = content.alert {
            let rect = CGRect(x: size.width * 0.12, y: size.height * 0.36, width: size.width * 0.76, height: size.height * 0.42)
            g.setFillColor(ink.cgColor)
            g.fill(rect)
            let font = UIFont.systemFont(ofSize: rect.height * 0.3, weight: .heavy)
            let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor(red: 0.7, green: 0.76, blue: 0.68, alpha: 1)]
            let textSize = (alert as NSString).size(withAttributes: attributes)
            (alert as NSString).draw(at: CGPoint(x: rect.midX - textSize.width / 2, y: rect.midY - textSize.height / 2),
                                     withAttributes: attributes)
        }
    }

    // MARK: - Field tablet

    private static func drawTablet(_ content: DisplayContent, in g: CGContext, size: CGSize) {
        g.setFillColor(UIColor(red: 0.06, green: 0.08, blue: 0.11, alpha: 1).cgColor)
        g.fill(CGRect(origin: .zero, size: size))

        // Faux map background.
        g.setStrokeColor(UIColor(red: 0.16, green: 0.22, blue: 0.28, alpha: 1).cgColor)
        g.setLineWidth(1)
        stride(from: CGFloat(0), to: size.width, by: 24).forEach { x in
            g.move(to: CGPoint(x: x, y: 0)); g.addLine(to: CGPoint(x: x, y: size.height))
        }
        stride(from: CGFloat(0), to: size.height, by: 24).forEach { y in
            g.move(to: CGPoint(x: 0, y: y)); g.addLine(to: CGPoint(x: size.width, y: y))
        }
        g.strokePath()

        let header = CGRect(x: 0, y: 0, width: size.width, height: size.height * 0.18)
        g.setFillColor(UIColor(red: 0.0, green: 0.42, blue: 0.75, alpha: 1).cgColor)
        g.fill(header)
        let headerFont = UIFont.systemFont(ofSize: header.height * 0.52, weight: .bold)
        draw(content.title, font: headerFont, color: .white, at: CGPoint(x: 10, y: header.height * 0.2))
        let statusColor: UIColor = content.status.contains("Fixed") ? .systemGreen : (content.status.contains("Float") ? .systemOrange : .systemRed)
        drawRight(content.status, font: headerFont, color: statusColor, rightEdge: size.width - 10, y: header.height * 0.2)

        let rowHeight = (size.height - header.height - 6) / CGFloat(max(content.lines.count, 4))
        let labelFont = UIFont.systemFont(ofSize: rowHeight * 0.48, weight: .medium)
        let valueFont = UIFont.monospacedDigitSystemFont(ofSize: rowHeight * 0.6, weight: .semibold)
        for (i, line) in content.lines.enumerated() {
            let y = header.height + 3 + CGFloat(i) * rowHeight
            draw(line.label, font: labelFont, color: UIColor(white: 0.7, alpha: 1), at: CGPoint(x: 10, y: y + rowHeight * 0.2))
            drawRight(line.value + (line.unit.isEmpty ? "" : " " + line.unit), font: valueFont, color: .white,
                      rightEdge: size.width - 10, y: y + rowHeight * 0.14)
        }
    }

    // MARK: - Text helpers

    private static func draw(_ text: String, font: UIFont, color: UIColor, at point: CGPoint) {
        (text as NSString).draw(at: point, withAttributes: [.font: font, .foregroundColor: color])
    }

    private static func drawRight(_ text: String, font: UIFont, color: UIColor, rightEdge: CGFloat, y: CGFloat) {
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
        let width = (text as NSString).size(withAttributes: attributes).width
        (text as NSString).draw(at: CGPoint(x: rightEdge - width, y: y), withAttributes: attributes)
    }
}
