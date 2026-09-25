//
//  RootView.swift
//  GeoAR Pro: Surveying Simulator
//

import Foundation
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch model.gate {
            case .ready:
                SurveyingExperienceView()
            case .needsCamera:
                PermissionGateView()
            case .unsupported:
                UnsupportedDeviceView()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.refreshAuthorization() }
        }
    }
}

/// AR view + all overlays.
struct SurveyingExperienceView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        ZStack {
            ARViewContainer(controller: scene)
                .ignoresSafeArea()

            if scene.optics.mode == .standard {
                HandOverlayView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                CatalogOverlayView()
                    .transition(.opacity)
            } else {
                TelescopeView()
                    .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 1.15)),
                                            removal: .opacity))
            }

            ToastOverlay()
        }
        .animation(.easeInOut(duration: 0.35), value: scene.optics.mode)
    }
}

struct ToastOverlay: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack {
            if let toast = model.scene.toast {
                Label(toast.text, systemImage: toast.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(color(for: toast.tint))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .glass(cornerRadius: 18)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .id(toast.id)
            }
            Spacer()
        }
        .padding(.top, 150)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: model.scene.toast)
        .allowsHitTesting(false)
    }

    private func color(for tint: ToastMessage.Tint) -> Color {
        switch tint {
        case .info: .white
        case .success: .surveyGreen
        case .warning: .surveyAmber
        }
    }
}

struct PermissionGateView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.03, green: 0.07, blue: 0.12), .black], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 22) {
                Image(systemName: "scope")
                    .font(.system(size: 64, weight: .thin))
                    .foregroundStyle(Color.surveyAccent)
                Text("GeoAR Pro")
                    .font(.largeTitle.weight(.bold))
                Text("Surveying Simulator")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Text("The camera is used to place virtual total stations, levels and GNSS rovers in your surroundings and to track your hand as you operate them.")
                    .multilineTextAlignment(.center)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 32)
                if model.cameraAuthorization == .denied {
                    GlassActionButton(title: "Open Settings", systemImage: "gear", prominent: true) {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                    .padding(.horizontal, 48)
                } else {
                    GlassActionButton(title: "Enable Camera", systemImage: "camera.fill", prominent: true) {
                        Task { await model.requestCameraAccess() }
                    }
                    .padding(.horizontal, 48)
                }
            }
        }
    }
}

struct UnsupportedDeviceView: View {
    var body: some View {
        ContentUnavailableView("AR not supported",
                               systemImage: "arkit",
                               description: Text("GeoAR Pro requires an iPhone with ARKit world tracking. A LiDAR scanner (iPhone Pro) is recommended for occlusion, fingertip depth and EDM measurements."))
    }
}
