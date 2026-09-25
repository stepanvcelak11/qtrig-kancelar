//
//  MeshFactory.swift
//  GeoAR Pro: Surveying Simulator
//
//  Procedural mesh primitives built with `MeshDescriptor` (iOS 17 has no
//  built-in cylinder/cone generators). The workhorse is a LATHE (surface of
//  revolution): a 2-D profile (radius r, height y) revolved about +Y. Lenses,
//  knobs, telescope tubes, radomes, shoe spikes and tori are all lathes.
//

import RealityKit
import simd

/// Accumulates vertices/indices and fixes triangle winding automatically.
struct MeshBuilder {
    private(set) var positions: [SIMD3<Float>] = []
    private(set) var normals: [SIMD3<Float>] = []
    private(set) var uvs: [SIMD2<Float>] = []
    private(set) var indices: [UInt32] = []

    @discardableResult
    mutating func vertex(_ p: SIMD3<Float>, _ n: SIMD3<Float>, _ uv: SIMD2<Float>) -> UInt32 {
        positions.append(p)
        normals.append(n)
        uvs.append(uv)
        return UInt32(positions.count - 1)
    }

    /// Appends a triangle. RealityKit renders counter-clockwise front faces, so
    /// the winding is chosen such that the geometric normal agrees with the
    /// supplied vertex normals. Degenerate triangles (e.g. at a lathe's axis)
    /// are skipped.
    mutating func triangle(_ a: UInt32, _ b: UInt32, _ c: UInt32) {
        let pa = positions[Int(a)], pb = positions[Int(b)], pc = positions[Int(c)]
        let face = simd_cross(pb - pa, pc - pa)
        guard simd_length_squared(face) > 1e-20 else { return }
        let reference = normals[Int(a)] + normals[Int(b)] + normals[Int(c)]
        if simd_dot(face, reference) >= 0 {
            indices.append(contentsOf: [a, b, c])
        } else {
            indices.append(contentsOf: [a, c, b])
        }
    }

    @MainActor
    func makeMesh(name: String) -> MeshResource {
        var descriptor = MeshDescriptor(name: name)
        descriptor.positions = MeshBuffers.Positions(positions)
        descriptor.normals = MeshBuffers.Normals(normals)
        descriptor.textureCoordinates = MeshBuffers.TextureCoordinates(uvs)
        descriptor.primitives = .triangles(indices)
        do {
            return try MeshResource.generate(from: [descriptor])
        } catch {
            return MeshResource.generateBox(size: 0.001)
        }
    }
}

@MainActor
enum MeshFactory {
    // MARK: - Lathe

    /// Revolves `profile` (x = radius, y = height) about the +Y axis.
    ///
    /// Normals are derived from the profile tangent: for a segment direction
    /// (dr, dy) the outward normal in the (r, y) half-plane is (dy, −dr). A
    /// profile therefore produces OUTWARD normals when it is traversed with
    /// the solid on its left: bottom axis → outwards → up → back to the top
    /// axis. Adjacent segments whose normals differ by less than
    /// `smoothingAngle` share averaged normals (smooth curves); sharper
    /// corners stay crisp (machined edges).
    static func lathe(_ rawProfile: [SIMD2<Float>], segments: Int = 48,
                      smoothingAngle: Float = .pi / 5, name: String = "lathe") -> MeshResource {
        // Drop consecutive duplicates — they would produce NaN normals.
        var profile: [SIMD2<Float>] = []
        for p in rawProfile where profile.last.map({ simd_distance($0, p) > 1e-6 }) ?? true {
            profile.append(p)
        }
        guard profile.count >= 2 else { return MeshResource.generateSphere(radius: 0.0005) }

        let segmentCount = profile.count - 1
        var segmentNormals: [SIMD2<Float>] = []
        var arcLength: [Float] = [0]
        for i in 0..<segmentCount {
            let d = profile[i + 1] - profile[i]
            let length = simd_length(d)
            segmentNormals.append(SIMD2(d.y, -d.x) / length)
            arcLength.append(arcLength[i] + length)
        }
        let totalLength = max(arcLength[segmentCount], 1e-6)
        let cosSmooth = cos(smoothingAngle)

        func blend(_ neighbour: SIMD2<Float>, _ own: SIMD2<Float>) -> SIMD2<Float> {
            simd_dot(neighbour, own) >= cosSmooth ? simd_normalize(neighbour + own) : own
        }

        var builder = MeshBuilder()
        for i in 0..<segmentCount {
            let own = segmentNormals[i]
            let nStart = i > 0 ? blend(segmentNormals[i - 1], own) : own
            let nEnd = i < segmentCount - 1 ? blend(segmentNormals[i + 1], own) : own
            let p0 = profile[i], p1 = profile[i + 1]
            let v0 = arcLength[i] / totalLength, v1 = arcLength[i + 1] / totalLength

            var ring: [(UInt32, UInt32)] = []
            for s in 0...segments {
                let u = Float(s) / Float(segments)
                let theta = u * 2 * .pi
                let c = cos(theta), sn = sin(theta)
                let a = builder.vertex(SIMD3(p0.x * c, p0.y, p0.x * sn),
                                       simd_normalize(SIMD3(nStart.x * c, nStart.y, nStart.x * sn)),
                                       SIMD2(u, v0))
                let b = builder.vertex(SIMD3(p1.x * c, p1.y, p1.x * sn),
                                       simd_normalize(SIMD3(nEnd.x * c, nEnd.y, nEnd.x * sn)),
                                       SIMD2(u, v1))
                ring.append((a, b))
            }
            for s in 0..<segments {
                let (a0, b0) = ring[s]
                let (a1, b1) = ring[s + 1]
                builder.triangle(a0, a1, b1)
                builder.triangle(a0, b1, b0)
            }
        }
        return builder.makeMesh(name: name)
    }

