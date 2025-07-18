import * as THREE from 'three';
window.THREE = THREE;

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
// import GUI from 'lil-gui' // GUI removed
import gsap from 'gsap'
import particlesVertexShader from './shaders/particles/vertex.glsl'
import particlesFragmentShader from './shaders/particles/fragment.glsl'

/**
 * Base
 */
// Debug - GUI removed
// const gui = new GUI({ width: 340 })
const debugObject = {}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loaders
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('./draco/')
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * Scroll
 */
let currentModelIndex = 0
let isTransitioning = false

// Scroll sensitivity controls
const scrollControls = {
    sensitivity: 0.2,        // Much more sensitive
    throttleTime: 20,        // More responsive
    transitionDuration: 2000 // Faster transitions
}

// Handle scroll events with improved sensitivity
let scrollTimeout
const handleScroll = () => {
    // Clear existing timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout)
    }
    
    // Throttle scroll events
    scrollTimeout = setTimeout(() => {
        const scrollY = window.scrollY
        const windowHeight = window.innerHeight
        const scrollProgress = scrollY / windowHeight
        
        // Determine which model should be active based on scroll position
        let targetIndex = Math.round(scrollProgress)
        targetIndex = Math.max(0, Math.min(3, targetIndex)) // Clamp between 0-3
        
        // Always update text animations
        updateTextAnimations(targetIndex)
        
        // If we're transitioning, check if we need to force an update
        if (isTransitioning) {
            // If the target has changed significantly, force the update
            if (Math.abs(targetIndex - currentModelIndex) > 1) {
                isTransitioning = false
            } else {
                return // Still transitioning, skip this update
            }
        }
        
        if (targetIndex !== currentModelIndex && particles) {
            isTransitioning = true
            currentModelIndex = targetIndex
            
            // Trigger morph transition
            particles.morph(currentModelIndex)
            
            // Move the particle models to different viewport positions
            moveModelsToViewport(targetIndex)
            
            // Reset transition flag after animation
            setTimeout(() => {
                isTransitioning = false
            }, scrollControls.transitionDuration)
        }
    }, scrollControls.throttleTime)
}

// Update text animations based on current model
const updateTextAnimations = (modelIndex) => {
    // Remove active class from all text sections
    document.querySelectorAll('.text-section').forEach(section => {
        section.classList.remove('active')
    })
    
    // Add active class to current model's text section
    const currentTextSection = document.querySelector(`[data-model="${modelIndex}"]`)
    if (currentTextSection) {
        currentTextSection.classList.add('active')
        
        // Move text to different positions for each model
        moveTextToPosition(modelIndex)
    }
}

// Move text to different positions for each model
const moveTextToPosition = (modelIndex) => {
    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight
    
    // Calculate responsive positions based on screen size
    const textPositions = [
        { x: `${screenWidth * 0.1}px`, y: '0px' },                    // Brain - 10% from left edge
        { x: `${screenWidth * 0.5}px`, y: '0px' },                    // Monkey - 80% from left (20% from right edge)
        { x: `${screenWidth * 0.25}px`, y: `${screenHeight * -0.15}px` }, // Text - center with slight upward offset
        { x: `${screenWidth * 0.1}px`, y: '0px' }                     // DNA - 10% from left edge
    ]
    
    const position = textPositions[modelIndex]
    const textSection = document.querySelector(`[data-model="${modelIndex}"]`)
    
    if (textSection) {
        console.log(`Moving text for model ${modelIndex} to position:`, position) // Debug log
        
        // Animate the text positioning using transform
        gsap.to(textSection, {
            x: position.x,
            y: position.y,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: function() {
                console.log(`Text position updated: x=${textSection.style.transform}`) // Debug log
            }
        })
    }
}

// Add scroll event listener with passive option for better performance
window.addEventListener('scroll', handleScroll, { passive: true })

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Materials
    if(particles)
        particles.material.uniforms.uResolution.value.set(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)
    
    // Recalculate text positions for current model
    if (particles) {
        moveTextToPosition(currentModelIndex)
    }
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 0, 8 * 2)
scene.add(camera)

// Controls - Disabled to prevent interference with scrolling
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})

renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

debugObject.clearColor = '#160920'
// gui.addColor(debugObject, 'clearColor').onChange(() => { renderer.setClearColor(debugObject.clearColor) }) // GUI removed
renderer.setClearColor(debugObject.clearColor)

