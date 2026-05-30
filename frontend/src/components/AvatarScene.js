import * as THREE from 'three';

/**
 * AvatarScene — Vanilla Three.js 3D human head with lip sync.
 * No React Three Fiber. Pure THREE.WebGLRenderer + requestAnimationFrame.
 */
export default class AvatarScene {
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this._buildLog = [];

    try {
      // ── Renderer ──
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x000000, 0); // transparent
      container.appendChild(this.renderer.domElement);
      this._buildLog.push('renderer ok');

      // ── Scene ──
      this.scene = new THREE.Scene();

      // ── Camera ──
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      this.camera.position.set(0, 0.08, 2.9);
      this.camera.lookAt(0, 0, 0);
      this._buildLog.push('camera ok');

      // ── Lighting ──
      this.scene.add(new THREE.AmbientLight(0xfff5ee, 0.7));
      const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.0);
      keyLight.position.set(3, 5, 5);
      this.scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffe8d0, 0.45);
      fillLight.position.set(-3, 3, 3);
      this.scene.add(fillLight);
      const rimLight = new THREE.PointLight(0xffd4b0, 0.35);
      rimLight.position.set(0, -2, 4);
      this.scene.add(rimLight);
      this._buildLog.push('lights ok, children=' + this.scene.children.length);

      // ── Build avatar ──
      this.headGroup = new THREE.Group();
      this.scene.add(this.headGroup);

      this._buildHead();
      this._buildLog.push('head ok, headGroup.children=' + this.headGroup.children.length);
      this._buildEyes();
      this._buildLog.push('eyes ok');
      this._buildEyebrows();
      this._buildNose();
      this._buildMouth();
      this._buildHair();
      this._buildEars();
      this._buildNeckAndShoulders();
      this._buildLog.push('all features ok, headGroup.children=' + this.headGroup.children.length);
    } catch (e) {
      this._buildLog.push('ERROR: ' + e.message + ' at ' + (e.stack || '').split('\n')[1]);
      console.error('AvatarScene build error:', e);
    }

    // Expose for debugging
    window.__avatarScene = this;
    console.log('AvatarScene build log:', this._buildLog);

    // ── Animation state ──
    this._blinkTimer = 2 + Math.random() * 2;
    this._blinkAmount = 0;
    this._blinking = false;
    this._blinkProgress = 0;

    this._visemes = [];
    this._visemeIndex = 0;
    this._visemeStartTime = 0;
    this._mouthOpen = 0;
    this._mouthSpread = 0;

    this._sentiment = 'neutral';
    this._isSpeaking = false;

    // ── Resize observer ──
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(container);
    this._onResize();

    // ── Start animation loop ──
    this._animate = this._animate.bind(this);
    this._rafId = requestAnimationFrame(this._animate);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BUILD METHODS
  // ═══════════════════════════════════════════════════════════════════

  _buildHead() {
    const geo = new THREE.SphereGeometry(1, 48, 48);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z < -0.3) z = -0.3 + (z + 0.3) * 0.5; // flatten back
      if (y < -0.3) { const t = Math.min(1, (-y - 0.3) / 0.7); x *= 1 - t * 0.2; } // narrow jaw
      if (y > 0.7) y = 0.7 + (y - 0.7) * 0.6; // flatten top
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.65, metalness: 0.02 });
    this.headMesh = new THREE.Mesh(geo, mat);
    this.headGroup.add(this.headMesh);
  }

  _buildEyes() {
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf5f0ea, roughness: 0.3 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.5 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x080808 });
    const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });

    const makeEye = (xPos) => {
      const group = new THREE.Group();
      group.position.set(xPos, 0.12, 0.96);

      // Sclera
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 24), scleraMat);
      group.add(sclera);

      // Iris/pupil sub-group (for gaze)
      const irisGroup = new THREE.Group();
      irisGroup.position.set(0, 0, 0);
      irisGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 20), irisMat));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), pupilMat);
      pupil.position.z = 0.025;
      irisGroup.add(pupil);
      const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), highlightMat);
      highlight.position.set(0.015, 0.015, 0.035);
      irisGroup.add(highlight);
      group.add(irisGroup);

      // Upper eyelid
      const lidGeo = new THREE.SphereGeometry(0.095, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4);
      const lidMat = new THREE.MeshStandardMaterial({ color: 0xdfc0a0, roughness: 0.8, side: THREE.DoubleSide });
      const upperLid = new THREE.Mesh(lidGeo, lidMat);
      upperLid.position.set(0, 0.065, 0.03);
      upperLid.scale.set(1.1, 0.35, 0.9);
      upperLid.rotation.x = 0.25;
      group.add(upperLid);

      this.headGroup.add(group);
      return { group, irisGroup };
    };

    const leftEye = makeEye(-0.25);
    const rightEye = makeEye(0.25);
    this._leftEyeGroup = leftEye.group;
    this._rightEyeGroup = rightEye.group;
    this._leftIris = leftEye.irisGroup;
    this._rightIris = rightEye.irisGroup;
  }

  _buildEyebrows() {
    const browMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 });
    const browGeo = new THREE.BoxGeometry(0.15, 0.025, 0.03);

    this._leftBrow = new THREE.Mesh(browGeo, browMat);
    this._leftBrow.position.set(-0.24, 0.3, 0.95);
    this._leftBrow.rotation.z = 0.05;
    this.headGroup.add(this._leftBrow);

    this._rightBrow = new THREE.Mesh(browGeo, browMat);
    this._rightBrow.position.set(0.24, 0.3, 0.95);
    this._rightBrow.rotation.z = -0.05;
    this.headGroup.add(this._rightBrow);
  }

  _buildNose() {
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, -0.1, 1.02);

    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xddb890, roughness: 0.75 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xd4a880, roughness: 0.8 });
    const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xb8906a, roughness: 0.9 });

    const bridge = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), bridgeMat);
    bridge.scale.set(0.06, 0.12, 0.045);
    bridge.position.set(0, 0.06, 0);
    noseGroup.add(bridge);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), tipMat);
    tip.scale.set(0.07, 0.045, 0.045);
    tip.position.set(0, -0.02, 0.03);
    noseGroup.add(tip);

    const nostrilGeo = new THREE.SphereGeometry(1, 8, 8);
    const nl = new THREE.Mesh(nostrilGeo, nostrilMat);
    nl.scale.set(0.022, 0.018, 0.018);
    nl.position.set(-0.028, -0.04, 0.02);
    noseGroup.add(nl);
    const nr = new THREE.Mesh(nostrilGeo, nostrilMat);
    nr.scale.set(0.022, 0.018, 0.018);
    nr.position.set(0.028, -0.04, 0.02);
    noseGroup.add(nr);

    this.headGroup.add(noseGroup);
  }

  _buildMouth() {
    const upperLipMat = new THREE.MeshStandardMaterial({ color: 0xc07050, roughness: 0.55 });
    const lowerLipMat = new THREE.MeshStandardMaterial({ color: 0xb06040, roughness: 0.5 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 0.95 });
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xeee8dd, roughness: 0.35 });

    // Skin patch behind lips — prevents any dark line showing through when closed
    const lipBackingMat = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.65, metalness: 0.02 });
    this._lipBacking = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.05), lipBackingMat);
    this._lipBacking.position.set(0, -0.33, 0.94);
    this.headGroup.add(this._lipBacking);

    // Upper lip — taller to overlap lower lip when closed
    this._upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), upperLipMat);
    this._upperLip.position.set(0, -0.315, 0.98);
    this.headGroup.add(this._upperLip);

    // Philtrum (groove above upper lip)
    const philtrumMat = new THREE.MeshStandardMaterial({ color: 0xd8b090, roughness: 0.7 });
    const philtrum = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), philtrumMat);
    philtrum.position.set(0, -0.28, 1.0);
    this.headGroup.add(philtrum);

    // Lower lip — positioned to meet upper lip with no gap
    this._lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.04), lowerLipMat);
    this._lowerLip.position.set(0, -0.345, 0.98);
    this.headGroup.add(this._lowerLip);

    // Mouth interior — NOT added to scene. Only added dynamically when speaking.
    this._mouthInterior = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), interiorMat);
    this._mouthInterior.scale.set(0.075, 0.0001, 0.02);
    this._mouthInterior.position.set(0, -0.34, 0.95);

    // Teeth — NOT added to scene. Only added dynamically when speaking.
    this._teeth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.017, 0.008), teethMat);
    this._teeth.position.set(0, -0.325, 0.98);
  }

  _buildHair() {
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a0e06, roughness: 0.95 });
    const hairHighlightMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.9 });

    // Full hair shell — a complete hemisphere covering the top and upper sides of the head
    // theta range 0 to 0.65*PI covers well past the equator for full coverage
    const hairShell = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65),
      hairMat
    );
    hairShell.position.set(0, 0.1, 0.02);
    this.headGroup.add(hairShell);

    // Hair band — thick ring around the hairline to seal any gaps
    const hairBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.08, 8, 32),
      hairMat
    );
    hairBand.position.set(0, 0.0, 0.0);
    hairBand.rotation.x = Math.PI * 0.5;
    hairBand.scale.set(1.05, 1.0, 0.6);
    this.headGroup.add(hairBand);

    // Hair volume on top — fills any gap at the crown
    const volume = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 24, 16),
      hairHighlightMat
    );
    volume.position.set(0, 0.55, 0.0);
    volume.scale.set(1.0, 0.45, 0.9);
    this.headGroup.add(volume);

    // Side hair L — blends into the shell
    const sideL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), hairMat);
    sideL.position.set(-0.62, 0.0, 0.08);
    sideL.scale.set(0.8, 1.4, 1.0);
    this.headGroup.add(sideL);

    // Side hair R
    const sideR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), hairMat);
    sideR.position.set(0.62, 0.0, 0.08);
    sideR.scale.set(0.8, 1.4, 1.0);
    this.headGroup.add(sideR);

    // Fringe — hangs over the forehead
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), hairMat);
    fringe.position.set(0, 0.2, 0.82);
    fringe.scale.set(0.9, 0.15, 0.3);
    this.headGroup.add(fringe);
  }

  _buildEars() {
    const earMat = new THREE.MeshStandardMaterial({ color: 0xdbb896, roughness: 0.7 });
    const earGeo = new THREE.SphereGeometry(1, 12, 12);

    const earL = new THREE.Mesh(earGeo, earMat);
    earL.position.set(-0.78, 0.05, 0.05);
    earL.scale.set(0.04, 0.08, 0.045);
    this.headGroup.add(earL);

    const earR = new THREE.Mesh(earGeo, earMat);
    earR.position.set(0.78, 0.05, 0.05);
    earR.scale.set(0.04, 0.08, 0.045);
    this.headGroup.add(earR);
  }

  _buildNeckAndShoulders() {
    const neckMat = new THREE.MeshStandardMaterial({ color: 0xdbb896, roughness: 0.7 });
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.9, 1, 16), neckMat);
    neck.position.set(0, -1.0, -0.08);
    neck.scale.set(0.24, 0.22, 0.2);
    this.headGroup.add(neck);

    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.8 });
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), shoulderMat);
    shoulders.position.set(0, -1.2, -0.15);
    shoulders.scale.set(0.75, 0.12, 0.3);
    this.headGroup.add(shoulders);

    const collarMat = new THREE.MeshStandardMaterial({ color: 0x8b6f5c, roughness: 0.85 });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 1, 16), collarMat);
    collar.position.set(0, -1.08, 0.0);
    collar.scale.set(0.32, 0.06, 0.22);
    this.headGroup.add(collar);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  setVisemes(visemes) {
    this._visemes = visemes || [];
    this._visemeIndex = 0;
    this._visemeStartTime = performance.now();
  }

  setSentiment(sentiment) {
    this._sentiment = sentiment || 'neutral';
  }

  setSpeaking(isSpeaking) {
    this._isSpeaking = !!isSpeaking;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._rafId);
    this._resizeObserver.disconnect();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    // Dispose all geometries and materials
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════════

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    if (this.disposed) return;
    this._rafId = requestAnimationFrame(this._animate);

    const now = performance.now();
    const time = now / 1000;
    const delta = 1 / 60; // approximate

    // ── Blinking ──
    this._blinkTimer -= delta;
    if (this._blinkTimer <= 0 && !this._blinking) {
      this._blinking = true;
      this._blinkProgress = 0;
    }
    if (this._blinking) {
      this._blinkProgress += delta * 10;
      this._blinkAmount = Math.sin(Math.min(1, this._blinkProgress) * Math.PI);
      if (this._blinkProgress >= 1) {
        this._blinking = false;
        this._blinkAmount = 0;
        this._blinkTimer = 1.5 + Math.random() * 3.5;
      }
    }

    const blinkScale = 1 - this._blinkAmount * 0.85;
    if (this._leftEyeGroup) this._leftEyeGroup.scale.y = blinkScale;
    if (this._rightEyeGroup) this._rightEyeGroup.scale.y = blinkScale;

    // ── Lip sync ──
    let targetOpen = 0;
    let targetSpread = 0;

    if (this._isSpeaking && this._visemes.length > 0) {
      const elapsed = (now - this._visemeStartTime) / 1000;

      while (this._visemeIndex < this._visemes.length - 1 &&
             this._visemes[this._visemeIndex + 1].time <= elapsed) {
        this._visemeIndex++;
      }

      const current = this._visemes[this._visemeIndex];
      if (current) {
        const v = (current.viseme || '').toLowerCase();
        const w = current.weight || 0.8;

        if (v.includes('aa')) { targetOpen = 0.08 * w; }
        else if (v.includes('_o')) { targetOpen = 0.06 * w; }
        else if (v.includes('_u')) { targetOpen = 0.035 * w; }
        else if (v.includes('_e')) { targetOpen = 0.04 * w; targetSpread = 0.4 * w; }
        else if (v.includes('_i')) { targetOpen = 0.025 * w; targetSpread = 0.6 * w; }
        else if (v.includes('pp')) { targetOpen = 0.002; }
        else if (v.includes('ff')) { targetOpen = 0.02 * w; }
        else if (v.includes('th')) { targetOpen = 0.025 * w; }
        else if (v.includes('dd')) { targetOpen = 0.02 * w; }
        else if (v.includes('kk')) { targetOpen = 0.015 * w; }
        else if (v.includes('ch')) { targetOpen = 0.03 * w; targetSpread = 0.2 * w; }
        else if (v.includes('ss')) { targetOpen = 0.012 * w; targetSpread = 0.15 * w; }
        else if (v.includes('nn')) { targetOpen = 0.01 * w; }
        else if (v.includes('rr')) { targetOpen = 0.02 * w; }
        else if (v.includes('sil')) { targetOpen = 0.003; }
        else if (w > 0.1) { targetOpen = 0.03 * w; }
      }
    }

    if (this._sentiment === 'happy') {
      targetSpread += 0.3;
      targetOpen += 0.005;
    }

    // Smooth interpolation
    this._mouthOpen += (targetOpen - this._mouthOpen) * Math.min(1, 12 * delta);
    this._mouthSpread += (targetSpread - this._mouthSpread) * Math.min(1, 10 * delta);

    const open = this._mouthOpen;
    const spread = this._mouthSpread;

    if (this._upperLip) {
      this._upperLip.position.y = -0.315 + open * 0.25;
      this._upperLip.scale.x = 1 + spread * 0.35;
    }
    if (this._lowerLip) {
      this._lowerLip.position.y = -0.345 - open * 0.8;
      this._lowerLip.scale.y = 1 + Math.max(0, open) * 3;
      this._lowerLip.scale.x = 1 + spread * 0.25;
    }
    if (this._mouthInterior) {
      const isOpen = open > 0.008;
      if (isOpen && !this._mouthInterior.parent) {
        this.headGroup.add(this._mouthInterior);
      } else if (!isOpen && this._mouthInterior.parent) {
        this.headGroup.remove(this._mouthInterior);
      }
      if (isOpen) {
        this._mouthInterior.scale.y = open * 4;
        this._mouthInterior.scale.x = 1 + spread * 0.3;
      }
    }
    if (this._teeth) {
      const showTeeth = open > 0.015;
      if (showTeeth && !this._teeth.parent) {
        this.headGroup.add(this._teeth);
      } else if (!showTeeth && this._teeth.parent) {
        this.headGroup.remove(this._teeth);
      }
    }

    // ── Eye gaze ──
    let lookX, lookY;
    if (this._isSpeaking) {
      lookX = Math.sin(time * 0.6) * 0.02;
      lookY = Math.cos(time * 0.4) * 0.015;
    } else {
      lookX = Math.sin(time * 0.08) * 0.01;
      lookY = Math.cos(time * 0.06) * 0.008;
    }
    if (this._leftIris) {
      this._leftIris.position.x = lookX;
      this._leftIris.position.y = lookY;
    }
    if (this._rightIris) {
      this._rightIris.position.x = lookX;
      this._rightIris.position.y = lookY;
    }

    // ── Head movement ──
    if (this.headGroup) {
      if (this._isSpeaking) {
        this.headGroup.rotation.y = Math.sin(time * 1.1) * 0.06;
        this.headGroup.rotation.x = Math.sin(time * 0.7) * 0.035;
      } else {
        this.headGroup.rotation.y = Math.sin(time * 0.2) * 0.03;
        this.headGroup.rotation.x = Math.sin(time * 0.15) * 0.015;
      }
    }

    // ── Eyebrows ──
    if (this._leftBrow && this._rightBrow) {
      let browY = 0.3;
      if (this._sentiment === 'happy') browY = 0.32;
      else if (this._sentiment === 'sad') browY = 0.28;
      else if (this._sentiment === 'thinking') browY = 0.34;
      else if (this._sentiment === 'surprise') browY = 0.36;

      if (this._isSpeaking) browY += Math.sin(time * 1.8) * 0.006;

      this._leftBrow.position.y = browY;
      this._rightBrow.position.y = browY;
      this._leftBrow.rotation.z = this._sentiment === 'sad' ? -0.12 : 0.05;
      this._rightBrow.rotation.z = this._sentiment === 'sad' ? 0.12 : -0.05;
    }

    // ── Render ──
    this.renderer.render(this.scene, this.camera);
  }
}
