// Cochinito de oro: tres toques que lo agrietan y lo hacen crecer, y al
// tercero explota en pedazos 3D con monedas y chispas. Three.js con bloom
// para que la luz que sale de las grietas y las chispas brille de verdad.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { PIG_CONTOUR } from "./contour.js";
import { fracture, centroid, pointInPolygon } from "./fracture.js";
import { playTap, playExplosion, renderAudio } from "./audio.js";

const TAPS_TO_BREAK = 3;
const GROWTH = [1, 1.16, 1.34];
const HINTS = ["Tócalo 3 veces para romperlo", "¡Otra vez!", "Una más…"];
const REDIRECT_DELAY_MS = 2400;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// ?capture=1 maneja el tiempo desde afuera, cuadro por cuadro, para grabar el video.
const capture = new URLSearchParams(location.search).has("capture");

const ui = {
  body: document.body,
  hit: document.getElementById("hit"),
  hintText: document.getElementById("hint-text"),
  dots: [...document.querySelectorAll(".dots i")],
  reveal: document.getElementById("reveal"),
  revealTitle: document.getElementById("reveal-title"),
  cta: document.getElementById("cta"),
};

// El link de destino ya viene armado desde la página (invitación con código, o registro).
// Al explotar, el cochinito lleva ahí solo; el botón queda por si la redirección no corre.
function goToDestination() {
  if (capture || !ui.cta?.href) return;
  setTimeout(() => location.assign(ui.cta.href), reducedMotion ? 1200 : REDIRECT_DELAY_MS);
}

// ── Escena ──