    // MARK: - Lathe-based primitives

    /// Closed cylinder centred on the origin, axis +Y.
    static func cylinder(radius: Float, height: Float, segments: Int = 40, bevel: Float = 0) -> MeshResource {
        let h = height / 2
        let b = min(bevel, radius * 0.4, h * 0.4)
        var profile: [SIMD2<Float>] = [SIMD2(0, -h)]
        if b > 0 {
            profile += [SIMD2(radius - b, -h), SIMD2(radius, -h + b), SIMD2(radius, h - b), SIMD2(radius - b, h)]
        } else {
            profile += [SIMD2(radius, -h), SIMD2(radius, h)]
        }
        profile.append(SIMD2(0, h))
        return lathe(profile, segments: segments, name: "cylinder")
    }

    /// Hollow tube (open ring) centred on the origin, axis +Y.
    static func tube(outerRadius: Float, innerRadius: Float, height: Float, segments: Int = 40) -> MeshResource {
        let h = height / 2
        return lathe([SIMD2(innerRadius, -h), SIMD2(outerRadius, -h), SIMD2(outerRadius, h),
                      SIMD2(innerRadius, h), SIMD2(innerRadius, -h)],
                     segments: segments, smoothingAngle: 0.1, name: "tube")
    }

    /// Truncated cone (frustum), base at y = 0, top at y = height.
    static func frustum(bottomRadius: Float, topRadius: Float, height: Float, segments: Int = 32) -> MeshResource {
        lathe([SIMD2(0, 0), SIMD2(bottomRadius, 0), SIMD2(topRadius, height), SIMD2(0, height)],
              segments: segments, name: "frustum")
    }

    /// Torus in the XZ plane: a circle profile revolved about Y.
    static func torus(majorRadius: Float, minorRadius: Float, segments: Int = 48, sides: Int = 16) -> MeshResource {
        var profile: [SIMD2<Float>] = []
        for i in 0...sides {
            // Counter-clockwise in the (r, y) plane keeps the solid on the left
            // → outward normals.
            let a = Float(i) / Float(sides) * 2 * .pi
            profile.append(SIMD2(majorRadius + minorRadius * cos(a), minorRadius * sin(a)))
        }
        return lathe(profile, segments: segments, smoothingAngle: .pi / 2, name: "torus")
    }

    /// Spherical cap / dome (radome, lens) with base radius `radius` at y = 0
    /// and apex at y = `height`. `flatBase` closes the underside.
    static func dome(radius: Float, height: Float, segments: Int = 48, rings: Int = 14, flatBase: Bool = true) -> MeshResource {
        var profile: [SIMD2<Float>] = flatBase ? [SIMD2(0, 0)] : []
        for i in 0...rings {
            let t = Float(i) / Float(rings)
            // Elliptical arc from the rim (t = 0) to the apex (t = 1).
            let angle = t * .pi / 2
            profile.append(SIMD2(radius * cos(angle), height * sin(angle)))
        }
        return lathe(profile, segments: segments, smoothingAngle: .pi / 3, name: "dome")
    }

    /// Thin optical element: a shallow convex surface facing +Y with a flat back.
    static func lens(radius: Float, sagitta: Float, thickness: Float, segments: Int = 48) -> MeshResource {
        var profile: [SIMD2<Float>] = [SIMD2(0, -thickness), SIMD2(radius, -thickness), SIMD2(radius, 0)]
        let steps = 10
        for i in 1...steps {
            let r = radius * (1 - Float(i) / Float(steps))
            // Parabolic approximation of a spherical surface.
            profile.append(SIMD2(r, sagitta * (1 - (r * r) / (radius * radius))))
        }
        return lathe(profile, segments: segments, smoothingAngle: .pi / 4, name: "lens")
    }

