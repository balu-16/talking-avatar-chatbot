import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Create a procedural 3D head with morph targets for visemes
function createHeadGeometry() {
  // Create a sphere for the head
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  
  // Create morph targets for different visemes
  const positions = geometry.attributes.position;
  const vertexCount = positions.count;
  
  // Helper to create morph target
  const createMorph = (modifyFn) => {
    const morphPositions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const [mx, my, mz] = modifyFn(x, y, z);
      morphPositions[i * 3] = mx;
      morphPositions[i * 3 + 1] = my;
      morphPositions[i * 3 + 2] = mz;
    }
    return morphPositions;
  };
  
  // Viseme morph targets - modify mouth area (y < -0.3, z > 0.5)
  const visemeTargets = {
    // "ah" - open mouth wide
    viseme_aa: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 1.1, y - 0.15, z * 1.05];
      }
      return [0, 0, 0];
    }),
    // "ee" - spread lips
    viseme_I: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 1.2, y + 0.05, z * 1.02];
      }
      return [0, 0, 0];
    }),
    // "oh" - round lips
    viseme_O: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 0.8, y - 0.1, z * 1.1];
      }
      return [0, 0, 0];
    }),
    // "oo" - tight round
    viseme_U: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 0.6, y - 0.05, z * 1.15];
      }
      return [0, 0, 0];
    }),
    // "f/v" - lower lip to teeth
    viseme_FF: createMorph((x, y, z) => {
      if (y < -0.1 && y > -0.5 && z > 0.3) {
        return [x, y + 0.08, z * 1.03];
      }
      return [0, 0, 0];
    }),
    // "l" - tongue up
    viseme_nn: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.3) {
        return [x, y + 0.05, z * 1.05];
      }
      return [0, 0, 0];
    }),
    // "b/m/p" - lips closed
    viseme_PP: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 0.9, y + 0.1, z * 0.95];
      }
      return [0, 0, 0];
    }),
    // "s/z" - teeth together
    viseme_SS: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 1.05, y + 0.06, z * 1.01];
      }
      return [0, 0, 0];
    }),
    // "th" - tongue between teeth
    viseme_TH: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.4) {
        return [x, y + 0.03, z * 1.08];
      }
      return [0, 0, 0];
    }),
    // "k/g" - back of tongue
    viseme_kk: createMorph((x, y, z) => {
      if (y < -0.3 && z > 0.2) {
        return [x, y + 0.04, z * 1.02];
      }
      return [0, 0, 0];
    }),
    // "r" - lips rounded slightly
    viseme_RR: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 0.95, y - 0.03, z * 1.04];
      }
      return [0, 0, 0];
    }),
    // "e" - slightly open
    viseme_E: createMorph((x, y, z) => {
      if (y < -0.2 && z > 0.3 && Math.abs(x) < 0.5) {
        return [x * 1.1, y - 0.05, z * 1.03];
      }
      return [0, 0, 0];
    }),
  };
  
  // Add morph targets to geometry
  Object.entries(visemeTargets).forEach(([name, positions]) => {
    geometry.morphAttributes.position = geometry.morphAttributes.position || [];
    const target = new THREE.Float32BufferAttribute(positions, 3);
    target.name = name;
    geometry.morphAttributes.position.push(target);
  });
  
  return geometry;
}

// Create face features (eyes, eyebrows, nose)
function createFaceFeatures() {
  return {
    // Eyes
    leftEye: { position: [-0.35, 0.15, 0.85], scale: [0.12, 0.08, 0.05] },
    rightEye: { position: [0.35, 0.15, 0.85], scale: [0.12, 0.08, 0.05] },
    // Eyebrows
    leftBrow: { position: [-0.35, 0.35, 0.82], scale: [0.2, 0.03, 0.02] },
    rightBrow: { position: [0.35, 0.35, 0.82], scale: [0.2, 0.03, 0.02] },
    // Nose
    nose: { position: [0, -0.05, 0.95], scale: [0.08, 0.12, 0.06] },
  };
}

