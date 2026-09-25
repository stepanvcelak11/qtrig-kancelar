//
//  GeoARApp.swift
//  GeoAR Pro: Surveying Simulator
//

import SwiftUI

@main
struct GeoARApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
        }
    }
}
