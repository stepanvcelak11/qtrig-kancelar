//
//  TelescopeOptics.metal
//  GeoAR Pro: Surveying Simulator
//
//  SwiftUI layer shader for the eyepiece view (iOS 17 `.layerEffect`):
//    • circular field stop (hard mask with a soft 4 % edge),
//    • cos⁴-law vignetting towards the edge of the field,
//    • lateral chromatic aberration growing with r²,
//    • edge blur of the optical tube (outer 18 % of the field),
//    • defocus blur driven by the focus knob (dioptre mismatch).
//

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

[[ stitchable ]] half4 eyepieceOptics(float2 position, SwiftUI::Layer layer,
                                      float2 size, float aberration, float defocus) {
    float2 center = size * 0.5;
    float radius = min(size.x, size.y) * 0.5;
    float2 offset = position - center;
    float r = length(offset) / radius;          // 0 at the centre, 1 at the field stop

    if (r > 1.0) {
        return half4(0.0h, 0.0h, 0.0h, 1.0h);
    }

    float2 dir = r > 1e-4 ? normalize(offset) : float2(0.0);

    // Defocus: 8-tap disc blur whose radius follows the dioptre mismatch.
    float blurRadius = clamp(defocus, 0.0, 14.0);
    half4 color = layer.sample(position);
    if (blurRadius > 0.25) {
        half4 sum = color;
        for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398;
            sum += layer.sample(position + float2(cos(a), sin(a)) * blurRadius);
        }
        color = sum / 9.0h;
    }

    // Lateral chromatic aberration: red and blue images scaled differently.
    float shift = aberration * r * r;
    color.r = layer.sample(position + dir * shift).r;
    color.b = layer.sample(position - dir * shift).b;

    // Tube edge blur.
    float edge = smoothstep(0.82, 1.0, r);
    if (edge > 0.0) {
        half4 blur = (layer.sample(position + float2(3.0, 0.0)) + layer.sample(position - float2(3.0, 0.0)) +
                      layer.sample(position + float2(0.0, 3.0)) + layer.sample(position - float2(0.0, 3.0))) * 0.25h;
        color = mix(color, blur, half(edge));
    }

    // Natural vignetting (cos⁴ of the field angle) and the soft field stop.
    float fieldAngle = r * 0.55;
    float c = cos(fieldAngle);
    float vignette = c * c * c * c;
    float stop = 1.0 - smoothstep(0.96, 1.0, r);
    color.rgb *= half(vignette * stop);
    color.a = 1.0h;
    return color;
}
