//
//  AppModel.swift
//  GeoAR Pro: Surveying Simulator
//
//  App-level UI state: permissions, catalogue selection, drawer state.
//  The AR scene state lives in `ARSceneController`.
//

import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class AppModel {
    let scene = ARSceneController()
    let capabilities = DeviceCapabilities.current()

    var cameraAuthorization = CameraAuthorization.current
    var selectedCategory: EquipmentCategory = .totalStation
    var selectedModelID: String = EquipmentCatalog.defaultModel.id
    var isDrawerExpanded = false
    /// After placing equipment the catalogue shrinks to a small button, so the AR view stays clear.
    var isDrawerCollapsed = false

    var selectedModel: EquipmentModel {
        EquipmentCatalog.model(id: selectedModelID) ?? EquipmentCatalog.defaultModel
    }

    enum Gate: Equatable {
        case ready
        case needsCamera
        case unsupported
    }

    var gate: Gate {
        guard capabilities.supportsWorldTracking else { return .unsupported }
        return cameraAuthorization == .authorized ? .ready : .needsCamera
    }

    func requestCameraAccess() async {
        cameraAuthorization = await CameraAuthorization.request()
    }

    func refreshAuthorization() {
        cameraAuthorization = CameraAuthorization.current
    }

    func select(_ model: EquipmentModel) {
        selectedModelID = model.id
        selectedCategory = model.category
    }

    func placeSelected() {
        scene.beginPlacement(of: selectedModel)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            isDrawerExpanded = false
            isDrawerCollapsed = true
        }
    }
}
