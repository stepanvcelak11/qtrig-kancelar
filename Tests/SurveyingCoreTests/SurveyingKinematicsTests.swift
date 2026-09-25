import XCTest
import simd

final class SurveyingKinematicsTests: XCTestCase {
    private var totalStation: EquipmentModel { EquipmentCatalog.model(id: "leica-ts16")! }
    private var level: EquipmentModel { EquipmentCatalog.model(id: "leica-na730")! }

    private func makeStation() -> SurveyingKinematics {
        SurveyingKinematics(config: .make(for: totalStation))
    }

    func testHzIncreasesClockwise() {
        var k = makeStation()
        let hz0 = k.readings.hz!
        _ = k.rotateAlidade(by: -GeodeticMath.gon(10)) // right-handed negative = clockwise from above
        XCTAssertEqual(GeodeticMath.toGon(k.readings.hz! - hz0), 10, accuracy: 1e-3)
    }

    func testHorizontalLineOfSightReadsHundredGon() {
        let k = makeStation()
        XCTAssertEqual(GeodeticMath.toGon(k.readings.v!), 100, accuracy: 1e-4)
        XCTAssertEqual(k.readings.face, .one)
    }

    func testFaceTwoReadingsAreComplementary() {
        var k = makeStation()
        _ = k.pitchTelescope(by: 0.1)
        let faceOne = k.readings
        // Transit the telescope and turn the alidade by 200 gon: same line of sight.
        _ = k.rotateAlidade(by: .pi)
        _ = k.pitchTelescope(by: .pi - 0.2)
        let faceTwo = k.readings
        XCTAssertEqual(faceTwo.face, .two)
        XCTAssertEqual(faceOne.v! + faceTwo.v!, 2 * .pi, accuracy: 1e-5)
        XCTAssertEqual(GeodeticMath.wrappedToPi(faceTwo.hz! - faceOne.hz! - .pi), 0, accuracy: 1e-5)
    }

    func testFineDriveProducesDetentTicks() {
        var k = makeStation()
        // TS16 fine drive: 0.25 gon per revolution, detent every 0.01 gon → 25 ticks.
        let feedback = k.turnHorizontalTangent(turns: 1)
        XCTAssertTrue((24...26).contains(feedback.detentTicks), "got \(feedback.detentTicks) ticks")
        XCTAssertEqual(GeodeticMath.toGon(k.readings.hz!), 0.25, accuracy: 1e-3)
    }

    func testHzHoldKeepsReading() {
        var k = makeStation()
        k.state.hzHold = true
        let before = k.readings.hz!
        _ = k.rotateAlidade(by: 1.0)
        XCTAssertEqual(k.readings.hz!, before, accuracy: 1e-5)
    }

    func testSetHorizontalReading() {
        var k = makeStation()
        _ = k.rotateAlidade(by: 0.7)
        k.setHorizontalReading(0)
        XCTAssertEqual(GeodeticMath.wrappedToPi(k.readings.hz!), 0, accuracy: 1e-5)
    }

    func testClampAndTangentMechanics() {
        var config = InstrumentKinematicsConfig.make(for: totalStation)
        config.driveType = .clampAndTangent
        var k = SurveyingKinematics(config: config)

        // Tangent screw without clamp has no effect.
        XCTAssertTrue(k.turnHorizontalTangent(turns: 1).clampReleased)
        XCTAssertEqual(k.state.alidadeAngle, 0)

        // Clamped alidade cannot be turned by hand.
        k.setHorizontalClamp(true)
        XCTAssertTrue(k.rotateAlidade(by: 0.5).blockedByClamp)

        // Tangent travel is limited to ±3 gon.
        let feedback = k.turnHorizontalTangent(turns: 100)
        XCTAssertTrue(feedback.hitTravelLimit)
        XCTAssertEqual(abs(GeodeticMath.toGon(k.state.alidadeAngle)), 3, accuracy: 1e-9)
    }

    func testFootScrewsCanCancelSetupTilt() {
        var k = makeStation()
        k.state.setupTilt = SIMD2(0.01, 0)
        XCTAssertEqual(k.levelState, .outOfRange)
        XCTAssertNil(k.readings.hz, "Measurements are blocked outside the compensator range")

        // Screw 1 (front-left, x = −0.866 R) goes up, screw 2 (front-right,
        // x = +0.866 R) goes down by the same amount: pure X-gradient correction.
        let r = k.config.footScrewRadius
        // Required height difference between x = +0.866R and x = −0.866R: Δh = g · 1.732 R.
        let dh = 0.01 * 1.732 * r
        let turns = (dh / 2) / k.config.footScrewLead
        _ = k.turnFootScrew(1, turns: turns)
        _ = k.turnFootScrew(2, turns: -turns)
        XCTAssertLessThan(GeodeticMath.toArcseconds(k.tiltMagnitude), 30)
        XCTAssertEqual(k.levelState, .leveled)
    }

    func testBubbleMovesToHighSide() {
        var k = makeStation()
        _ = k.turnFootScrew(2, turns: 0.2) // front-right screw up
        let bubble = k.circularBubbleOffset
        XCTAssertGreaterThan(bubble.x, 0)
        XCTAssertLessThan(bubble.y, 0)
    }

    func testCompensatedReadingsMatchTrueLineOfSight() {
        var k = makeStation()
        k.state.setupTilt = SIMD2(GeodeticMath.arcminutes(2), GeodeticMath.arcminutes(-1))
        _ = k.pitchTelescope(by: 0.2)
        let readings = k.readings
        let los = k.physicalLineOfSight
        XCTAssertEqual(readings.v!, GeodeticMath.zenithAngle(of: los), accuracy: GeodeticMath.arcseconds(1))
        // Uncompensated value differs by the longitudinal tilt.
        XCTAssertNotEqual(readings.v!, readings.mechanicalV, accuracy: GeodeticMath.arcseconds(5))
    }

    func testAutomaticLevelKeepsLineOfSightHorizontal() {
        var k = SurveyingKinematics(config: .make(for: level))
        // Tilt along the line of sight (z component of the gradient).
        k.state.setupTilt = SIMD2(0, GeodeticMath.arcminutes(5))
        XCTAssertEqual(k.measurementLineOfSight.y, 0, accuracy: 1e-12)
        XCTAssertNotEqual(k.physicalLineOfSight.y, 0, accuracy: 1e-9)
        k.state.setupTilt = SIMD2(0, GeodeticMath.arcminutes(30))
        XCTAssertNotEqual(k.measurementLineOfSight.y, 0, accuracy: 1e-9)
    }

    func testFocusIsLogarithmicAndLimited() {
        var k = makeStation()
        k.turnFocus(turns: -100)
        XCTAssertEqual(k.state.focusDistance, k.config.focusRange.lowerBound, accuracy: 1e-9)
        XCTAssertGreaterThan(k.defocus(forTargetDistance: 50), 0)
        k.setFocusDistance(50)
        XCTAssertEqual(k.defocus(forTargetDistance: 50), 0, accuracy: 1e-12)
    }

    func testPoleTiltIsLimited() {
        var pole = PoleKinematics(length: 2)
        pole.point(towards: SIMD3(5, 1, 0))
        XCTAssertEqual(pole.tilt, pole.maximumTilt, accuracy: 1e-9)
        XCTAssertLessThan(pole.bubbleOffset.x, 0, "Bubble moves away from the lean")
    }
}
