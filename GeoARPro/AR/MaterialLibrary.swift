//
//  MaterialLibrary.swift
//  GeoAR Pro: Surveying Simulator
//
//  Physically based materials for industrial survey equipment. Fine surface
//  detail (orange-peel paint, knurling, carbon weave, wood grain, brushed
//  metal) comes from procedurally generated, tileable normal / albedo maps,
//  so the app looks convincing without shipping texture assets.
//

import CoreGraphics
import Foundation
import Metal
import RealityKit
import simd
import UIKit

extension RGBAColor {
    var uiColor: UIColor {
        UIColor(red: CGFloat(r), green: CGFloat(g), blue: CGFloat(b), alpha: CGFloat(a))
    }
}

@MainActor
final class MaterialLibrary {
    static let shared = MaterialLibrary()

    private var textureCache: [String: TextureResource] = [:]

    private init() {}

    // MARK: - Texture plumbing

    private func texture(_ key: String, semantic: TextureResource.Semantic,
                         make: () -> CGImage?) -> TextureResource? {
        if let cached = textureCache[key] { return cached }
        guard let image = make(),
              let resource = try? TextureResource.generate(
                from: image,
                options: TextureResource.CreateOptions(semantic: semantic, mipmapsMode: .allocateAndGenerateAll))
        else { return nil }
        textureCache[key] = resource
        return resource
    }

    /// Trilinear, repeating sampler so tiled maps can use texture transforms.
    private func repeating(_ resource: TextureResource) -> MaterialParameters.Texture {
        let descriptor = MTLSamplerDescriptor()
        descriptor.sAddressMode = .repeat
        descriptor.tAddressMode = .repeat
        descriptor.minFilter = .linear
        descriptor.magFilter = .linear
        descriptor.mipFilter = .linear
        descriptor.maxAnisotropy = 8
        return MaterialParameters.Texture(resource, sampler: MaterialParameters.Texture.Sampler(descriptor))
    }

    private func normalMap(_ key: String, strength: Double, height: @escaping (Double, Double) -> Double) -> MaterialParameters.Texture? {
        texture("normal.\(key)", semantic: .normal) {
            ProceduralTextureFactory.normalMap(size: 256, strength: strength, height: height)
        }.map(repeating)
    }

    // MARK: - Coated metal (instrument housings)

