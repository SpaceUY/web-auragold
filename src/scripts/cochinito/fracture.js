// Parte la silueta del cerdito en pedazos de Voronoi. Los puntos se agrupan
// cerca de donde se tocó, para que los pedazos chicos salgan del golpe y los
// grandes de los bordes. Todo trabaja en coordenadas de imagen 0..1.

export function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(polygon) {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
  }
  return Math.abs(area / 2);
}

export function centroid(polygon) {
  let x = 0;
  let y = 0;
  for (const [px, py] of polygon) {
    x += px;
    y += py;
  }
  return [x / polygon.length, y / polygon.length];
}

// Recorta `subject` (puede ser cóncavo) con el semiplano más cercano a `a`
// que a `b`: la mediatriz de los dos puntos.
function clipByBisector(subject, a, b) {
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const c = (b[0] * b[0] + b[1] * b[1] - a[0] * a[0] - a[1] * a[1]) / 2;
  const side = ([x, y]) => c - (nx * x + ny * y);
  const output = [];
  for (let i = 0; i < subject.length; i++) {
    const current = subject[i];
    const previous = subject[(i + subject.length - 1) % subject.length];
    const sc = side(current);
    const sp = side(previous);
    if (sc >= 0) {
      if (sp < 0) output.push(intersect(previous, current, sp, sc));
      output.push(current);
    } else if (sp >= 0) {
      output.push(intersect(previous, current, sp, sc));
    }
  }
  return output;
}

function intersect(p, q, sp, sq) {
  const t = sp / (sp - sq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fracture(contour, impacts, { count = 44, seed = 7 } = {}) {
  const random = seededRandom(seed);
  const xs = contour.map((p) => p[0]);
  const ys = contour.map((p) => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

  const seeds = [];
  let guard = 0;
  while (seeds.length < count && guard++ < count * 40) {
    let point;
    if (impacts.length && random() < 0.55) {
      const [ix, iy] = impacts[Math.floor(random() * impacts.length)];
      const radius = 0.03 + random() * 0.16;
      const angle = random() * Math.PI * 2;
      point = [ix + Math.cos(angle) * radius, iy + Math.sin(angle) * radius];
    } else {
      point = [box[0] + random() * (box[2] - box[0]), box[1] + random() * (box[3] - box[1])];
    }
    if (pointInPolygon(point, contour)) seeds.push(point);
  }

  const shards = [];
  for (const site of seeds) {
    let cell = contour;
    for (const other of seeds) {
      if (other === site) continue;
      cell = clipByBisector(cell, site, other);
      if (cell.length < 3) break;
    }
    if (cell.length >= 3 && polygonArea(cell) > 0.0006) shards.push(cell);
  }
  return shards;
}