    // MARK: - Extrusions

    /// Extrudes a convex outline (x, z) along Y, centred on y = 0.
    static func extrudedPolygon(_ outline: [SIMD2<Float>], height: Float, name: String = "extrusion") -> MeshResource {
        guard outline.count >= 3 else { return MeshResource.generateBox(size: 0.001) }
        var builder = MeshBuilder()
        let n = outline.count
        let centroid = outline.reduce(SIMD2<Float>.zero, +) / Float(n)
        let top = height / 2, bottom = -height / 2
        let extent = outline.reduce(Float(0)) { max($0, simd_length($1 - centroid)) } * 2

        // Caps: triangle fans around the centroid.
        for (y, ny) in [(top, Float(1)), (bottom, Float(-1))] {
            let normal = SIMD3<Float>(0, ny, 0)
            let center = builder.vertex(SIMD3(centroid.x, y, centroid.y), normal, SIMD2(0.5, 0.5))
            var ring: [UInt32] = []
            for p in outline {
                let uv = (p - centroid) / extent + SIMD2(0.5, 0.5)
                ring.append(builder.vertex(SIMD3(p.x, y, p.y), normal, uv))
            }
            for i in 0..<n {
                builder.triangle(center, ring[i], ring[(i + 1) % n])
            }
        }

        // Side walls with per-vertex normals averaged across gentle corners.
        var edgeNormals: [SIMD2<Float>] = []
        for i in 0..<n {
            let a = outline[i], b = outline[(i + 1) % n]
            let e = b - a
            var nrm = simd_normalize(SIMD2(e.y, -e.x))
            if simd_dot(nrm, (a + b) / 2 - centroid) < 0 { nrm = -nrm }
            edgeNormals.append(nrm)
        }
        var perimeter: Float = 0
        for i in 0..<n {
            let a = outline[i], b = outline[(i + 1) % n]
            let own = edgeNormals[i]
            let prev = edgeNormals[(i + n - 1) % n], next = edgeNormals[(i + 1) % n]
            let na = simd_dot(prev, own) > 0.8 ? simd_normalize(prev + own) : own
            let nb = simd_dot(next, own) > 0.8 ? simd_normalize(next + own) : own
            let length = simd_distance(a, b)
            let u0 = perimeter / extent, u1 = (perimeter + length) / extent
            perimeter += length
            let v0 = builder.vertex(SIMD3(a.x, bottom, a.y), SIMD3(na.x, 0, na.y), SIMD2(u0, 0))
            let v1 = builder.vertex(SIMD3(b.x, bottom, b.y), SIMD3(nb.x, 0, nb.y), SIMD2(u1, 0))
            let v2 = builder.vertex(SIMD3(b.x, top, b.y), SIMD3(nb.x, 0, nb.y), SIMD2(u1, 1))
            let v3 = builder.vertex(SIMD3(a.x, top, a.y), SIMD3(na.x, 0, na.y), SIMD2(u0, 1))
            builder.triangle(v0, v1, v2)
            builder.triangle(v0, v2, v3)
        }
        return builder.makeMesh(name: name)
    }

    /// Equilateral triangle with rounded corners (tribrach / tripod head outline).
    /// Corners point along the given azimuths (clockwise from −Z).
    static func roundedTriangleOutline(circumradius: Float, cornerRadius: Float,
                                       cornerAzimuths: [Float] = [.pi, .pi * 5 / 3, .pi / 3],
                                       stepsPerCorner: Int = 8) -> [SIMD2<Float>] {
        // Corner arc centres lie on the bisector, 2·r_c inside the sharp corner
        // (distance from the corner to the tangent points' circle centre for a
        // 60° interior angle is r_c / sin 30°).
        let inset = circumradius - 2 * cornerRadius
        // Convert azimuths (clockwise from −Z) to math angles in the (x, z) plane
        // and sort them so the outline is traversed monotonically.
        let angles = cornerAzimuths.map { az -> Float in atan2(-cos(az), sin(az)) }.sorted()
        var points: [SIMD2<Float>] = []
        for angle in angles {
            let center = SIMD2(cos(angle), sin(angle)) * inset
            for s in 0...stepsPerCorner {
                let a = angle - .pi / 3 + (2 * .pi / 3) * Float(s) / Float(stepsPerCorner)
                points.append(center + SIMD2(cos(a), sin(a)) * cornerRadius)
            }
        }
        return points
    }
}
