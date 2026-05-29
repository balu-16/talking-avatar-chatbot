import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Build a proper parametric humanoid face mesh ─────────────────────
function createFaceGeometry() {
  const segments = 64;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Parametric face surface function
  function facePoint(u, v) {
    // u: 0..1 left-right (-1..1)
    // v: 0..1 bottom-top (-1.2..1.2)
    const angle = (u - 0.5) * Math.PI; // -PI/2..PI/2
    const phi = (v - 0.5) * Math.PI;   // -PI/2..PI/2

    const nx = Math.sin(angle);
    const ny = Math.sin(phi);
    const nz = Math.cos(angle) * Math.cos(phi);

    // Base head shape (ellipsoid)
    let x = nx * 0.78;
    let y = ny * 0.95;
    let z = nz * 0.75;

    // Flatten back of head
    if (z < -0.2) {
      z = -0.2 + (z + 0.2) * 0.4;
    }

    // Jaw shaping - wider at cheeks, narrower at chin
    if (y < -0.2) {
      const jawT = (-y - 0.2) / 0.75;
      x *= 1.0 - jawT * 0.25;
      // Chin protrusion
      if (Math.abs(x) < 0.3) {
        z += (1 - jawT) * 0.05 * (1 - Math.abs(x) / 0.3);
      }
    }

    // Forehead - slightly wider and rounder
    if (y > 0.3) {
      const foreheadT = (y - 0.3) / 0.65;
      x *= 1.0 + foreheadT * 0.05;
      z += foreheadT * 0.02;
    }

    // Cheekbones - slight outward bulge
    if (y > -0.1 && y < 0.2 && Math.abs(x) > 0.3) {
      z += 0.04 * (1 - Math.abs(y - 0.05) / 0.15);
    }

    // Nose bridge and nose protrusion
    if (Math.abs(x) < 0.15 && y > -0.25 && y < 0.15) {
      const noseT = (y + 0.25) / 0.4;
      const noseWidth = 1 - Math.abs(x) / 0.15;
      if (z > 0.3) {
        z += noseWidth * 0.12 * (1 - noseT) * (0.3 + noseT * 0.7);
        // Nose tip
        if (y < -0.05 && y > -0.2 && noseWidth > 0.3) {
          z += noseWidth * 0.06 * (1 - Math.abs(y + 0.1) / 0.1);
        }
      }
    }

    // Brow ridge
    if (y > 0.15 && y < 0.35 && Math.abs(x) > 0.1 && Math.abs(x) < 0.45 && z > 0.4) {
      z += 0.04 * (1 - Math.abs(y - 0.25) / 0.1);
    }

    // Eye sockets - depressions
    if (y > 0.0 && y < 0.22 && Math.abs(x) > 0.15 && Math.abs(x) < 0.45) {
      const eyeDepth = 1 - Math.pow(Math.abs(y - 0.11) / 0.11, 2);
      const eyeWidth = 1 - Math.pow((Math.abs(x) - 0.3) / 0.15, 2);
      if (eyeDepth > 0 && eyeWidth > 0 && z > 0.4) {
        z -= eyeDepth * eyeWidth * 0.06;
      }
    }

    // Mouth area - slight depression
    if (Math.abs(x) < 0.25 && y < -0.2 && y > -0.45 && z > 0.5) {
      const mouthDepth = 1 - Math.pow(Math.abs(x) / 0.25, 2);
      const mouthHeight = 1 - Math.pow((y + 0.325) / 0.125, 2);
      if (mouthDepth > 0 && mouthHeight > 0) {
        z -= mouthDepth * mouthHeight * 0.02;
      }
    }

    // Ears - slight bumps on sides
    if (Math.abs(x) > 0.65 && y > -0.1 && y < 0.2) {
      const earT = (Math.abs(x) - 0.65) / 0.13;
      x += Math.sign(x) * earT * 0.05;
      if (earT > 0 && earT < 0.8) {
        z += 0.03 * (1 - Math.abs(y - 0.05) / 0.15);
      }
    }

    return [x, y, z];
  }

  // Generate vertices
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const v = j / segments;
      const [x, y, z] = facePoint(u, v);
      positions.push(x, y, z);

      // Approximate normal via finite differences
      const eps = 0.001;
      const [xu, yu, zu] = facePoint(Math.min(1, u + eps), v);
      const [xv, yv, zv] = facePoint(u, Math.min(1, v + eps));
      const tu = new THREE.Vector3(xu - x, yu - y, zu - z);
      const tv = new THREE.Vector3(xv - x, yv - y, zv - z);
      const n = new THREE.Vector3().crossVectors(tv, tu).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(u, v);
    }
  }

  // Generate indices
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// ── Add morph targets to the geometry ────────────────────────────────
function addMorphTargets(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const basePos = pos.array.slice();

  function morph(fn) {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = basePos[i * 3], y = basePos[i * 3 + 1], z = basePos[i * 3 + 2];
      const [dx, dy, dz] = fn(x, y, z);
      arr[i * 3] = dx;
      arr[i * 3 + 1] = dy;
      arr[i * 3 + 2] = dz;
    }
    return arr;
  }

  // Region checkers
  const isMouthArea = (x, y, z) => z > 0.5 && y > -0.5 && y < -0.15 && Math.abs(x) < 0.3;
  const isUpperLip = (x, y, z) => isMouthArea(x, y, z) && y > -0.25;
  const isLowerLip = (x, y, z) => isMouthArea(x, y, z) && y < -0.25;
  const isMouthCenter = (x, y, z) => isMouthArea(x, y, z) && Math.abs(x) < 0.15;
  const isLeftMouth = (x, y, z) => isMouthArea(x, y, z) && x < -0.1;
  const isRightMouth = (x, y, z) => isMouthArea(x, y, z) && x > 0.1;
  const isEyeArea = (x, y, z) => z > 0.5 && y > 0.0 && y < 0.22 && Math.abs(x) > 0.15 && Math.abs(x) < 0.5;
  const isBrowArea = (x, y, z) => z > 0.5 && y > 0.2 && y < 0.4 && Math.abs(x) > 0.1 && Math.abs(x) < 0.5;
  const isNoseArea = (x, y, z) => z > 0.5 && Math.abs(x) < 0.12 && y > -0.25 && y < 0.1;

  const targets = {};

  // ── Visemes (lip sync) ──

  // viseme_sil: silence / closed mouth
  targets.viseme_sil = morph((x, y, z) => [0, 0, 0]);

  // viseme_PP: p/b/m - lips pressed together
  targets.viseme_PP = morph((x, y, z) => {
    if (isUpperLip(x, y, z)) return [0, -0.03, 0.01];
    if (isLowerLip(x, y, z)) return [0, 0.03, 0.01];
    return [0, 0, 0];
  });

  // viseme_FF: f/v - lower lip to upper teeth
  targets.viseme_FF = morph((x, y, z) => {
    if (isUpperLip(x, y, z)) return [0, -0.01, 0.015];
    if (isLowerLip(x, y, z) && y > -0.35) return [0, 0.04, 0.02];
    return [0, 0, 0];
  });

  // viseme_TH: th - tongue between teeth
  targets.viseme_TH = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const openAmt = Math.max(0, 1 - Math.abs(y + 0.3) / 0.12);
      const center = Math.max(0, 1 - Math.abs(x) / 0.18);
      return [0, openAmt * center * 0.015, center * 0.02];
    }
    return [0, 0, 0];
  });

  // viseme_DD: d/t/n/l - tongue at alveolar ridge
  targets.viseme_DD = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const openAmt = Math.max(0, 1 - Math.abs(y + 0.32) / 0.15);
      const center = Math.max(0, 1 - Math.abs(x) / 0.2);
      return [0, -openAmt * center * 0.01, center * 0.015];
    }
    return [0, 0, 0];
  });

  // viseme_kk: k/g/ng - back of tongue
  targets.viseme_kk = morph((x, y, z) => {
    if (isMouthArea(x, y, z) && Math.abs(x) < 0.2) {
      return [0, 0, 0.012];
    }
    return [0, 0, 0];
  });

  // viseme_CH: ch/j/sh/zh - affricate
  targets.viseme_CH = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const openAmt = Math.max(0, 1 - Math.abs(x) / 0.2);
      return [openAmt * 0.01, -openAmt * 0.01, 0.018];
    }
    return [0, 0, 0];
  });

  // viseme_SS: s/z - teeth close together
  targets.viseme_SS = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const center = Math.max(0, 1 - Math.abs(x) / 0.22);
      return [center * 0.008, 0, center * 0.012];
    }
    return [0, 0, 0];
  });

  // viseme_nn: n/l - tongue tip up
  targets.viseme_nn = morph((x, y, z) => {
    if (isMouthArea(x, y, z) && Math.abs(x) < 0.15) {
      return [0, -0.005, 0.015];
    }
    return [0, 0, 0];
  });

  // viseme_RR: r - lips slightly rounded, tongue back
  targets.viseme_RR = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const center = Math.max(0, 1 - Math.abs(x) / 0.25);
      const openAmt = Math.max(0, 1 - Math.abs(y + 0.3) / 0.15);
      return [-Math.sign(x) * center * 0.005, -openAmt * 0.005, center * 0.02];
    }
    return [0, 0, 0];
  });

  // viseme_aa: a/ah - open wide
  targets.viseme_aa = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const openFactor = Math.max(0, 1 - Math.abs(x) / 0.28);
      if (y < -0.25) {
        return [0, -0.04 * openFactor, 0.02 * openFactor];
      }
      if (y > -0.2) {
        return [0, 0.01 * openFactor, 0.01 * openFactor];
      }
    }
    return [0, 0, 0];
  });

  // viseme_E: e/eh - medium open, spread
  targets.viseme_E = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const spreadFactor = Math.max(0, 1 - Math.abs(x) / 0.3);
      if (isLowerLip(x, y, z)) {
        return [0, -0.025 * spreadFactor, 0.015 * spreadFactor];
      }
      return [Math.sign(x) * 0.008, 0, 0.01];
    }
    return [0, 0, 0];
  });

  // viseme_I: i/ee - spread wide, small opening
  targets.viseme_I = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const spreadFactor = Math.max(0, 1 - Math.abs(x) / 0.3);
      if (isLowerLip(x, y, z)) {
        return [Math.sign(x) * 0.012, -0.015 * spreadFactor, 0.01];
      }
      return [Math.sign(x) * 0.01, 0, 0.008];
    }
    return [0, 0, 0];
  });

  // viseme_O: o/oh - rounded, open
  targets.viseme_O = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const roundFactor = Math.max(0, 1 - Math.abs(x) / 0.22);
      const verticalOpen = Math.max(0, 1 - Math.abs(y + 0.3) / 0.15);
      return [
        -Math.sign(x) * roundFactor * 0.01,
        -verticalOpen * 0.03,
        roundFactor * 0.025
      ];
    }
    return [0, 0, 0];
  });

  // viseme_U: oo - tight round
  targets.viseme_U = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      const roundFactor = Math.max(0, 1 - Math.abs(x) / 0.18);
      const verticalOpen = Math.max(0, 1 - Math.abs(y + 0.3) / 0.1);
      return [
        -Math.sign(x) * roundFactor * 0.015,
        -verticalOpen * 0.018,
        roundFactor * 0.02
      ];
    }
    return [0, 0, 0];
  });

  // ── Facial expressions ──

  // smile: raise cheeks, pull lip corners up
  targets.smile = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      // Corners of mouth up
      if (y > -0.3 && (isLeftMouth(x, y, z) || isRightMouth(x, y, z))) {
        return [0, 0.025, 0.01];
      }
      // Slight upper lip raise
      if (isUpperLip(x, y, z) && Math.abs(x) < 0.15) {
        return [0, 0.008, 0.005];
      }
    }
    // Cheeks raise
    if (y > -0.05 && y < 0.15 && Math.abs(x) > 0.2 && Math.abs(x) < 0.5 && z > 0.55) {
      return [0, 0.015, 0.008];
    }
    // Crow's feet / squint
    if (isEyeArea(x, y, z) && Math.abs(x) > 0.35) {
      return [0, -0.008, 0];
    }
    return [0, 0, 0];
  });

  // sad: pull lip corners down, inner brows up
  targets.sad = morph((x, y, z) => {
    if (isMouthArea(x, y, z)) {
      if (y > -0.3 && (isLeftMouth(x, y, z) || isRightMouth(x, y, z))) {
        return [0, -0.02, 0];
      }
    }
    // Inner brows up
    if (isBrowArea(x, y, z) && Math.abs(x) < 0.3) {
      return [0, 0.02, 0];
    }
    return [0, 0, 0];
  });

  // surprise: brows up, mouth open
  targets.surprise = morph((x, y, z) => {
    if (isBrowArea(x, y, z)) {
      return [0, 0.035, 0.01];
    }
    if (isMouthArea(x, y, z)) {
      return [0, -0.03, 0.02];
    }
    return [0, 0, 0];
  });

  // think: one brow raised, slight lip purse
  targets.think = morph((x, y, z) => {
    if (isBrowArea(x, y, z) && x > 0) {
      return [0, 0.03, 0.01];
    }
    if (isMouthArea(x, y, z) && Math.abs(x) < 0.12) {
      return [Math.sign(x) * 0.005, 0.005, 0.01];
    }
    return [0, 0, 0];
  });

  // Add all morph targets
  const morphAttrs = [];
  for (const [name, arr] of Object.entries(targets)) {
    const attr = new THREE.Float32BufferAttribute(arr, 3);
    attr.name = name;
    morphAttrs.push(attr);
  }
  geometry.morphAttributes.position = morphAttrs;

  // Store target names
  geometry.userData.morphTargetNames = Object.keys(targets);

  return geometry;
}

