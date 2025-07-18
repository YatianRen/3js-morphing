uniform vec2 uResolution;
uniform float uSize;
uniform float uProgress;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime; // Add time uniform for animation

attribute vec3 aPositionTarget;
attribute float aSize;

varying vec3 vColor;

#include ../includes/simplexNoise3d.glsl

void main()
{
    // Mixed position
    float noiseOrigin = simplexNoise3d(position * 0.2);
    float noiseTarget = simplexNoise3d(aPositionTarget * 0.2);
    float noise = mix(noiseOrigin, noiseTarget, uProgress);
    noise = smoothstep(-1.0, 1.0, noise);
    
    float duration = 0.4;
    float delay = (1.0 - duration) * noise;
    float end = delay + duration;
    float progress = smoothstep(delay, end, uProgress);
    vec3 mixedPosition = mix(position, aPositionTarget, progress);

    // Add wave-like noise animation with smooth transition
    float waveNoise = 0.0;
    vec3 waveInput = position + uTime * 0.30; // Slower wave movement
    waveNoise = simplexNoise3d(waveInput * 0.2) * 0.20; // Reduced amplitude
    waveNoise += simplexNoise3d(waveInput * 0.05) * 0.10; // Reduced larger wave
    
    // Smooth transition between waving and morphing
    // Create a smooth falloff based on transition progress
    float waveStrength = 1.0 - smoothstep(0.0, 0.3, uProgress) * smoothstep(1.0, 0.7, uProgress);
    waveNoise *= waveStrength;
    
    // Calculate normal direction for wave movement
    vec3 normal = normalize(position - aPositionTarget);
    // If positions are too similar, use a default up direction
    if (length(normal) < 0.001) {
        normal = vec3(0.0, 1.0, 0.0);
    }
    
    // Apply wave along the normal direction
    mixedPosition += normal * waveNoise;

    // Final position
    vec4 modelPosition = modelMatrix * vec4(mixedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // Point size
    gl_PointSize = aSize * uSize * uResolution.y;
    gl_PointSize *= (1.0 / - viewPosition.z);

    // Varyings
    vColor = mix(uColorA, uColorB, noise);
}