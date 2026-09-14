"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import * as THREE from "three"

import { HardwareRigShowcase } from "@/components/home/hardware-rig-showcase"

type Vec2Ref = { current: { x: number; y: number } }
type FlagRef = { current: boolean }

interface SceneProps {
  isMobile: boolean
  rotation: Vec2Ref
  velocity: Vec2Ref
  dragging: FlagRef
  scrollProgress: { current: number }
}

/** Detects real WebGL support before we ever mount a <Canvas>. */
function useWebGLSupported() {
  const [supported, setSupported] = useState<boolean | null>(null)
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
      setSupported(Boolean(gl))
    } catch {
      setSupported(false)
    }
  }, [])
  return supported
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)")
    setIsMobile(query.matches)
    const listener = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    query.addEventListener("change", listener)
    return () => query.removeEventListener("change", listener)
  }, [])
  return isMobile
}

/** Pointer-drag rotation with damped inertia, plus a gentle idle spin. */
function useDragRotation() {
  const rotation = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  const handlers = useMemo(
    () => ({
      onPointerDown: (event: { clientX: number; clientY: number }) => {
        dragging.current = true
        last.current = { x: event.clientX, y: event.clientY }
      },
      onPointerMove: (event: { clientX: number; clientY: number }) => {
        if (!dragging.current) return
        const dx = event.clientX - last.current.x
        const dy = event.clientY - last.current.y
        last.current = { x: event.clientX, y: event.clientY }
        velocity.current.x = dx * 0.006
        velocity.current.y = dy * 0.006
      },
      onPointerUp: () => {
        dragging.current = false
      },
      onPointerLeave: () => {
        dragging.current = false
      },
    }),
    []
  )

  return { rotation, velocity, dragging, handlers }
}

/** Normalizes window scroll into a 0-2 range that drives lens swap + mode blend. */
function useScrollProgress() {
  const progress = useRef(0)
  useEffect(() => {
    function onScroll() {
      const raw = window.scrollY / window.innerHeight
      progress.current = THREE.MathUtils.clamp(raw, 0, 2)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return progress
}

const BODY_COLOR = "#3a3a40"
const GRIP_COLOR = "#26262a"
const ACCENT_COLOR = "#5c5c64"

/** Procedural mirrorless camera body built entirely from primitives. */
function CameraBody() {
  return (
    <group>
      {/* main chassis */}
      <RoundedBox args={[1.7, 1.05, 0.62]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={BODY_COLOR} roughness={0.55} metalness={0.35} />
      </RoundedBox>

      {/* pentaprism / viewfinder hump */}
      <mesh position={[-0.2, 0.6, -0.04]}>
        <boxGeometry args={[0.5, 0.16, 0.44]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.5} metalness={0.35} />
      </mesh>

      {/* grip */}
      <RoundedBox
        args={[0.44, 0.86, 0.68]}
        radius={0.13}
        smoothness={4}
        position={[0.66, -0.12, 0.02]}
      >
        <meshStandardMaterial color={GRIP_COLOR} roughness={0.85} metalness={0.1} />
      </RoundedBox>

      {/* grip texture ridges */}
      {[-0.22, -0.08, 0.06].map((y, i) => (
        <mesh key={i} position={[0.78, y, 0.28]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.14, 0.045, 0.03]} />
          <meshStandardMaterial color="#0a0a0b" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* mode dial */}
      <mesh position={[0.42, 0.545, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.05, 24]} />
        <meshStandardMaterial color={ACCENT_COLOR} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* shutter button */}
      <mesh position={[0.68, 0.5, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.045, 16]} />
        <meshStandardMaterial color="#e829f1" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* strap lugs */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.82, 0.15, -0.28]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.055, 0.02, 8, 16]} />
          <meshStandardMaterial color={ACCENT_COLOR} roughness={0.4} metalness={0.7} />
        </mesh>
      ))}

      {/* lens mount ring */}
      <mesh position={[0, -0.05, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.03, 12, 32]} />
        <meshStandardMaterial color="#050505" roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  )
}