    /// Powder-coated / painted die-cast housing. Roughness 0.45, metallic 0.8
    /// per spec, plus a clear lacquer layer and an orange-peel normal map that
    /// breaks up reflections the way real paint does.
    func coatedMetal(_ color: RGBAColor, roughness: Float = 0.45, metallic: Float = 0.8) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: color.uiColor)
        m.roughness = .init(scale: roughness)
        m.metallic = .init(scale: metallic)
        m.specular = .init(scale: 0.6)
        m.clearcoat = .init(scale: 0.8)
        m.clearcoatRoughness = .init(scale: 0.12)
        if let normal = normalMap("orangePeel", strength: 0.9, height: ProceduralTextureFactory.orangePeel) {
            m.normal = .init(texture: normal)
            m.textureCoordinateTransform = .init(offset: .zero, scale: SIMD2(3, 3), rotation: 0)
        }
        return m
    }

    // MARK: - Optics

    /// Multi-coated optical glass. RealityKit has no refraction/transmission,
    /// so "high transmission" is approximated with low opacity, near-zero
    /// roughness, full clearcoat and strong specular — the look of a coated
    /// objective lens reflecting the environment probe.
    func opticalGlass(tint: RGBAColor = RGBAColor(0.42, 0.34, 0.62), opacity: Float = 0.35) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: tint.uiColor)
        m.roughness = .init(scale: 0.05)
        m.metallic = .init(scale: 0.0)
        m.specular = .init(scale: 1.0)
        m.clearcoat = .init(scale: 1.0)
        m.clearcoatRoughness = .init(scale: 0.02)
        m.blending = .transparent(opacity: .init(scale: opacity))
        return m
    }

    /// Glass cover of a level vial: almost clear.
    func vialGlass() -> PhysicallyBasedMaterial {
        opticalGlass(tint: RGBAColor(0.85, 0.95, 0.9), opacity: 0.18)
    }

    /// Vial fluid (alcohol with a yellow-green tint).
    func vialFluid() -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: UIColor(red: 0.72, green: 0.86, blue: 0.35, alpha: 1))
        m.roughness = .init(scale: 0.1)
        m.clearcoat = .init(scale: 1)
        m.emissiveColor = .init(color: UIColor(red: 0.30, green: 0.40, blue: 0.10, alpha: 1))
        m.emissiveIntensity = 0.6
        m.blending = .transparent(opacity: .init(scale: 0.85))
        return m
    }

    /// The bubble itself: bright, glossy highlight.
    func bubble() -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: UIColor(white: 0.98, alpha: 1))
        m.roughness = .init(scale: 0.05)
        m.clearcoat = .init(scale: 1)
        m.emissiveColor = .init(color: UIColor(red: 0.95, green: 1.0, blue: 0.85, alpha: 1))
        m.emissiveIntensity = 0.9
        return m
    }

    // MARK: - Rubber / anodised aluminium

    /// Black rubber grip with a diamond knurl normal map (focus rings, knobs).
    func rubberKnurl() -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: UIColor(white: 0.055, alpha: 1))
        m.roughness = .init(scale: 0.85)
        m.metallic = .init(scale: 0)
        m.specular = .init(scale: 0.3)
        if let normal = normalMap("knurl", strength: 3.5, height: ProceduralTextureFactory.diamondKnurl) {
            m.normal = .init(texture: normal)
            m.textureCoordinateTransform = .init(offset: .zero, scale: SIMD2(6, 2), rotation: 0)
        }
        return m
    }

    /// Hard-anodised aluminium (dark grey matte with fine brushed anisotropy).
    func anodizedAluminum(_ color: RGBAColor = RGBAColor(0.13, 0.135, 0.14)) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: color.uiColor)
        m.roughness = .init(scale: 0.55)
        m.metallic = .init(scale: 0.9)
        m.anisotropyLevel = .init(scale: 0.5)
        if let normal = normalMap("brushed", strength: 1.2, height: ProceduralTextureFactory.brushed) {
            m.normal = .init(texture: normal)
        }
        return m
    }

    /// Bright machined / stainless steel (spikes, threads, tips).
    func brushedSteel() -> PhysicallyBasedMaterial {
        var m = anodizedAluminum(RGBAColor(0.72, 0.73, 0.75))
        m.roughness = .init(scale: 0.32)
        m.metallic = .init(scale: 1)
        return m
    }

    /// Yellow painted tripod hardware (clamps, hinges).
    func yellowHardware() -> PhysicallyBasedMaterial {
        coatedMetal(RGBAColor(0.97, 0.76, 0.08), roughness: 0.4, metallic: 0.55)
    }

    // MARK: - Composites & natural materials

    /// Woven 2×2 twill carbon fibre with clear epoxy coat (GNSS poles).
    func carbonFiber() -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        if let albedo = texture("albedo.carbon", semantic: .color, make: {
            ProceduralTextureFactory.image(size: 256, pixel: ProceduralTextureFactory.carbonAlbedo)
        }) {
            m.baseColor = .init(tint: .white, texture: repeating(albedo))
        } else {
            m.baseColor = .init(tint: UIColor(white: 0.08, alpha: 1))
        }
        if let normal = normalMap("carbon", strength: 2.2, height: ProceduralTextureFactory.carbonHeight) {
            m.normal = .init(texture: normal)
        }
        m.textureCoordinateTransform = .init(offset: .zero, scale: SIMD2(4, 100), rotation: 0)
        m.roughness = .init(scale: 0.35)
        m.metallic = .init(scale: 0.1)
        m.clearcoat = .init(scale: 1)
        m.clearcoatRoughness = .init(scale: 0.05)
        return m
    }

    /// Varnished beech wood (tripod legs). `lengthRepeat` tiles the grain along the leg.
    func varnishedWood(lengthRepeat: Float = 4) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        if let albedo = texture("albedo.wood", semantic: .color, make: {
            ProceduralTextureFactory.image(size: 256, pixel: ProceduralTextureFactory.woodAlbedo)
        }) {
            m.baseColor = .init(tint: .white, texture: repeating(albedo))
        } else {
            m.baseColor = .init(tint: UIColor(red: 0.55, green: 0.33, blue: 0.16, alpha: 1))
        }
        if let normal = normalMap("wood", strength: 1.0, height: ProceduralTextureFactory.woodHeight) {
            m.normal = .init(texture: normal)
        }
        m.textureCoordinateTransform = .init(offset: .zero, scale: SIMD2(1, lengthRepeat), rotation: 0)
        m.roughness = .init(scale: 0.5)
        m.metallic = .init(scale: 0)
        m.clearcoat = .init(scale: 0.9)
        m.clearcoatRoughness = .init(scale: 0.2)
        return m
    }

    /// Weathered off-white polycarbonate (GNSS radome).
    func radomePlastic(_ color: RGBAColor = RGBAColor(0.9, 0.9, 0.88)) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: color.uiColor)
        m.roughness = .init(scale: 0.42)
        m.metallic = .init(scale: 0)
        m.specular = .init(scale: 0.5)
        m.clearcoat = .init(scale: 0.4)
        return m
    }

    /// Matte black plastic (keypads, covers).
    func blackPlastic() -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: UIColor(white: 0.07, alpha: 1))
        m.roughness = .init(scale: 0.6)
        m.metallic = .init(scale: 0)
        return m
    }

    /// Self-lit screen showing a dynamic texture.
    func screen(_ texture: TextureResource) -> UnlitMaterial {
        var m = UnlitMaterial()
        m.color = .init(tint: .white, texture: .init(texture))
        return m
    }

    /// Glowing status LED.
    func led(_ color: UIColor, on: Bool) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        m.baseColor = .init(tint: on ? color : color.withAlphaComponent(1).mixed(with: .black, amount: 0.75))
        m.roughness = .init(scale: 0.2)
        m.clearcoat = .init(scale: 1)
        m.emissiveColor = .init(color: color)
        m.emissiveIntensity = on ? 4 : 0
        return m
    }

    /// Simple unlit colour (placement reticle, guides).
    func unlit(_ color: UIColor) -> UnlitMaterial {
        var m = UnlitMaterial(color: color)
        if color.cgColor.alpha < 1 {
            m.blending = .transparent(opacity: .init(scale: Float(color.cgColor.alpha)))
        }
        return m
    }

    /// Levelling rod face with E-pattern graduation.
    func rodFace(length: Double) -> PhysicallyBasedMaterial {
        var m = PhysicallyBasedMaterial()
        if let face = texture("rod.\(length)", semantic: .color, make: {
            ProceduralTextureFactory.levelingRodFace(length: length)
        }) {
            m.baseColor = .init(tint: .white, texture: .init(face))
        } else {
            m.baseColor = .init(tint: .white)
        }
        m.roughness = .init(scale: 0.55)
        m.metallic = .init(scale: 0)
        return m
    }
}

