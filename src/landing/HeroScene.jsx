import { useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshTransmissionMaterial, PerformanceMonitor, Text } from '@react-three/drei';
import fontUrl from '@fontsource/inter/files/inter-latin-800-normal.woff?url';

const { damp, smoothstep, clamp } = THREE.MathUtils;
const TEXT_Z = -1.4;
const BLACK = new THREE.Color('#000000');

// The glass shader runs `samples` × 3 (chromatic aberration) texture reads per
// pixel, so pixel ratio and sample count are what decide the frame cost.
// Retina Safari at full DPR with 10 samples was far too slow; these tiers keep
// the look while staying cheap, and PerformanceMonitor drops a tier on
// machines that still can't hold the frame rate.
const TIERS = {
  high: { dpr: 1.25, samples: 5, resolution: 384, segments: [220, 36] },
  low: { dpr: 0.85, samples: 3, resolution: 256, segments: [160, 24] },
};

// Overshooting ease for the intro "pop".
const easeOutBack = x => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function GlassKnot({ progress, reduced, tier }) {
  const ref = useRef(null);
  const spin = useRef(0);
  const viewport = useThree(state => state.viewport);
  const fit = Math.min(0.82, viewport.width / 3.6);

  useFrame((state, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const p = progress.get();
    const t = state.clock.elapsedTime;
    const intro = reduced ? 1 : easeOutBack(clamp((t - 0.15) / 1.4, 0, 1));
    if (!reduced) spin.current += dt * 0.22;

    const { x: px, y: py } = state.pointer;
    mesh.rotation.x = damp(mesh.rotation.x, 0.4 - py * 0.3 + p * 1.6, 3, dt);
    mesh.rotation.y = damp(mesh.rotation.y, spin.current + px * 0.5 + p * Math.PI * 1.25, 3, dt);
    mesh.rotation.z = damp(mesh.rotation.z, p * 0.6, 3, dt);

    const bob = reduced ? 0 : Math.sin(t * 0.9) * 0.06;
    mesh.position.y = damp(mesh.position.y, bob - p * 0.15, 4, dt);
    // Recede while the hero phrases play, so the type stays the focus.
    const recede = 1 - 0.15 * smoothstep(p, 0.1, 0.45);
    mesh.scale.setScalar(Math.max(0.0001, intro * fit * recede));
  });

  return (
    <mesh ref={ref} scale={0.0001}>
      <torusKnotGeometry args={[1, 0.34, ...tier.segments, 2, 3]} />
      <MeshTransmissionMaterial
        thickness={0.55}
        samples={tier.samples}
        resolution={tier.resolution}
        roughness={0.04}
        ior={1.32}
        chromaticAberration={0.16}
        anisotropicBlur={0.06}
        distortion={0.25}
        distortionScale={0.4}
        temporalDistortion={reduced ? 0 : 0.08}
        iridescence={0.7}
        iridescenceIOR={1.25}
        iridescenceThicknessRange={[100, 900]}
        color="#ffffff"
        background={BLACK}
      />
    </mesh>
  );
}

function Wordmark({ progress, reduced }) {
  const ref = useRef(null);
  const { camera, viewport } = useThree();
  const vp = viewport.getCurrentViewport(camera, [0, 0, TEXT_Z]);
  // "Malte" in Inter ExtraBold is ~2.65em wide; fill ~86% of the width, capped by height.
  const fontSize = Math.min((vp.width * 0.86) / 2.65, vp.height * 0.42);

  useFrame((state, dt) => {
    const text = ref.current;
    if (!text) return;
    const p = progress.get();
    const t = state.clock.elapsedTime;
    const intro = reduced ? 1 : smoothstep(t, 0.05, 1.1);
    const out = 1 - smoothstep(p, 0.04, 0.32);
    text.fillOpacity = intro * out;
    text.position.y = damp(text.position.y, (1 - intro) * -0.25 + p * 1.6, 5, dt);
    const s = 0.94 + intro * 0.06 - p * 0.12;
    text.scale.setScalar(s);
  });

  return (
    <Text
      ref={ref}
      font={fontUrl}
      fontSize={fontSize}
      letterSpacing={-0.055}
      anchorX="center"
      anchorY="middle"
      position={[0, 0, TEXT_Z]}
      color="#f5f5f7"
      fillOpacity={0}
    >
      Malte
    </Text>
  );
}

function Lights() {
  // A small studio built from light panels instead of an HDR file:
  // nothing to download, and the reflections stay crisp.
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, -2]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[8, 1.2, 1]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[5, -1, -1]} rotation-y={-Math.PI / 2} scale={[8, 1.2, 1]} />
      <Lightformer form="rect" intensity={5} color="#5ac8fa" position={[-4, 2, 3]} rotation-y={Math.PI / 4} scale={[1, 6, 1]} />
      <Lightformer form="rect" intensity={5} color="#ff6fb1" position={[4, -1, 3]} rotation-y={-Math.PI / 4} scale={[1, 6, 1]} />
      <Lightformer form="circle" intensity={2} color="#ffd66b" position={[0, -5, 1]} rotation-x={-Math.PI / 2} scale={3} />
    </Environment>
  );
}

export default function HeroScene({ progress, active, reduced }) {
  const [tierName, setTierName] = useState(() => (window.innerWidth < 768 ? 'low' : 'high'));
  const tier = TIERS[tierName];

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={Math.min(window.devicePixelRatio || 1, tier.dpr)}
      camera={{ position: [0, 0, 6], fov: 35 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setTierName('low')} flipflops={1} />
      <color attach="background" args={['#000000']} />
      <Wordmark progress={progress} reduced={reduced} />
      <GlassKnot progress={progress} reduced={reduced} tier={tier} />
      <Lights />
    </Canvas>
  );
}