/**
 * Particles
 */
let particles = null

gltfLoader.load('./models2.glb', (gltf) =>
{
    particles = {}
    particles.index = 0

    // Positions
    const positions = gltf.scene.children.map(child => child.geometry.attributes.position)
    
    // Reorder the sequence: [Brain, Monkey, text, DNA]
    // Assuming original order was [Monkey, text, Brain, DNA]
    const reorderedPositions = [
        positions[2], // Brain (was index 2)
        positions[0], // Monkey (was index 0)
        positions[1], // text (was index 1)
        positions[3]  // DNA (was index 3)
    ]

    particles.maxCount = 0
    for(const position of reorderedPositions)
    {
        if(position.count > particles.maxCount)
            particles.maxCount = position.count
    }
    // Randomly select 70% of indices to keep
    const keepRatio = 0.7;
    const keepCount = Math.floor(particles.maxCount * keepRatio);
    const allIndices = Array.from({length: particles.maxCount}, (_, i) => i);
    // Shuffle and take the first keepCount indices
    for (let i = allIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }
    const keepIndices = allIndices.slice(0, keepCount).sort((a, b) => a - b);

    particles.positions = []
    for(const position of reorderedPositions)
    {
        const originalArray = position.array
        const newArray = new Float32Array(keepCount * 3)
        for(let i = 0; i < keepCount; i++) {
            const srcIndex = keepIndices[i] * 3;
            const dstIndex = i * 3;
            if(srcIndex < originalArray.length) {
                newArray[dstIndex + 0] = originalArray[srcIndex + 0]
                newArray[dstIndex + 1] = originalArray[srcIndex + 1]
                newArray[dstIndex + 2] = originalArray[srcIndex + 2]
            } else {
                // If the index is out of bounds, pick a random valid one
                const randomValid = Math.floor(position.count * Math.random()) * 3;
                newArray[dstIndex + 0] = originalArray[randomValid + 0]
                newArray[dstIndex + 1] = originalArray[randomValid + 1]
                newArray[dstIndex + 2] = originalArray[randomValid + 2]
            }
        }
        particles.positions.push(new THREE.Float32BufferAttribute(newArray, 3))
    }
    particles.maxCount = keepCount;
    
    // Add extra particles in whitespace
    const extraParticlesCount = Math.floor(particles.maxCount * 0.3) // 30% extra particles
    const extraParticlesArray = new Float32Array(extraParticlesCount * 3)
    
    for(let i = 0; i < extraParticlesCount; i++)
    {
        const i3 = i * 3
        // Create particles in a larger area around the models
        const radius = 15 // Larger radius for whitespace particles
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1) // Random elevation
        
        extraParticlesArray[i3 + 0] = radius * Math.sin(phi) * Math.cos(theta)
        extraParticlesArray[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        extraParticlesArray[i3 + 2] = radius * Math.cos(phi)
    }

    // Add extra particles in front of the camera
    const frontParticlesCount = Math.floor(particles.maxCount * 0.2) // 20% extra front particles
    const frontParticlesArray = new Float32Array(frontParticlesCount * 3)
    for(let i = 0; i < frontParticlesCount; i++) {
        const i3 = i * 3
        // Place in a spherical cap in front of the model (z > 0, closer to camera)
        const radius = 13 + Math.random() * 5 // Slightly closer than background
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 0.7) // Restrict phi to [0, ~45deg] for front cap
        frontParticlesArray[i3 + 0] = radius * Math.sin(phi) * Math.cos(theta)
        frontParticlesArray[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        frontParticlesArray[i3 + 2] = Math.abs(radius * Math.cos(phi)) // Always positive Z (in front)
    }

    // Add all extra particles to each position array
    for(let i = 0; i < particles.positions.length; i++)
    {
        const originalArray = particles.positions[i].array
        const combinedArray = new Float32Array(originalArray.length + extraParticlesArray.length + frontParticlesArray.length)
        
        // Copy original particles
        combinedArray.set(originalArray)
        // Add extra particles
        combinedArray.set(extraParticlesArray, originalArray.length)
        // Add front particles
        combinedArray.set(frontParticlesArray, originalArray.length + extraParticlesArray.length)
        
        particles.positions[i] = new THREE.Float32BufferAttribute(combinedArray, 3)
    }
    
    // Update max count to include all extra particles
    particles.maxCount += extraParticlesCount + frontParticlesCount

    // Geometry
    const sizesArray = new Float32Array(particles.maxCount)

    for(let i = 0; i < particles.maxCount; i++) {
        if(i < particles.maxCount - extraParticlesCount) {
            sizesArray[i] = Math.random() // Original particles
        } else {
            sizesArray[i] = Math.random() * 0.6 // Extra particles are smaller
        }
    }

    particles.geometry = new THREE.BufferGeometry()
    particles.geometry.setAttribute('position', particles.positions[particles.index])
    particles.geometry.setAttribute('aPositionTarget', particles.positions[3])
    particles.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1))


    // Material
    particles.colorA = '#ff7300'
    particles.colorB = '#0091ff'

    particles.material = new THREE.ShaderMaterial({
        vertexShader: particlesVertexShader,
        fragmentShader: particlesFragmentShader,
        uniforms:
        {
            uSize: new THREE.Uniform(0.4),
            uResolution: new THREE.Uniform(new THREE.Vector2(sizes.width * sizes.pixelRatio, sizes.height * sizes.pixelRatio)),
            uProgress: new THREE.Uniform(0),
            uColorA: new THREE.Uniform(new THREE.Color(particles.colorA)),
            uColorB: new THREE.Uniform(new THREE.Color(particles.colorB)),
            uTime: new THREE.Uniform(0) // Add time uniform for wave animation
        },
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })

    // Points
    particles.points = new THREE.Points(particles.geometry, particles.material)
    particles.points.frustumCulled = false
    scene.add(particles.points)

    // Initialize the first model (Brain) at the right-side position
    particles.points.position.set(4, 0, 0)

    // Methods
    particles.morph = (index) =>
    {
        // Update attributes
        particles.geometry.attributes.position = particles.positions[particles.index]
        particles.geometry.attributes.aPositionTarget = particles.positions[index]

        // Animate uProgress
        gsap.fromTo(
            particles.material.uniforms.uProgress,
            { value: 0 },
            { value: 1, duration: 3, ease: 'linear' }
        )

        // Save index
        particles.index = index
    }

    // Tweaks (keeping some GUI controls for debugging) - GUI removed
    // gui.addColor(particles, 'colorA').onChange(() => { particles.material.uniforms.uColorA.value.set(particles.colorA) })
    // gui.addColor(particles, 'colorB').onChange(() => { particles.material.uniforms.uColorB.value.set(particles.colorB) })
    // gui.add(particles.material.uniforms.uProgress, 'value').min(0).max(1).step(0.001).name('uProgress').listen()

    // Scroll controls - Adjust these values directly in the code:
    // scrollControls.sensitivity: 0.1 = very sensitive, 1.0 = less sensitive
    // scrollControls.throttleTime: 10 = very responsive, 100 = less responsive  
    // scrollControls.transitionDuration: 1000 = fast transitions, 5000 = slow transitions
})

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update time uniform for wave animation
    if (particles) {
        particles.material.uniforms.uTime.value = elapsedTime
        
        // Add automatic rotation - oscillate between -5and 5 degrees on Y-axis
        const rotationSpeed = 0.5 // Speed of rotation oscillation
        const rotationAmplitude =5* Math.PI / 180 // Convert 5 degrees to radians
        const rotationY = Math.sin(elapsedTime * rotationSpeed) * rotationAmplitude
        
        // Apply rotation to the particles
        particles.points.rotation.y = rotationY
    }

    // Update controls
    // controls.update() // Removed as controls are disabled

    // Render normal scene
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

// Initialize text animation for the first model
updateTextAnimations(0)

// Move the particle models to different viewport positions for each model
const moveModelsToViewport = (modelIndex) => {
    if (!particles) return
    
    const viewportPositions = [
        { x: 4, y: 0, z: 0 },     // Brain - right side
        { x: -4, y: 0, z: 0 },    // Monkey - left side  
        { x: 0, y: -2, z: 0 },    // Text - bottom
        { x: 4, y: 0, z: 0 }      // DNA - right side
    ]
    
    const targetPosition = viewportPositions[modelIndex]
    
    // Animate the particle system movement
    gsap.to(particles.points.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 2,
        ease: 'power2.inOut'
    })
}

tick()