export default function Avatar3D({ visemes, sentiment, isSpeaking, onVisemeUpdate }) {
  const headRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const leftBrowRef = useRef();
  const rightBrowRef = useRef();
  const mouthRef = useRef();
  
  const geometry = useMemo(() => createHeadGeometry(), []);
  const features = useMemo(() => createFaceFeatures(), []);
  
  // Blinking state
  const blinkRef = useRef({ nextBlink: 2, blinking: false, blinkProgress: 0 });
  
  // Current viseme state
  const visemeState = useRef({
    currentViseme: null,
    targetWeight: 0,
    currentWeight: 0,
    visemeIndex: 0,
    startTime: 0,
  });
  
  // Update visemes when speaking
  useEffect(() => {
    if (visemes && visemes.length > 0) {
      visemeState.current.visemeIndex = 0;
      visemeState.current.startTime = Date.now();
    }
  }, [visemes]);
  
  useFrame((state, delta) => {
    if (!headRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // --- Blinking ---
    const blink = blinkRef.current;
    blink.nextBlink -= delta;
    
    if (blink.nextBlink <= 0 && !blink.blinking) {
      blink.blinking = true;
      blink.blinkProgress = 0;
    }
    
    if (blink.blinking) {
      blink.blinkProgress += delta * 8;
      const blinkValue = Math.sin(blink.blinkProgress * Math.PI);
      
      if (leftEyeRef.current) {
        leftEyeRef.current.scale.y = 0.08 * (1 - blinkValue * 0.8);
      }
      if (rightEyeRef.current) {
        rightEyeRef.current.scale.y = 0.08 * (1 - blinkValue * 0.8);
      }
      
      if (blink.blinkProgress >= 1) {
        blink.blinking = false;
        blink.nextBlink = 1.5 + Math.random() * 3;
      }
    }
    
    // --- Lip Sync (Visemes) ---
    if (isSpeaking && visemes && visemes.length > 0) {
      const vs = visemeState.current;
      const elapsed = (Date.now() - vs.startTime) / 1000;
      
      // Find current viseme based on time
      while (vs.visemeIndex < visemes.length - 1 && 
             visemes[vs.visemeIndex + 1].time <= elapsed) {
        vs.visemeIndex++;
      }
      
      const current = visemes[vs.visemeIndex];
      if (current && current.weight > 0) {
        // Reset all morph targets
        const morphInfluences = headRef.current.morphTargetInfluences;
        if (morphInfluences) {
          for (let i = 0; i < morphInfluences.length; i++) {
            morphInfluences[i] = 0;
          }
          
          // Find and set the correct viseme
          const morphDict = headRef.current.morphTargetDictionary;
          if (morphDict && current.viseme in morphDict) {
            morphInfluences[morphDict[current.viseme]] = current.weight;
          }
        }
      }
    } else {
      // Reset mouth when not speaking
      if (headRef.current.morphTargetInfluences) {
        for (let i = 0; i < headRef.current.morphTargetInfluences.length; i++) {
          headRef.current.morphTargetInfluences[i] *= 0.9; // Smooth fade out
        }
      }
    }
    
    // --- Facial Expressions based on sentiment ---
    if (leftBrowRef.current && rightBrowRef.current) {
      let browY = 0.35;
      let browAngle = 0;
      
      switch (sentiment) {
        case 'happy':
          browY = 0.38;
          browAngle = 0.1;
          break;
        case 'sad':
          browY = 0.32;
          browAngle = -0.1;
          break;
        case 'thinking':
          browY = 0.4;
          browAngle = 0.15;
          break;
        default:
          browY = 0.35;
          browAngle = 0;
      }
      
      leftBrowRef.current.position.y = browY + Math.sin(time * 0.5) * 0.01;
      rightBrowRef.current.position.y = browY + Math.sin(time * 0.5 + 0.5) * 0.01;
      leftBrowRef.current.rotation.z = browAngle;
      rightBrowRef.current.rotation.z = -browAngle;
    }
    
    // --- Subtle head movement ---
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.3) * 0.05;
      headRef.current.rotation.x = Math.sin(time * 0.2) * 0.03;
      
      // More movement when speaking
      if (isSpeaking) {
        headRef.current.rotation.y += Math.sin(time * 1.5) * 0.08;
        headRef.current.rotation.x += Math.sin(time * 1.2) * 0.05;
      }
    }
  });
  
  return (
    <group>
      {/* Head */}
      <mesh ref={headRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#f5d0a9"
          roughness={0.7}
          metalness={0.1}
          morphTargets={true}
        />
      </mesh>
      
      {/* Left Eye */}
      <mesh ref={leftEyeRef} position={features.leftEye.position} scale={features.leftEye.scale}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      
      {/* Right Eye */}
      <mesh ref={rightEyeRef} position={features.rightEye.position} scale={features.rightEye.scale}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      
      {/* Left Pupil */}
      <mesh position={[-0.35, 0.15, 0.9]} scale={[0.06, 0.06, 0.03]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#2c1810" />
      </mesh>
      
      {/* Right Pupil */}
      <mesh position={[0.35, 0.15, 0.9]} scale={[0.06, 0.06, 0.03]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#2c1810" />
      </mesh>
      
      {/* Left Eyebrow */}
      <mesh ref={leftBrowRef} position={features.leftBrow.position} scale={features.leftBrow.scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5c3a1e" />
      </mesh>
      
      {/* Right Eyebrow */}
      <mesh ref={rightBrowRef} position={features.rightBrow.position} scale={features.rightBrow.scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5c3a1e" />
      </mesh>
      
      {/* Nose */}
      <mesh position={features.nose.position} scale={features.nose.scale}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#e8b88a" roughness={0.8} />
      </mesh>
      
      {/* Mouth (darker area for when mouth opens) */}
      <mesh position={[0, -0.35, 0.85]} scale={[0.25, 0.08, 0.05]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#8b4513" roughness={0.9} />
      </mesh>
      
      {/* Hair */}
      <mesh position={[0, 0.6, 0.2]} scale={[1.1, 0.4, 0.9]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial color="#2c1810" roughness={0.9} />
      </mesh>
      
      {/* Neck */}
      <mesh position={[0, -1.1, 0]} scale={[0.3, 0.3, 0.3]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#f5d0a9" roughness={0.7} />
      </mesh>
    </group>
  );
}