interface LensProps {
  length: number
  frontRadius: number
  rearRadius: number
  segments: number
  ringCount: number
}

function Lens({ length, frontRadius, rearRadius, segments, ringCount }: LensProps) {
  return (
    <group position={[0, -0.05, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, 0, length / 2]}>
        <cylinderGeometry args={[frontRadius, rearRadius, length, segments]} />
        <meshStandardMaterial color="#101012" roughness={0.4} metalness={0.5} />
      </mesh>
      {Array.from({ length: ringCount }).map((_, i) => (
        <mesh
          key={i}
          position={[0, 0, (length / (ringCount + 1)) * (i + 1)]}
        >
          <cylinderGeometry
            args={[frontRadius + 0.012, frontRadius + 0.012, 0.03, segments]}
          />
          <meshStandardMaterial color="#050505" roughness={0.7} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0, length]}>
        <cylinderGeometry args={[frontRadius * 0.85, frontRadius * 0.85, 0.02, segments]} />
        <meshStandardMaterial color="#020203" roughness={0.15} metalness={0.9} />
      </mesh>
    </group>
  )
}

const LENSES: LensProps[] = [
  { length: 0.55, frontRadius: 0.3, rearRadius: 0.32, segments: 24, ringCount: 2 },
  { length: 0.95, frontRadius: 0.26, rearRadius: 0.32, segments: 28, ringCount: 3 },
  { length: 1.55, frontRadius: 0.22, rearRadius: 0.32, segments: 32, ringCount: 4 },
]

const LIGHT_MODES = {
  alex: {
    key: new THREE.Color("#a9e2ff"),
    keyIntensity: 2.6,
    rim: new THREE.Color("#e829f1"),
    rimIntensity: 3.2,
    fill: new THREE.Color("#4a5c8a"),
    fillIntensity: 1.1,
    bg: new THREE.Color("#08080d"),
    fogColor: new THREE.Color("#08080d"),
    fogNear: 3,
    fogFar: 8,
  },
  gabe: {
    key: new THREE.Color("#ffc98a"),
    keyIntensity: 3,
    rim: new THREE.Color("#ff6fae"),
    rimIntensity: 2,
    fill: new THREE.Color("#8a4a52"),
    fillIntensity: 1.4,
    bg: new THREE.Color("#160f0d"),
    fogColor: new THREE.Color("#160f0d"),
    fogNear: 3.5,
    fogFar: 11,
  },
}

function SceneContent({ isMobile, rotation, velocity, dragging, scrollProgress }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const keyLightRef = useRef<THREE.DirectionalLight>(null)
  const fillLightRef = useRef<THREE.PointLight>(null)
  const rimLightRef = useRef<THREE.PointLight>(null)
  const modeBlendRef = useRef(0)
  const lensBlendRef = useRef(0)

  useFrame((state, delta) => {
    // --- rotation: damped inertia drag, gentle idle spin ---
    rotation.current.y += velocity.current.x
    rotation.current.x = THREE.MathUtils.clamp(
      rotation.current.x + velocity.current.y,
      -0.5,
      0.5
    )
    if (!dragging.current) {
      velocity.current.x *= 0.9
      velocity.current.y *= 0.9
      if (Math.abs(velocity.current.x) < 0.0006 && Math.abs(velocity.current.y) < 0.0006) {
        rotation.current.y += 0.0018
      }
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        rotation.current.y,
        0.12
      )
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        rotation.current.x,
        0.12
      )
    }

    // --- scroll-driven lens swap + aesthetic mode blend ---
    const target = scrollProgress.current
    lensBlendRef.current = THREE.MathUtils.lerp(lensBlendRef.current, target, 0.08)
    modeBlendRef.current = THREE.MathUtils.lerp(
      modeBlendRef.current,
      THREE.MathUtils.clamp(target / 2, 0, 1),
      0.05
    )

    const alex = LIGHT_MODES.alex
    const gabe = LIGHT_MODES.gabe
    const t = modeBlendRef.current

    if (keyLightRef.current) {
      keyLightRef.current.color.copy(alex.key).lerp(gabe.key, t)
      keyLightRef.current.intensity = THREE.MathUtils.lerp(
        alex.keyIntensity,
        gabe.keyIntensity,
        t
      )
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.copy(alex.fill).lerp(gabe.fill, t)
      fillLightRef.current.intensity = THREE.MathUtils.lerp(
        alex.fillIntensity,
        gabe.fillIntensity,
        t
      )
    }
    if (rimLightRef.current) {
      rimLightRef.current.color.copy(alex.rim).lerp(gabe.rim, t)
      rimLightRef.current.intensity = THREE.MathUtils.lerp(
        alex.rimIntensity,
        gabe.rimIntensity,
        t
      )
    }
    if (state.scene.background instanceof THREE.Color) {
      state.scene.background.copy(alex.bg).lerp(gabe.bg, t)
    }
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(alex.fogColor).lerp(gabe.fogColor, t)
      state.scene.fog.near = THREE.MathUtils.lerp(alex.fogNear, gabe.fogNear, t)
      state.scene.fog.far = THREE.MathUtils.lerp(alex.fogFar, gabe.fogFar, t)
    }
  })

  return (
    <>
      <color attach="background" args={["#08080d"]} />
      <fog attach="fog" args={["#08080d", 3, 8]} />

      <directionalLight ref={keyLightRef} position={[2.5, 3, 3]} intensity={2.6} />
      <pointLight ref={fillLightRef} position={[-2, -1, 2.5]} intensity={1.1} />
      <pointLight ref={rimLightRef} position={[-1.5, 1, -2.5]} intensity={3.2} />
      <ambientLight intensity={0.45} />

      <group ref={groupRef} position={[0, 0, 0]}>
        <CameraBody />
        {LENSES.map((lens, i) => (
          <LensSlot key={i} index={i} lens={lens} lensBlendRef={lensBlendRef} />
        ))}
      </group>
    </>
  )
}

