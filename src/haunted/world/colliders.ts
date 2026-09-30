/**
 * Colisiones 2D en el plano del suelo (x, z): círculos (árboles, lápidas, faroles), cajas alineadas a los
 * ejes (muros, muebles) y segmentos (cercos, que se reparten en círculos). El fantasma se desliza por los
 * bordes en vez de quedarse pegado.
 */
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export class Colliders {
  circles: Circle[] = [];
  boxes: Box[] = [];
  /** Límites del área [x0, z0, x1, z1]: el jugador no los cruza. */
  bounds: [number, number, number, number] | null = null;

  circle(x: number, z: number, r: number): void {
    this.circles.push({ x, z, r });
  }

  box(x0: number, z0: number, x1: number, z1: number): void {
    this.boxes.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  /** Segmento grueso (cerco, baranda): círculos cada medio radio para que no queden huecos. */
  segment(x0: number, z0: number, x1: number, z1: number, r = 0.22): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / (r * 1.2)));
    for (let i = 0; i <= n; i++) this.circle(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, r);
  }

  clear(): void {
    this.circles = [];
    this.boxes = [];
    this.bounds = null;
  }

  /** Saca al círculo (x, z, radio) de cualquier obstáculo y lo devuelve ya corregido. */
  resolve(x: number, z: number, radius: number): [number, number] {
    for (let pass = 0; pass < 3; pass++) {
      for (const c of this.circles) {
        const dx = x - c.x;
        const dz = z - c.z;
        const min = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1e-4;
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
      }
      for (const b of this.boxes) {
        const cx = Math.max(b.x0, Math.min(x, b.x1));
        const cz = Math.max(b.z0, Math.min(z, b.z1));
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * radius;
            z = cz + (dz / d) * radius;
          } else {
            // el centro quedó dentro de la caja: salir por el lado más cercano
            const left = x - b.x0;
            const right = b.x1 - x;
            const up = z - b.z0;
            const down = b.z1 - z;
            const m = Math.min(left, right, up, down);
            if (m === left) x = b.x0 - radius;
            else if (m === right) x = b.x1 + radius;
            else if (m === up) z = b.z0 - radius;
            else z = b.z1 + radius;
          }
        }
      }
    }
    if (this.bounds) {
      const [x0, z0, x1, z1] = this.bounds;
      x = Math.max(x0 + radius, Math.min(x1 - radius, x));
      z = Math.max(z0 + radius, Math.min(z1 - radius, z));
    }
    return [x, z];
  }

  /** ¿El punto toca un obstáculo (sin contar los límites del área)? Sirve para repartir pasto y hojas. */
  hitsObstacle(x: number, z: number, margin = 0): boolean {
    for (const c of this.circles) {
      const dx = x - c.x;
      const dz = z - c.z;
      const m = c.r + margin;
      if (dx * dx + dz * dz < m * m) return true;
    }
    for (const b of this.boxes) if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return true;
    return false;
  }

  /** ¿Hay un obstáculo en el punto (para no colocar cosas encima)? */
  blocked(x: number, z: number, margin = 0): boolean {
    const [rx, rz] = this.resolve(x, z, margin);
    return Math.abs(rx - x) > 1e-4 || Math.abs(rz - z) > 1e-4;
  }
}
