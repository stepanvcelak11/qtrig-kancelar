import XCTest
import simd

final class GeodeticMathTests: XCTestCase {
    func testUnitConversions() {
        XCTAssertEqual(GeodeticMath.gon(100), .pi / 2, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.toGon(.pi), 200, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.arcseconds(3600), GeodeticMath.degrees(1), accuracy: 1e-15)
        XCTAssertEqual(GeodeticMath.toArcminutes(GeodeticMath.degrees(1)), 60, accuracy: 1e-9)
    }

    func testNormalisation() {
        XCTAssertEqual(GeodeticMath.normalized(-.pi / 2), 3 * .pi / 2, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.normalized(5 * .pi), .pi, accuracy: 1e-12)
        XCTAssertLessThan(GeodeticMath.normalized(-1e-18), GeodeticMath.fullCircle)
        XCTAssertEqual(GeodeticMath.wrappedToPi(3 * .pi / 2), -.pi / 2, accuracy: 1e-12)
    }

    func testAzimuthIsClockwiseFromMinusZ() {
        XCTAssertEqual(GeodeticMath.azimuth(of: SIMD3(0, 0, -1)), 0, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.azimuth(of: SIMD3(1, 0, 0)), .pi / 2, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.azimuth(of: SIMD3(0, 0, 1)), .pi, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.azimuth(of: SIMD3(-1, 0, 0)), 3 * .pi / 2, accuracy: 1e-12)
    }

    func testZenithAngle() {
        XCTAssertEqual(GeodeticMath.zenithAngle(of: SIMD3(0, 1, 0)), 0, accuracy: 1e-12)
        XCTAssertEqual(GeodeticMath.zenithAngle(of: SIMD3(0, 0, -5)), .pi / 2, accuracy: 1e-12)
    }

    func testDistanceReduction() {
        let zenith = GeodeticMath.gon(90)
        let hd = GeodeticMath.horizontalDistance(slope: 100, zenith: zenith)
        let dh = GeodeticMath.heightDifference(slope: 100, zenith: zenith, instrumentHeight: 1.5, targetHeight: 1.5)
        XCTAssertEqual(hd, 98.7688, accuracy: 1e-4)
        XCTAssertEqual(dh, 15.6434, accuracy: 1e-4)
    }

    func testTiltGradientFromPlane() {
        // Plane rising 1 mm per 100 mm towards +X.
        let g = GeodeticMath.tiltGradient(fromPlaneThrough: SIMD3(0, 0, 0), SIMD3(0.1, 0.001, 0), SIMD3(0, 0, 0.1))
        XCTAssertEqual(g.x, 0.01, accuracy: 1e-12)
        XCTAssertEqual(g.y, 0, accuracy: 1e-12)
        // The tilt rotation maps +Y onto the plate normal, which leans to the LOW side.
        let up = GeodeticMath.tiltRotation(forGradient: g).act(SIMD3(0, 1, 0))
        XCTAssertLessThan(up.x, 0)
    }

    func testDMSFormattingCarries() {
        XCTAssertEqual(GeodeticMath.formatDMS(GeodeticMath.degrees(90)), "90°00'00\"")
        // 29°59'59.7" rounds up to 30°00'00".
        let almost30 = GeodeticMath.degrees(29 + 59.0 / 60 + 59.7 / 3600)
        XCTAssertEqual(GeodeticMath.formatDMS(almost30), "30°00'00\"")
    }

    func testGonFormatting() {
        XCTAssertEqual(GeodeticMath.format(GeodeticMath.gon(123.45678), unit: .gon), "123.4568")
        XCTAssertEqual(GeodeticMath.format(nil, unit: .gon), "----.----")
    }
}
