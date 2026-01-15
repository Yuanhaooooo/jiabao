
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float, Html } from '@react-three/drei';
import { ExperienceState } from '../types';

const PARTICLE_COUNT = 15000;
const STAR_17_COUNT = 17;

const Star17: React.FC<{ index: number; state: ExperienceState }> = ({ index, state }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  
  // Create a cluster of stars that stays relatively close
  const initialPos = useMemo(() => {
    // Cluster them around a tighter radius
    const r = 3 + Math.random() * 4; 
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  }, []);

  const color = useMemo(() => {
    // Vivid rainbow colors
    const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
    return colors[index % colors.length];
  }, [index]);

  useFrame((stateObj) => {
    if (!meshRef.current) return;
    const time = stateObj.clock.getElapsedTime();
    
    // Scale up in final scene
    const targetScale = state === 'GIFT_OPEN' ? 1.2 : 0;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
    
    // Subtle cluster movement: stay near each other
    const driftX = Math.sin(time * 0.2 + index * 0.5) * 0.1;
    const driftY = Math.cos(time * 0.15 + index * 0.5) * 0.1;
    const driftZ = Math.sin(time * 0.25 + index * 0.5) * 0.1;
    
    meshRef.current.position.set(
      initialPos.x + driftX,
      initialPos.y + driftY,
      initialPos.z + driftZ
    );

    if (lightRef.current) {
        lightRef.current.intensity = 2 + Math.sin(time * 2 + index) * 1.5;
    }
  });

  if (state !== 'GIFT_OPEN') return null;

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={meshRef} position={initialPos}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={8} transparent opacity={0.9} />
        <pointLight ref={lightRef} intensity={3} color={color} distance={15} />
        <Html 
          position={[0.2, 0.2, 0]} 
          center 
          distanceFactor={10} 
          className="pointer-events-none select-none"
        >
          <div className="text-white font-pixel text-[12px] opacity-70 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
            {index}
          </div>
        </Html>
      </mesh>
    </Float>
  );
};

interface ParticleSystemProps {
  state: ExperienceState;
  progress: number;
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({ state, progress }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  const { galaxyPos, cakePos, colors, randomDirs } = useMemo(() => {
    const galaxy = new Float32Array(PARTICLE_COUNT * 3);
    const cake = new Float32Array(PARTICLE_COUNT * 3);
    const cols = new Float32Array(PARTICLE_COUNT * 3);
    const dirs = new Float32Array(PARTICLE_COUNT * 3);
    
    const colorGold = new THREE.Color("#ca8a04");
    const colorWhite = new THREE.Color("#ffffff");

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 1. Galaxy
      const radius = 3 + Math.random() * 12;
      const angle = i * 0.05 + (Math.random() - 0.5) * 4;
      galaxy[i * 3] = Math.cos(angle) * radius;
      galaxy[i * 3 + 1] = (Math.random() - 0.5) * 5;
      galaxy[i * 3 + 2] = Math.sin(angle) * radius;

      // 2. Cake
      const tier = Math.random();
      let r, h, yOffset;
      if (tier < 0.4) {
        r = 2.8 * Math.sqrt(Math.random());
        h = Math.random() * 1.2;
        yOffset = -1.2;
      } else if (tier < 0.75) {
        r = 2.1 * Math.sqrt(Math.random());
        h = Math.random() * 0.9;
        yOffset = 0.2;
      } else {
        r = 1.4 * Math.sqrt(Math.random());
        h = Math.random() * 0.7;
        yOffset = 1.2;
      }
      const phi = Math.random() * Math.PI * 2;
      cake[i * 3] = Math.cos(phi) * r;
      cake[i * 3 + 1] = yOffset + h;
      cake[i * 3 + 2] = Math.sin(phi) * r;

      const theta = Math.random() * Math.PI * 2;
      const zeta = Math.acos(2 * Math.random() - 1);
      dirs[i * 3] = Math.sin(zeta) * Math.cos(theta);
      dirs[i * 3 + 1] = Math.sin(zeta) * Math.sin(theta);
      dirs[i * 3 + 2] = Math.cos(zeta);

      const mix = Math.random();
      const finalColor = colorGold.clone().lerp(colorWhite, mix * 0.3);
      cols[i * 3] = finalColor.r;
      cols[i * 3 + 1] = finalColor.g;
      cols[i * 3 + 2] = finalColor.b;
    }

    return { galaxyPos: galaxy, cakePos: cake, colors: cols, randomDirs: dirs };
  }, []);