extension UIColor {
    func mixed(with other: UIColor, amount: CGFloat) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let t = max(0, min(1, amount))
        return UIColor(red: r1 + (r2 - r1) * t, green: g1 + (g2 - g1) * t,
                       blue: b1 + (b2 - b1) * t, alpha: a1 + (a2 - a1) * t)
    }
}

// MARK: - Procedural textures

/// CPU texture synthesis. All patterns are tileable (periodic on [0, 1)²).
enum ProceduralTextureFactory {
    static func image(size: Int, pixel: (Double, Double) -> SIMD4<Double>) -> CGImage? {
        var data = [UInt8](repeating: 0, count: size * size * 4)
        for y in 0..<size {
            for x in 0..<size {
                let c = pixel(Double(x) / Double(size), Double(y) / Double(size))
                let i = (y * size + x) * 4
                data[i] = UInt8(max(0, min(255, c.x * 255)))
                data[i + 1] = UInt8(max(0, min(255, c.y * 255)))
                data[i + 2] = UInt8(max(0, min(255, c.z * 255)))
                data[i + 3] = UInt8(max(0, min(255, c.w * 255)))
            }
        }
        guard let provider = CGDataProvider(data: Data(data) as CFData) else { return nil }
        return CGImage(width: size, height: size, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: size * 4,
                       space: CGColorSpaceCreateDeviceRGB(),
                       bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                       provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
    }

    /// Tangent-space normal map from a height function using central differences.
    static func normalMap(size: Int, strength: Double, height: @escaping (Double, Double) -> Double) -> CGImage? {
        let e = 1.0 / Double(size)
        return image(size: size) { u, v in
            let dx = (height(fract(u + e), v) - height(fract(u - e + 1), v)) / (2 * e)
            let dy = (height(u, fract(v + e)) - height(u, fract(v - e + 1))) / (2 * e)
            var n = SIMD3(-dx * strength / Double(size), -dy * strength / Double(size), 1)
            n = simd_normalize(n)
            return SIMD4(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5, 1)
        }
    }

    static func fract(_ x: Double) -> Double { x - floor(x) }

    // MARK: Noise

    private static func hash(_ x: Int, _ y: Int, _ seed: Int) -> Double {
        var h = UInt64(truncatingIfNeeded: x &* 374_761_393 &+ y &* 668_265_263 &+ seed &* 1_442_695_041)
        h = (h ^ (h >> 13)) &* 1_274_126_177
        h ^= h >> 16
        return Double(h & 0xFFFF) / 65_535.0
    }

    /// Tileable value noise with `period` lattice cells per unit.
    static func valueNoise(_ u: Double, _ v: Double, period: Int, seed: Int = 0) -> Double {
        let x = u * Double(period), y = v * Double(period)
        let x0 = Int(floor(x)), y0 = Int(floor(y))
        let tx = x - Double(x0), ty = y - Double(y0)
        let sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
        func lattice(_ i: Int, _ j: Int) -> Double {
            hash(((i % period) + period) % period, ((j % period) + period) % period, seed)
        }
        let a = lattice(x0, y0), b = lattice(x0 + 1, y0)
        let c = lattice(x0, y0 + 1), d = lattice(x0 + 1, y0 + 1)
        return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy
    }

    // MARK: Height functions

    /// Fine "orange peel" of spray-painted housings.
    static func orangePeel(_ u: Double, _ v: Double) -> Double {
        valueNoise(u, v, period: 24, seed: 3) * 0.6 + valueNoise(u, v, period: 48, seed: 7) * 0.4
    }

    /// Diamond knurl: two crossing helical groove families.
    static func diamondKnurl(_ u: Double, _ v: Double) -> Double {
        let n = 16.0
        let a = abs(sin(.pi * n * (u + v)))
        let b = abs(sin(.pi * n * (u - v)))
        return min(a, b)
    }

    /// Brushed metal: fine streaks along u.
    static func brushed(_ u: Double, _ v: Double) -> Double {
        valueNoise(u * 0.02, v, period: 128, seed: 11) * 0.7 + valueNoise(u, v, period: 64, seed: 5) * 0.1
    }

    /// 2×2 twill: tows alternate direction every cell, shifted each row.
    static func carbonHeight(_ u: Double, _ v: Double) -> Double {
        let cells = 8.0
        let cx = Int(floor(u * cells)), cy = Int(floor(v * cells))
        let horizontal = ((cx + cy) % 4 + 4) % 4 < 2
        let local = horizontal ? fract(v * cells) : fract(u * cells)
        return sin(.pi * local)
    }

    static func carbonAlbedo(_ u: Double, _ v: Double) -> SIMD4<Double> {
        let cells = 8.0
        let cx = Int(floor(u * cells)), cy = Int(floor(v * cells))
        let horizontal = ((cx + cy) % 4 + 4) % 4 < 2
        let along = horizontal ? fract(u * cells * 6) : fract(v * cells * 6)
        let across = horizontal ? fract(v * cells) : fract(u * cells)
        let fibre = 0.5 + 0.5 * sin(2 * .pi * along * 3 + valueNoise(u, v, period: 32) * 2)
        let sheen = sin(.pi * across)
        let base = 0.035 + 0.05 * sheen + 0.015 * fibre + (horizontal ? 0.012 : 0)
        return SIMD4(base, base, base * 1.08, 1)
    }

    /// Beech grain: growth rings stretched along v, distorted by noise.
    static func woodRing(_ u: Double, _ v: Double) -> Double {
        let distortion = valueNoise(u, v, period: 6, seed: 21) * 1.6 + valueNoise(u, v, period: 24, seed: 9) * 0.25
        return fract(u * 7 + distortion)
    }

    static func woodHeight(_ u: Double, _ v: Double) -> Double {
        let r = woodRing(u, v)
        return pow(r, 3) * 0.6 + valueNoise(u, v, period: 64, seed: 13) * 0.15
    }

    static func woodAlbedo(_ u: Double, _ v: Double) -> SIMD4<Double> {
        let ring = woodRing(u, v)
        let late = pow(ring, 4)
        let fleck = valueNoise(u, v, period: 96, seed: 17)
        let light = SIMD3<Double>(0.74, 0.50, 0.28)
        let dark = SIMD3<Double>(0.46, 0.26, 0.12)
        var c = light + (dark - light) * late
        c *= 0.92 + 0.12 * fleck
        return SIMD4(c.x, c.y, c.z, 1)
    }

    // MARK: Levelling rod

    /// E-pattern rod face: 1 cm fields forming "E" figures every 5 cm, red
    /// metre numbers / black decimetre numbers. Row 0 of the image is the top
    /// of the rod.
    @MainActor
    static func levelingRodFace(length: Double) -> CGImage? {
        let width = 128, height = 4096
        let pxPerMetre = Double(height) / length
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
        let image = renderer.image { ctx in
            let g = ctx.cgContext
            g.setFillColor(UIColor(white: 0.97, alpha: 1).cgColor)
            g.fill(CGRect(x: 0, y: 0, width: width, height: height))
            let centimetres = Int(length * 100)
            for cm in 0..<centimetres {
                // y in image coordinates (0 = top): the rod foot is at the bottom.
                let yTop = CGFloat(Double(height) - Double(cm + 1) * pxPerMetre / 100)
                let h = CGFloat(pxPerMetre / 100)
                let metre = cm / 100
                let colour = metre % 2 == 0 ? UIColor.black : UIColor(red: 0.8, green: 0.05, blue: 0.05, alpha: 1)
                g.setFillColor(colour.cgColor)
                let inFive = cm % 10
                let leftSide = (cm / 5) % 2 == 0
                let x0: CGFloat = leftSide ? 8 : CGFloat(width) / 2
                let fieldWidth = CGFloat(width) / 2 - 8
                // "E" figure: spine for the full 5 cm, arms on cm 0, 2, 4 of each half-decimetre.
                let withinE = inFive % 5
                g.fill(CGRect(x: leftSide ? x0 : x0 + fieldWidth - 10, y: yTop, width: 10, height: h))
                if withinE % 2 == 0 {
                    g.fill(CGRect(x: x0, y: yTop, width: fieldWidth, height: h))
                }
            }
            // Decimetre numbers.
            let font = UIFont.systemFont(ofSize: 34, weight: .heavy)
            for dm in 1..<Int(length * 10) {
                let metre = dm / 10
                let colour = metre % 2 == 0 ? UIColor.black : UIColor(red: 0.8, green: 0.05, blue: 0.05, alpha: 1)
                let text = String(format: "%d%d", metre, dm % 10) as NSString
                let y = CGFloat(Double(height) - Double(dm) * pxPerMetre / 10)
                let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: colour]
                let size = text.size(withAttributes: attributes)
                let x = (dm / 5) % 2 == 0 ? CGFloat(width) - size.width - 6 : 6
                text.draw(at: CGPoint(x: x, y: y - size.height * 0.1), withAttributes: attributes)
                if dm % 10 == 0 {
                    g.setFillColor(UIColor(red: 0.8, green: 0.05, blue: 0.05, alpha: 1).cgColor)
                    g.fillEllipse(in: CGRect(x: CGFloat(width) / 2 - 7, y: y + 4, width: 14, height: 14))
                }
            }
        }
        return image.cgImage
    }
}