const canvas = document.getElementById("stage");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch {
  startFallback();
}

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff1d6, 2.4);
  key.position.set(3, 4, 6);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Fondo: el halo navy del producto, que se enciende a medida que se carga.
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: {
        uNavy: { value: new THREE.Color("#2c3a57") },
        uGold: { value: new THREE.Color("#f2b334") },
        uBlack: { value: new THREE.Color("#090909") },
        uCenter: { value: new THREE.Vector2(0, 0) },
        uEnergy: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uNavy, uGold, uBlack;
        uniform vec2 uCenter;
        uniform float uEnergy;
        varying vec3 vWorld;
        void main() {
          float d = length(vWorld.xy - uCenter) / (4.2 + uEnergy * 1.2);
          vec3 color = mix(uBlack, uNavy * (0.85 + uEnergy * 0.2), smoothstep(1.0, 0.0, d));
          color += uGold * smoothstep(0.55, 0.0, d) * (0.02 + uEnergy * 0.025);
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  background.position.z = -6;
  scene.add(background);

  // ── El cochinito ──

  const loader = new THREE.TextureLoader();
  const pigTexture = loader.load("/images/cochinito/cerdito.webp", onTextureReady);
  pigTexture.colorSpace = THREE.SRGBColorSpace;
  pigTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Grietas: rojo es el trazo fino, verde el halo de luz alrededor.
  const crackCanvas = document.createElement("canvas");
  crackCanvas.width = crackCanvas.height = 1024;
  const crackContext = crackCanvas.getContext("2d");
  const crackTexture = new THREE.CanvasTexture(crackCanvas);

  const pigMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: pigTexture },
      crackMap: { value: crackTexture },
      uGlow: { value: 0 },
      uHeat: { value: 0 },
      uSweep: { value: -1 },
      uBulge: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uBulge;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += uBulge * (1.0 - smoothstep(0.0, 0.6, length(uv - 0.5)));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map, crackMap;
      uniform float uGlow, uHeat, uSweep;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.01) discard;
        vec3 color = tex.rgb;
        float luma = dot(color, vec3(0.299, 0.587, 0.114));

        // Reflejo que cruza el oro en diagonal.
        float band = exp(-pow((vUv.x - vUv.y) * 0.7 + 0.35 - uSweep, 2.0) * 70.0);
        color += band * luma * vec3(1.0, 0.92, 0.75) * 1.1;

        // Calor: el oro se pone más brillante a medida que se carga.
        color *= 1.0 + uHeat * 0.12;

        vec4 crack = texture2D(crackMap, vUv);
        vec3 light = vec3(1.0, 0.74, 0.32);
        color += light * crack.g * uGlow * 0.35;
        color = mix(color, light * 3.5, crack.r * min(uGlow, 1.0));

        gl_FragColor = vec4(color, tex.a);
        #include <colorspace_fragment>
      }`,
  });

  const pig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 48), pigMaterial);
  const pigRoot = new THREE.Group();
  pigRoot.add(pig);
  scene.add(pigRoot);

  // Alfa del render, para que las grietas no se salgan del cerdito.
  let alphaData;
  const ALPHA_SIZE = 256;
  function onTextureReady(texture) {
    const sample = document.createElement("canvas");
    sample.width = sample.height = ALPHA_SIZE;
    const context = sample.getContext("2d", { willReadFrequently: true });
    context.drawImage(texture.image, 0, 0, ALPHA_SIZE, ALPHA_SIZE);
    alphaData = context.getImageData(0, 0, ALPHA_SIZE, ALPHA_SIZE).data;
    // Dos cuadros después ya está dibujado en WebGL: recién ahí se oculta la imagen fija.
    requestAnimationFrame(() => requestAnimationFrame(() => ui.hit.classList.add("is-ready")));
  }
  function alphaAt(u, v) {
    if (!alphaData || u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
    const x = Math.floor(u * ALPHA_SIZE);
    const y = Math.floor(v * ALPHA_SIZE);
    return alphaData[(y * ALPHA_SIZE + x) * 4 + 3] / 255;
  }

  function drawCracks(origin, step) {
    const branches = 3 + step * 3;
    const strokes = [];
    const grow = (start, angle, length, depth) => {
      const points = [start];
      let [u, v] = start;
      let travelled = 0;
      while (travelled < length) {
        angle += (Math.random() - 0.5) * 0.9;
        const segment = 0.008 + Math.random() * 0.012;
        u += Math.cos(angle) * segment;
        v += Math.sin(angle) * segment;
        travelled += segment;
        if (alphaAt(u, v) < 0.5) break;
        points.push([u, v]);
        if (depth < 2 && Math.random() < 0.08) grow([u, v], angle + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random()), length * 0.45, depth + 1);
      }
      strokes.push({ points, width: depth === 0 ? 3.2 : 2 });
    };
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2 + Math.random() * 0.6;
      grow(origin, angle, 0.09 + step * 0.1 + Math.random() * 0.08, 0);
    }
    const ctx = crackContext;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    for (const pass of ["halo", "core"]) {
      for (const { points, width } of strokes) {
        if (points.length < 2) continue;
        ctx.beginPath();
        points.forEach(([u, v], i) => (i ? ctx.lineTo(u * 1024, v * 1024) : ctx.moveTo(u * 1024, v * 1024)));
        // shadowBlur y no ctx.filter: Safari no soporta filtros en canvas.
        if (pass === "halo") {
          ctx.strokeStyle = "rgba(0,255,0,0.22)";
          ctx.lineWidth = width * 3;
          ctx.shadowColor = "rgb(0,255,0)";
          ctx.shadowBlur = 14;
        } else {
          ctx.strokeStyle = "rgb(255,0,0)";
          ctx.lineWidth = width;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    crackTexture.needsUpdate = true;
  }

  // ── Chispas ──

  const SPARKS = reducedMotion ? 120 : 700;
  const sparkPositions = new Float32Array(SPARKS * 3);
  const sparkColors = new Float32Array(SPARKS * 3);
  const sparks = Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), heat: 1 }));
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute("color", new THREE.BufferAttribute(sparkColors, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    size: 0.07,
    map: softDot(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);
  let sparkCursor = 0;

  function emitSparks(origin, count, speed, spread = 1) {
    for (let i = 0; i < count; i++) {
      const spark = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARKS;
      const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, (Math.random() - 0.2) * spread).normalize();
      spark.p.copy(origin);
      spark.v.copy(direction).multiplyScalar(speed * (0.35 + Math.random()));
      spark.max = spark.life = 0.5 + Math.random() * 0.9;
      spark.heat = 1 + Math.random() * 1.4;
    }
  }

  // ── Monedas ──

  const COINS = reducedMotion ? 16 : 64;
  const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffc04a, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
  const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.16, 48), coinMaterial, COINS);
  coinMesh.frustumCulled = false;
  coinMesh.count = 0;
  scene.add(coinMesh);
  const coins = Array.from({ length: COINS }, () => ({
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    w: new THREE.Vector3(),
    size: 1,
  }));
  const dummy = new THREE.Object3D();

  // ── Pedazos ──

  const shardGroup = new THREE.Group();
  scene.add(shardGroup);
  const shardFace = new THREE.MeshBasicMaterial({ map: pigTexture, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
  const shardEdge = new THREE.MeshStandardMaterial({ color: 0xe9a52c, metalness: 1, roughness: 0.3, transparent: true, envMapIntensity: 1.4 });
  let shards = [];

  // ── Onda expansiva y destello ──

  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uColor: { value: new THREE.Color(1.8, 1.25, 0.6) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float r = uProgress;
          float ring = smoothstep(r - 0.12, r, d) * (1.0 - smoothstep(r, r + 0.015, d));
          float core = (1.0 - smoothstep(0.0, 0.5 + r * 0.6, d)) * pow(1.0 - r, 3.0);
          float alpha = (ring * 0.7 + core * 0.35) * (1.0 - r);
          gl_FragColor = vec4(uColor * alpha, alpha);
        }`,
    }),
  );
  ring.visible = false;
  scene.add(ring);

  // ── Resortes ──

  const spring = (value, stiffness, damping) => ({ value, target: value, velocity: 0, stiffness, damping });
  const springs = {
    scale: spring(1, 170, 14),
    squash: spring(0, 420, 11),
    wobble: spring(0, 260, 9),
    glow: spring(0, 60, 12),
    heat: spring(0, 40, 10),
    energy: spring(0, 30, 9),
  };
  function stepSpring(s, dt) {
    const force = (s.target - s.value) * s.stiffness - s.velocity * s.damping;
    s.velocity += force * dt;
    s.value += s.velocity * dt;
  }

  // ── Estado ──

  let taps = 0;
  let phase = "idle"; // idle → charging → exploded
  let phaseTime = 0;
  let shake = 0;
  let sweepStart = -10;
  let pigSize = 2.6;
  const impacts = [];
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();

  function layout() {
    const width = innerWidth;
    const height = innerHeight;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const viewHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const viewWidth = viewHeight * camera.aspect;
    const rect = ui.hit.getBoundingClientRect();
    pigSize = (rect.width / width) * viewWidth;
    const centerY = (0.5 - (rect.top + rect.height / 2) / height) * viewHeight;
    pigRoot.position.set(0, centerY, 0);
    pig.scale.setScalar(pigSize);
    ring.position.set(0, centerY, 0.5);
    background.material.uniforms.uCenter.value.set(0, centerY);
  }
  addEventListener("resize", layout);
  layout();

  addEventListener("pointermove", (event) => {
    pointer.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  });

  // Toque → punto de la imagen. Con teclado no hay posición: se elige uno al azar.
  const raycaster = new THREE.Raycaster();
  function impactFrom(event) {
    if (event.detail !== 0 && event.clientX !== undefined) {
      raycaster.setFromCamera(
        new THREE.Vector2((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1),
        camera,
      );
      const hit = raycaster.intersectObject(pig)[0];
      if (hit?.uv && alphaAt(hit.uv.x, 1 - hit.uv.y) > 0.5) return [hit.uv.x, 1 - hit.uv.y];
    }
    for (let i = 0; i < 200; i++) {
      const candidate = [0.25 + Math.random() * 0.5, 0.3 + Math.random() * 0.45];
      if (pointInPolygon(candidate, PIG_CONTOUR)) return candidate;
    }
    return [0.5, 0.55];
  }

  function imageToWorld([u, v], z = 0.05) {
    return pig.localToWorld(new THREE.Vector3(u - 0.5, 0.5 - v, z));
  }

  ui.hit.addEventListener("click", (event) => {
    if (phase !== "idle") return;
    const impact = impactFrom(event);
    impacts.push(impact);
    taps += 1;
    ui.dots.forEach((dot, i) => dot.classList.toggle("on", i < taps));
    navigator.vibrate?.(taps === TAPS_TO_BREAK ? [30, 40, 90] : 12 + taps * 10);
    if (capture) showTouch(event);

    if (taps < TAPS_TO_BREAK) {
      playTap(taps - 1);
      drawCracks(impact, taps - 1);
      springs.scale.target = GROWTH[taps];
      springs.squash.velocity += 5.5;
      springs.wobble.velocity += (Math.random() < 0.5 ? -1 : 1) * 4;
      springs.glow.target = taps === 1 ? 0.65 : 1;
      springs.heat.target = taps * 0.18;
      springs.energy.target = taps * 0.35;
      shake = reducedMotion ? 0 : 0.06 + taps * 0.03;
      sweepStart = clock.elapsedTime;
      emitSparks(imageToWorld(impact), 26 + taps * 14, 2.2 + taps);
      const remaining = TAPS_TO_BREAK - taps;
      ui.hintText.textContent = HINTS[taps];
      ui.hit.setAttribute("aria-label", `Romper el cochinito. ${remaining === 1 ? "Falta 1 toque" : `Faltan ${remaining} toques`}.`);
    } else {
      playTap(2);
      drawCracks(impact, 3);
      phase = "charging";
      phaseTime = 0;
      springs.scale.target = 1.55;
      springs.scale.stiffness = 90;
      springs.glow.target = 1;
      springs.heat.target = 1;
      springs.energy.target = 1.4;
      ui.hit.disabled = true;
    }
  });


  function explode() {
    phase = "exploded";
    phaseTime = 0;
    playExplosion();
    pig.visible = false;
    shake = reducedMotion ? 0 : 0.45;
    ui.body.classList.add("is-broken");

    const origin = pigRoot.position.clone();
    const scale = springs.scale.value;
    const size = pigSize * scale;
    const [cu, cv] = impacts[impacts.length - 1];
    const blast = new THREE.Vector2((cu - 0.5) * size, (0.5 - cv) * size);

    // Pedazos con espesor: la cara lleva el render, el canto es oro metálico.
    const uvGenerator = {
      generateTopUV(geometry, vertices, a, b, c) {
        return [a, b, c].map((i) => new THREE.Vector2(vertices[i * 3] / size + 0.5, vertices[i * 3 + 1] / size + 0.5));
      },
      generateSideWallUV() {
        return [0, 0, 0, 0].map(() => new THREE.Vector2());
      },
    };
    shardFace.color.setScalar(1.5);
    shardFace.opacity = shardEdge.opacity = 1;
    for (const polygon of fracture(PIG_CONTOUR, impacts, { count: reducedMotion ? 14 : 46, seed: Date.now() })) {
      const shape = new THREE.Shape(polygon.map(([u, v]) => new THREE.Vector2((u - 0.5) * size, (0.5 - v) * size)));
      const depth = size * 0.045;
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: size * 0.008,
        bevelSize: size * 0.006,
        bevelSegments: 2,
        UVGenerator: uvGenerator,
      });
      const [u, v] = centroid(polygon);
      const local = new THREE.Vector2((u - 0.5) * size, (0.5 - v) * size);
      geometry.translate(-local.x, -local.y, -depth / 2);
      const mesh = new THREE.Mesh(geometry, [shardFace, shardEdge]);
      mesh.position.set(origin.x + local.x, origin.y + local.y, 0);
      const away = local.clone().sub(blast);
      const distance = away.length();
      away.normalize();
      const speed = (3.2 + Math.random() * 4.5) * (size / 3) * (1.3 - Math.min(distance / size, 1) * 0.5);
      shardGroup.add(mesh);
      shards.push({
        mesh,
        v: new THREE.Vector3(away.x * speed, away.y * speed + 2.2 * (size / 3), 1 + Math.random() * 3),
        w: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6),
      });
    }

    coinMesh.count = COINS;
    coins.forEach((coin) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.5 + Math.random() * 6) * (size / 3);
      coin.p.set(origin.x + (Math.random() - 0.5) * size * 0.3, origin.y + (Math.random() - 0.5) * size * 0.2, 0);
      coin.v.set(Math.cos(angle) * speed, Math.abs(Math.sin(angle)) * speed + 3.5 * (size / 3), 0.3 + Math.random() * 2);
      coin.q.setFromEuler(new THREE.Euler(Math.PI / 2 + (Math.random() - 0.5), Math.random() * Math.PI, 0));
      coin.w.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 16);
      coin.size = size * (0.04 + Math.random() * 0.025);
    });

    emitSparks(new THREE.Vector3(origin.x + blast.x, origin.y + blast.y, 0.2), reducedMotion ? 60 : 300, 7 * (size / 3), 1.6);
    ring.visible = true;
    ring.scale.setScalar(size * 3.2);
    ring.material.uniforms.uProgress.value = 0;
    springs.energy.target = 0.25;
    springs.energy.velocity = 6;

    later(showReveal, reducedMotion ? 150 : 750);
  }

  function showReveal() {
    ui.reveal.hidden = false;
    ui.revealTitle.focus({ preventScroll: true });
    goToDestination();
  }

  // ── Bucle ──

  const clock = capture ? virtualClock() : new THREE.Clock();
  const timers = [];
  function later(callback, ms) {
    if (!capture) return setTimeout(callback, ms);
    timers.push({ at: clock.elapsedTime + ms / 1000, callback });
  }
  const gravity = new THREE.Vector3(0, -15, 0);
  const tmp = new THREE.Vector3();
  const spin = new THREE.Quaternion();

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;
    phaseTime += dt;
    for (const timer of timers.splice(0).filter((item) => item.at > t || (item.callback(), false))) timers.push(timer);
    Object.values(springs).forEach((s) => stepSpring(s, dt));

    if (phase === "charging" && phaseTime > (reducedMotion ? 0.05 : 0.34)) explode();

    // Cochinito: flota, mira al puntero y vibra mientras se carga.
    smoothPointer.lerp(pointer, 1 - Math.exp(-dt * 5));
    const charging = phase === "charging" ? phaseTime / 0.34 : 0;
    const tremble = reducedMotion ? 0 : charging * 0.05 + springs.heat.value * 0.004;
    const s = springs.scale.value;
    const squash = springs.squash.value;
    pig.scale.set(pigSize * s * (1 + squash * 0.12), pigSize * s * (1 - squash * 0.12), 1);
    pig.position.set(
      (Math.random() - 0.5) * tremble * pigSize,
      (reducedMotion ? 0 : Math.sin(t * 1.6) * 0.04 * pigSize) + (Math.random() - 0.5) * tremble * pigSize,
      0,
    );
    pig.rotation.set(-smoothPointer.y * 0.16, smoothPointer.x * 0.22, springs.wobble.value * 0.08 + Math.sin(t * 1.1) * 0.015);
    pigMaterial.uniforms.uBulge.value = squash * 0.12 * pigSize;

    const pulse = 0.82 + 0.18 * Math.sin(t * (6 + charging * 20));
    pigMaterial.uniforms.uGlow.value = Math.max(0, springs.glow.value) * pulse;
    pigMaterial.uniforms.uHeat.value = Math.max(0, springs.heat.value);
    const sinceSweep = t - sweepStart;
    const idleSweep = ((t % 4.2) / 0.9) * 2.4 - 0.7;
    pigMaterial.uniforms.uSweep.value = sinceSweep < 0.7 ? -0.7 + (sinceSweep / 0.7) * 2.4 : idleSweep;
    background.material.uniforms.uEnergy.value = Math.max(0, springs.energy.value);
    bloom.strength = 0.6 + Math.max(0, springs.energy.value) * 0.2;

    // Pedazos.
    for (const shard of shards) {
      shard.v.addScaledVector(gravity, dt * 0.55);
      shard.v.multiplyScalar(Math.exp(-dt * 0.6));
      shard.mesh.position.addScaledVector(shard.v, dt);
      shard.mesh.rotation.x += shard.w.x * dt;
      shard.mesh.rotation.y += shard.w.y * dt;
      shard.mesh.rotation.z += shard.w.z * dt;
    }
    if (phase === "exploded") {
      shardFace.color.setScalar(1 + 0.5 * Math.exp(-phaseTime * 5));
      const fade = THREE.MathUtils.clamp(1 - (phaseTime - 1.1) / 0.9, 0, 1);
      shardFace.opacity = shardEdge.opacity = fade;
      shardGroup.visible = fade > 0;
      ring.material.uniforms.uProgress.value = Math.min(phaseTime / 0.85, 1);
      ring.visible = phaseTime < 0.85;
    }

    // Monedas.
    for (let i = 0; i < coinMesh.count; i++) {
      const coin = coins[i];
      coin.v.addScaledVector(gravity, dt * 0.6);
      coin.p.addScaledVector(coin.v, dt);
      spin.setFromEuler(new THREE.Euler(coin.w.x * dt, coin.w.y * dt, coin.w.z * dt));
      coin.q.multiply(spin);
      dummy.position.copy(coin.p);
      dummy.quaternion.copy(coin.q);
      dummy.scale.set(coin.size, coin.size, coin.size);
      dummy.updateMatrix();
      coinMesh.setMatrixAt(i, dummy.matrix);
    }
    coinMesh.instanceMatrix.needsUpdate = true;

    // Chispas: se apagan con la vida, del blanco al dorado.
    for (let i = 0; i < SPARKS; i++) {
      const spark = sparks[i];
      if (spark.life > 0) {
        spark.life -= dt;
        spark.v.y -= 4 * dt;
        spark.v.multiplyScalar(Math.exp(-dt * 1.8));
        spark.p.addScaledVector(spark.v, dt);
      }
      const k = Math.max(spark.life / spark.max, 0);
      const heat = spark.heat * k;
      sparkPositions.set([spark.p.x, spark.p.y, spark.p.z], i * 3);
      sparkColors.set([heat, heat * (0.55 + k * 0.35), heat * k * 0.35], i * 3);
    }
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.color.needsUpdate = true;

    // Sacudida de cámara.
    shake *= Math.exp(-dt * 7);
    const charge = phase === "charging" && !reducedMotion ? 0.05 : 0;
    tmp.set((Math.random() - 0.5) * (shake + charge), (Math.random() - 0.5) * (shake + charge), 8);
    camera.position.copy(tmp);

    composer.render();
  }

  if (capture) {
    ui.body.classList.add("capture");
    window.__cochinito = {
      step(dt) {
        clock.advance(dt);
        frame();
        syncCssAnimations(clock.elapsedTime);
      },
      ready: () => ui.hit.classList.contains("is-ready"),
      renderAudio,
    };
  } else {
    renderer.setAnimationLoop(frame);
  }
}