  useFrame((clockState) => {
    if (!pointsRef.current) return;
    const { clock } = clockState;
    const time = clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    // Global Rainbow Color Cycle
    if (materialRef.current) {
      materialRef.current.color.setHSL((time * 0.08) % 1, 0.8, 0.5);
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      let tx = galaxyPos[idx];
      let ty = galaxyPos[idx + 1];
      let tz = galaxyPos[idx + 2];
      
      let lerpSpeed = 0.04;

      switch(state) {
        case 'IDLE':
        case 'LISTENING':
          lerpSpeed = 0.04;
          tx *= 1 + Math.sin(time * 0.4 + i * 0.001) * 0.05;
          break;
        case 'COUNTDOWN':
          // Countdown: Expand then shrink
          // 0.0 -> 0.3: Expand (scale factor 1 -> 3)
          // 0.3 -> 1.0: Shrink to 0
          if (progress < 0.3) {
            const expProgress = progress / 0.3; // 0 to 1
            const scale = 1 + expProgress * 3;
            tx *= scale;
            ty *= scale;
            tz *= scale;
            lerpSpeed = 0.15;
          } else {
            const shrinkProgress = (progress - 0.3) / 0.7; // 0 to 1
            const shrinkScale = 1 - Math.pow(shrinkProgress, 1.5);
            tx = galaxyPos[idx] * 4 * shrinkScale;
            ty = galaxyPos[idx+1] * 4 * shrinkScale;
            tz = galaxyPos[idx+2] * 4 * shrinkScale;
            lerpSpeed = 0.25;
          }
          break;
        case 'MORPH_CAKE':
          lerpSpeed = 0.2;
          tx = THREE.MathUtils.lerp(0, cakePos[idx], progress);
          ty = THREE.MathUtils.lerp(0, cakePos[idx + 1], progress);
          tz = THREE.MathUtils.lerp(0, cakePos[idx + 2], progress);
          break;
        case 'CANDLES_LIT':
          lerpSpeed = 0.1;
          tx = cakePos[idx];
          ty = cakePos[idx + 1];
          tz = cakePos[idx + 2];
          break;
        case 'BLOW_OUT':
          lerpSpeed = 0.08;
          const topFactor = cakePos[idx + 1] > 0.8 ? 1.5 : 0.5;
          tx = cakePos[idx] + randomDirs[idx] * progress * 4 * topFactor;
          ty = cakePos[idx + 1] + (progress * 6 * topFactor) + Math.sin(time * 3 + i) * 0.3;
          tz = cakePos[idx + 2] + randomDirs[idx + 2] * progress * 4 * topFactor;
          break;
        case 'GIFT_OPEN':
          lerpSpeed = 0.015;
          const driftFactor = 1.5 + Math.sin(time * 0.2) * 0.2;
          tx = cakePos[idx] * driftFactor + randomDirs[idx] * 4;
          ty = (cakePos[idx + 1] * driftFactor) + Math.cos(time * 0.3 + i * 0.01) * 2;
          tz = cakePos[idx + 2] * driftFactor + randomDirs[idx + 2] * 4;
          break;
      }

      positions[idx] = THREE.MathUtils.lerp(positions[idx], tx, lerpSpeed);
      positions[idx + 1] = THREE.MathUtils.lerp(positions[idx + 1], ty, lerpSpeed);
      positions[idx + 2] = THREE.MathUtils.lerp(positions[idx + 2], tz, lerpSpeed);

      const jitter = (state === 'COUNTDOWN' ? progress * 0.2 : 0.003);
      positions[idx] += (Math.random() - 0.5) * jitter;
      positions[idx + 1] += (Math.random() - 0.5) * jitter;
      positions[idx + 2] += (Math.random() - 0.5) * jitter;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Strictly reduced rotation speed
    const rotBase = 0.0007;
    const rotAdd = state === 'COUNTDOWN' ? progress * 0.08 : 0;
    pointsRef.current.rotation.y += rotBase + rotAdd;

    if (materialRef.current) {
      let targetSize = 0.03;
      if (state === 'COUNTDOWN') targetSize = 0.03 + progress * 0.15;
      if (state === 'GIFT_OPEN') targetSize = 0.07;
      materialRef.current.size = THREE.MathUtils.lerp(materialRef.current.size, targetSize, 0.05);
      materialRef.current.opacity = state === 'IDLE' ? 0.6 : 0.85;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={new Float32Array(PARTICLE_COUNT * 3)} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={PARTICLE_COUNT} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial ref={materialRef} size={0.03} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      {Array.from({ length: STAR_17_COUNT }).map((_, i) => (
        <Star17 key={i} index={i} state={state} />
      ))}
    </group>
  );
};

export default ParticleSystem;