function LensSlot({
  index,
  lens,
  lensBlendRef,
}: {
  index: number
  lens: LensProps
  lensBlendRef: { current: number }
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const distance = Math.abs(lensBlendRef.current - index)
    const weight = THREE.MathUtils.clamp(1 - distance, 0, 1)
    ref.current.visible = weight > 0.01
    ref.current.scale.setScalar(Math.max(weight, 0.001))
    ref.current.position.x = (1 - weight) * (index < lensBlendRef.current ? -0.4 : 0.4)
  })
  return (
    <group ref={ref}>
      <Lens {...lens} />
    </group>
  )
}

function CanvasFallback() {
  return (
    <div className="flex size-full items-center justify-center">
      <HardwareRigShowcase />
    </div>
  )
}

export function ThreeDHero() {
  const supported = useWebGLSupported()
  const isMobile = useIsMobile()
  const { rotation, velocity, dragging, handlers } = useDragRotation()
  const scrollProgress = useScrollProgress()

  if (supported === false) {
    return <HardwareRigShowcase />
  }

  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-3xl touch-none select-none sm:aspect-[16/10]">
      {supported ? (
        <Canvas
          camera={{ position: [0, 0.15, 3.4], fov: 38 }}
          dpr={[1, isMobile ? 1.5 : 2]}
          shadows={!isMobile}
          {...handlers}
        >
          <Suspense fallback={null}>
            <SceneContent
              isMobile={isMobile}
              rotation={rotation}
              velocity={velocity}
              dragging={dragging}
              scrollProgress={scrollProgress}
            />
          </Suspense>
        </Canvas>
      ) : (
        <CanvasFallback />
      )}
    </div>
  )
}