// ── Eye component ────────────────────────────────────────────────────
function Eye({ position, lookTargetRef, blinkAmount }) {
  const irisRef = useRef();

  // Track look direction
  useFrame(() => {
    if (irisRef.current && lookTargetRef.current) {
      const tx = lookTargetRef.current.x * 0.04;
      const ty = lookTargetRef.current.y * 0.03;
      irisRef.current.position.x = tx;
      irisRef.current.position.y = ty;
    }
  });

  const scaleY = 1 - blinkAmount * 0.85;

  return (
    <group position={position} scale={[1, scaleY, 1]}>
      {/* Sclera (white of eye) */}
      <mesh>
        <sphereGeometry args={[0.095, 24, 24]} />
        <meshStandardMaterial color="#f8f4f0" roughness={0.3} metalness={0.05} />
      </mesh>

      {/* Iris */}
      <group ref={irisRef}>
        <mesh position={[0, 0, 0.07]}>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshStandardMaterial color="#4a2c17" roughness={0.4} metalness={0.1} />
        </mesh>

        {/* Pupil */}
        <mesh position={[0, 0, 0.1]}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Iris ring (detail) */}
        <mesh position={[0, 0, 0.075]}>
          <ringGeometry args={[0.042, 0.055, 24]} />
          <meshStandardMaterial color="#6b3a1f" roughness={0.5} side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>

        {/* Light reflection */}
        <mesh position={[0.02, 0.02, 0.11]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Upper eyelid */}
      <mesh position={[0, 0.06, 0.04]} scale={[1.2, 0.5, 1]} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e8c9a8" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Lower eyelid */}
      <mesh position={[0, -0.055, 0.04]} scale={[1.2, 0.4, 1]} rotation={[-0.3, 0, Math.PI]}>
        <sphereGeometry args={[0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#e8c9a8" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Eyebrow component ────────────────────────────────────────────────
const Eyebrow = React.forwardRef(function Eyebrow({ position, rotation, color }, ref) {
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <boxGeometry args={[0.18, 0.022, 0.025]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
});

// ── Nose component ───────────────────────────────────────────────────
function Nose({ position }) {
  return (
    <group position={position}>
      {/* Nose bridge */}
      <mesh position={[0, 0.05, 0.02]} scale={[0.06, 0.1, 0.04]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#e0b896" roughness={0.75} />
      </mesh>
      {/* Nose tip */}
      <mesh position={[0, -0.02, 0.04]} scale={[0.055, 0.04, 0.04]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#ddb88a" roughness={0.8} />
      </mesh>
      {/* Nostrils */}
      <mesh position={[-0.03, -0.03, 0.03]} scale={[0.025, 0.02, 0.02]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#c49668" roughness={0.9} />
      </mesh>
      <mesh position={[0.03, -0.03, 0.03]} scale={[0.025, 0.02, 0.02]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#c49668" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Mouth component (controlled from parent via ref) ─────────────────
function Mouth({ visemeWeightsRef, smileWeightRef }) {
  const upperLipRef = useRef();
  const lowerLipRef = useRef();
  const mouthOpenRef = useRef();

  useFrame(() => {
    const vw = visemeWeightsRef.current || {};
    const sw = smileWeightRef.current || 0;

    // Compute mouth opening from visemes
    let openAmount = 0.003; // resting
    let lipSpread = 0;
    let roundness = 0;

    openAmount += (vw.viseme_aa || 0) * 0.06;
    openAmount += (vw.viseme_O || 0) * 0.045;
    openAmount += (vw.viseme_U || 0) * 0.03;
    openAmount += (vw.viseme_E || 0) * 0.025;
    openAmount += (vw.viseme_I || 0) * 0.015;
    openAmount += (vw.viseme_FF || 0) * 0.02;
    openAmount += (vw.viseme_TH || 0) * 0.015;
    openAmount += (vw.viseme_DD || 0) * 0.012;
    openAmount += (vw.viseme_CH || 0) * 0.018;
    openAmount += (vw.viseme_RR || 0) * 0.012;

    lipSpread += (vw.viseme_I || 0) * 0.03;
    lipSpread += (vw.viseme_E || 0) * 0.02;
    roundness += (vw.viseme_O || 0) * 0.025;
    roundness += (vw.viseme_U || 0) * 0.035;

    // PP closes lips
    openAmount -= (vw.viseme_PP || 0) * 0.003;

    openAmount += sw * 0.008;

    if (upperLipRef.current) {
      upperLipRef.current.position.y = openAmount * 0.4;
      upperLipRef.current.scale.x = 1 + lipSpread - roundness * 0.3;
    }
    if (lowerLipRef.current) {
      lowerLipRef.current.position.y = -openAmount;
      lowerLipRef.current.scale.x = 1 + lipSpread * 0.5 - roundness * 0.2;
      lowerLipRef.current.scale.y = 1 + Math.max(0, openAmount) * 5;
    }
    if (mouthOpenRef.current) {
      const openScale = Math.max(0.001, openAmount * 8);
      mouthOpenRef.current.scale.y = openScale;
      mouthOpenRef.current.scale.x = 1 + lipSpread - roundness * 0.3;
    }
  });

  return (
    <group position={[0, -0.32, 0.7]}>
      {/* Upper lip */}
      <mesh ref={upperLipRef}>
        <boxGeometry args={[0.14, 0.025, 0.03]} />
        <meshStandardMaterial color="#c47a5a" roughness={0.6} />
      </mesh>

      {/* Lower lip */}
      <mesh ref={lowerLipRef} position={[0, -0.01, 0]}>
        <boxGeometry args={[0.13, 0.028, 0.035]} />
        <meshStandardMaterial color="#b86b4e" roughness={0.55} />
      </mesh>

      {/* Mouth interior (dark) */}
      <mesh ref={mouthOpenRef} position={[0, -0.005, -0.01]} scale={[0.1, 0.001, 0.02]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#2a0f0a" roughness={0.95} />
      </mesh>

      {/* Teeth (upper) */}
      <mesh position={[0, 0.005, 0.02]}>
        <boxGeometry args={[0.1, 0.015, 0.008]} />
        <meshStandardMaterial color="#f0ebe0" roughness={0.4} />
      </mesh>
    </group>
  );
}

// ── Main Avatar Component ────────────────────────────────────────────
export default function Avatar3D({ visemes, sentiment, isSpeaking }) {
  const headRef = useRef();
  const leftBrowRef = useRef();
  const rightBrowRef = useRef();
  const leftEyeRef = useRef();

  const geometry = useMemo(() => {
    const geo = createFaceGeometry();
    addMorphTargets(geo);
    return geo;
  }, []);

  // Blinking state
  const blinkState = useRef({ timer: 2.5, blinking: false, progress: 0, blinkAmount: 0 });

  // Viseme playback state
  const visemeState = useRef({ index: 0, startTime: 0 });

  // Refs for mouth component communication
  const visemeWeightsRef = useRef({});
  const smileWeightRef = useRef(0);

  // Head movement targets
  const headTarget = useRef({ x: 0, y: 0, z: 0 });
  const lookTarget = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (visemes && visemes.length > 0) {
      visemeState.current.index = 0;
      visemeState.current.startTime = performance.now();
    }
  }, [visemes]);

  // Map viseme names to morph target indices
  const visemeMapping = useMemo(() => {
    const names = geometry.userData.morphTargetNames || [];
    const map = {};
    names.forEach((n, i) => { map[n] = i; });
    return map;
  }, [geometry]);

  useFrame((state, delta) => {
    if (!headRef.current) return;
    const time = state.clock.getElapsedTime();
    const morphInfluences = headRef.current.morphTargetInfluences;
    if (!morphInfluences) return;

    // Reset all morph targets
    for (let i = 0; i < morphInfluences.length; i++) {
      morphInfluences[i] *= 0.85; // smooth decay
    }

    // ── Blinking ──
    const blink = blinkState.current;
    blink.timer -= delta;
    if (blink.timer <= 0 && !blink.blinking) {
      blink.blinking = true;
      blink.progress = 0;
    }
    if (blink.blinking) {
      blink.progress += delta * 10;
      blink.blinkAmount = Math.sin(blink.progress * Math.PI);
      if (blink.progress >= 1) {
        blink.blinking = false;
        blink.timer = 2 + Math.random() * 4;
        blink.blinkAmount = 0;
      }
    }

    // ── Viseme lip sync ──
    const vw = {};
    if (isSpeaking && visemes && visemes.length > 0) {
      const vs = visemeState.current;
      const elapsed = (performance.now() - vs.startTime) / 1000;

      // Find current viseme
      while (vs.index < visemes.length - 1 && visemes[vs.index + 1].time <= elapsed) {
        vs.index++;
      }

      const current = visemes[vs.index];
      const next = visemes[vs.index + 1];

      if (current) {
        let weight = current.weight || 1;

        // Interpolate between visemes for smooth transitions
        if (next && next.time > current.time) {
          const t = (elapsed - current.time) / (next.time - current.time);
          const blend = Math.max(0, Math.min(1, t));
          weight *= (1 - blend);
        }

        // Apply viseme morph target
        const visemeName = current.viseme;
        if (visemeName && visemeName in visemeMapping) {
          const idx = visemeMapping[visemeName];
          morphInfluences[idx] = Math.max(morphInfluences[idx], weight);
        }

        // Collect weights for mouth component
        vw[visemeName] = weight;
      }
    }

    // ── Sentiment / expression morphs ──
    let smileWeight = 0;
    if (sentiment === 'happy') {
      const idx = visemeMapping.smile;
      if (idx !== undefined) {
        morphInfluences[idx] = 0.6;
        smileWeight = 0.6;
      }
    } else if (sentiment === 'sad') {
      const idx = visemeMapping.sad;
      if (idx !== undefined) morphInfluences[idx] = 0.5;
    } else if (sentiment === 'thinking') {
      const idx = visemeMapping.think;
      if (idx !== undefined) morphInfluences[idx] = 0.4;
    } else if (sentiment === 'surprise') {
      const idx = visemeMapping.surprise;
      if (idx !== undefined) morphInfluences[idx] = 0.5;
    }

    // ── Subtle head movement ──
    if (isSpeaking) {
      headTarget.current.y = Math.sin(time * 1.2) * 0.08;
      headTarget.current.x = Math.sin(time * 0.8) * 0.04;
      headTarget.current.z = Math.cos(time * 0.9) * 0.02;
      lookTarget.current.x = Math.sin(time * 0.7) * 0.5;
      lookTarget.current.y = Math.cos(time * 0.5) * 0.3;
    } else {
      headTarget.current.y = Math.sin(time * 0.25) * 0.04;
      headTarget.current.x = Math.sin(time * 0.15) * 0.02;
      headTarget.current.z = 0;
      lookTarget.current.x = Math.sin(time * 0.1) * 0.2;
      lookTarget.current.y = Math.cos(time * 0.08) * 0.1;
    }

    // Smooth lerp head rotation
    headRef.current.rotation.y += (headTarget.current.y - headRef.current.rotation.y) * 3 * delta;
    headRef.current.rotation.x += (headTarget.current.x - headRef.current.rotation.x) * 3 * delta;

    // ── Eyebrow movement ──
    if (leftBrowRef.current && rightBrowRef.current) {
      let browY = 0.27;
      let browInnerUp = 0;

      if (sentiment === 'happy') { browY = 0.29; }
      else if (sentiment === 'sad') { browY = 0.25; browInnerUp = 0.02; }
      else if (sentiment === 'thinking') { browY = 0.3; }
      else if (sentiment === 'surprise') { browY = 0.32; }

      // Subtle brow movement during speech
      if (isSpeaking) {
        browY += Math.sin(time * 2) * 0.008;
      }

      leftBrowRef.current.position.y = browY + browInnerUp;
      rightBrowRef.current.position.y = browY + browInnerUp;
      leftBrowRef.current.position.x = -0.22 - browInnerUp * 0.5;
      rightBrowRef.current.position.x = 0.22 + browInnerUp * 0.5;
    }

    // Update refs for mouth component
    visemeWeightsRef.current = vw;
    smileWeightRef.current = smileWeight;
  });

  return (
    <group position={[0, 0.1, 0]}>
      {/* Head mesh with morph targets */}
      <mesh ref={headRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          color="#e8c9a8"
          roughness={0.65}
          metalness={0.02}
          morphTargets={true}
        />
      </mesh>

      {/* Left Eye */}
      <group ref={leftEyeRef}>
        <Eye
          position={[-0.22, 0.11, 0.65]}
          lookTargetRef={lookTarget}
          blinkAmount={blinkState.current.blinkAmount}
        />
      </group>

      {/* Right Eye */}
      <group>
        <Eye
          position={[0.22, 0.11, 0.65]}
          lookTargetRef={lookTarget}
          blinkAmount={blinkState.current.blinkAmount}
        />
      </group>

      {/* Left Eyebrow */}
      <Eyebrow
        position={[-0.22, 0.27, 0.68]}
        rotation={[0, 0, 0.08]}
        color="#5c3a1e"
        ref={leftBrowRef}
      />

      {/* Right Eyebrow */}
      <Eyebrow
        position={[0.22, 0.27, 0.68]}
        rotation={[0, 0, -0.08]}
        color="#5c3a1e"
        ref={rightBrowRef}
      />

      {/* Nose */}
      <Nose position={[0, -0.05, 0.72]} />

      {/* Mouth with lip sync */}
      <Mouth visemeWeightsRef={visemeWeightsRef} smileWeightRef={smileWeightRef} />

      {/* Hair */}
      <Hair />

      {/* Ears */}
      <Ear position={[-0.72, 0.05, 0.1]} side="left" />
      <Ear position={[0.72, 0.05, 0.1]} side="right" />

      {/* Neck */}
      <mesh position={[0, -0.95, -0.1]} scale={[0.22, 0.25, 0.2]}>
        <cylinderGeometry args={[1, 0.9, 1, 16]} />
        <meshStandardMaterial color="#dbb896" roughness={0.7} />
      </mesh>

      {/* Shoulders hint */}
      <mesh position={[0, -1.15, -0.15]} scale={[0.7, 0.12, 0.3]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshStandardMaterial color="#6f4e37" roughness={0.8} />
      </mesh>

      {/* Clothing neckline */}
      <mesh position={[0, -1.05, -0.05]} scale={[0.35, 0.08, 0.25]}>
        <cylinderGeometry args={[1, 1.1, 1, 16]} />
        <meshStandardMaterial color="#8b6f5c" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ── Hair Component ───────────────────────────────────────────────────
function Hair() {
  return (
    <group>
      {/* Main hair volume */}
      <mesh position={[0, 0.45, -0.05]} scale={[0.82, 0.45, 0.72]}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#3a2010" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Hair sides */}
      <mesh position={[-0.55, 0.15, 0.05]} scale={[0.2, 0.4, 0.3]} rotation={[0, 0, 0.3]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#3a2010" roughness={0.95} />
      </mesh>
      <mesh position={[0.55, 0.15, 0.05]} scale={[0.2, 0.4, 0.3]} rotation={[0, 0, -0.3]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#3a2010" roughness={0.95} />
      </mesh>

      {/* Hair top (volume) */}
      <mesh position={[0, 0.55, 0.15]} scale={[0.65, 0.2, 0.5]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#4a2c17" roughness={0.9} />
      </mesh>

      {/* Hair fringe / bangs */}
      <mesh position={[0, 0.35, 0.5]} scale={[0.55, 0.12, 0.2]} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#3a2010" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ── Ear Component ────────────────────────────────────────────────────
function Ear({ position, side }) {
  const rotY = side === 'left' ? 0.3 : -0.3;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh scale={[0.04, 0.08, 0.05]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color="#dbb896" roughness={0.7} />
      </mesh>
      <mesh scale={[0.025, 0.05, 0.02]} position={[side === 'left' ? -0.005 : 0.005, 0, 0.015]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#c49668" roughness={0.8} />
      </mesh>
    </group>
  );
}