function virtualClock() {
  let pending = 0;
  return {
    elapsedTime: 0,
    advance(dt) {
      pending += dt;
    },
    getDelta() {
      const dt = pending;
      pending = 0;
      this.elapsedTime += dt;
      return dt;
    },
  };
}

// Las animaciones CSS también siguen el reloj virtual.
const animationStarts = new WeakMap();
function syncCssAnimations(now) {
  for (const animation of document.getAnimations()) {
    if (!animationStarts.has(animation)) {
      animationStarts.set(animation, now);
      animation.pause();
    }
    animation.currentTime = (now - animationStarts.get(animation)) * 1000;
  }
}

// Marca del dedo en el video.
function showTouch(event) {
  const touch = document.createElement("span");
  touch.className = "touch";
  touch.style.left = `${event.clientX}px`;
  touch.style.top = `${event.clientY}px`;
  document.body.append(touch);
  touch.addEventListener("animationend", () => touch.remove());
}

// Sin WebGL: el mismo recorrido con la imagen plana.
function startFallback() {
  canvas.remove();
  const image = document.getElementById("poster");
  let taps = 0;
  ui.hit.addEventListener("click", () => {
    taps += 1;
    ui.dots.forEach((dot, i) => dot.classList.toggle("on", i < taps));
    playTap(Math.min(taps - 1, 2));
    if (taps < TAPS_TO_BREAK) {
      image.style.transform = `scale(${GROWTH[taps]})`;
      ui.hintText.textContent = HINTS[taps];
      return;
    }
    playExplosion();
    image.style.transform = "scale(1.8)";
    image.style.opacity = "0";
    ui.hit.disabled = true;
    ui.body.classList.add("is-broken");
    setTimeout(() => {
      ui.reveal.hidden = false;
      goToDestination();
    }, 400);
  });
}

function softDot() {
  const size = 64;
  const dot = document.createElement("canvas");
  dot.width = dot.height = size;
  const context = dot.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(dot);
}
