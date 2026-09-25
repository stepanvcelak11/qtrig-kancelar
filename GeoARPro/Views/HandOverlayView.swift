//
//  HandOverlayView.swift
//  GeoAR Pro: Surveying Simulator
//
//  Visual feedback for hand tracking: fingertip cursor, thumb link, pinch
//  ring and the name of the part under the finger.
//

import Foundation
import SwiftUI

struct HandOverlayView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        if scene.interactionMode == .handTracking, let hand = scene.handOverlay {
            let color: Color = hand.isPinching ? .surveyGreen : (scene.hoveredPart != nil ? .surveyAccent : .white)
            ZStack(alignment: .topLeading) {
                Canvas { context, _ in
                    var link = Path()
                    link.move(to: hand.thumb)
                    link.addLine(to: hand.index)
                    context.stroke(link, with: .color(color.opacity(0.7)),
                                   style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: hand.isPinching ? [] : [4, 4]))

                    let ring = CGRect(x: hand.index.x - 14, y: hand.index.y - 14, width: 28, height: 28)
                    context.stroke(Path(ellipseIn: ring), with: .color(color), lineWidth: hand.isPinching ? 4 : 2)
                    context.fill(Path(ellipseIn: CGRect(x: hand.index.x - 4, y: hand.index.y - 4, width: 8, height: 8)),
                                 with: .color(color))
                    context.fill(Path(ellipseIn: CGRect(x: hand.thumb.x - 5, y: hand.thumb.y - 5, width: 10, height: 10)),
                                 with: .color(color.opacity(0.6)))
                }

                if let part = scene.engagedPart ?? scene.hoveredPart {
                    Text(part.displayName)
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(.black.opacity(0.55)))
                        .foregroundStyle(color)
                        .position(x: hand.index.x, y: hand.index.y - 32)
                }

                Text(String(format: "pinch %.1f cm", hand.pinchDistance * 100) + (hand.hasDepth ? " · LiDAR" : " · est."))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
                    .position(x: hand.index.x, y: hand.index.y + 30)
            }
        }
    }
}
