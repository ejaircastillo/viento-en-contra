/**
 * Perfil del dispositivo y presupuesto de rendimiento. Se degrada solo si detecta
 * cuadros lentos (FPS promedio bajo), sin sacrificar estabilidad por efectos.
 */
export type Tier = 'high' | 'low';

export interface Budget {
  trafficCars: number;
  pedestrians: number;
  windStreaks: number;
  snowflakes: number;
  flyingBags: number;
  chunkMargin: number;
  cloudShadows: boolean;
}

const BUDGETS: Record<Tier, Budget> = {
  high: { trafficCars: 11, pedestrians: 6, windStreaks: 46, snowflakes: 30, flyingBags: 3, chunkMargin: 220, cloudShadows: true },
  low: { trafficCars: 6, pedestrians: 3, windStreaks: 18, snowflakes: 10, flyingBags: 1, chunkMargin: 140, cloudShadows: false },
};

export class DeviceProfile {
  tier: Tier;
  readonly touch: boolean;
  readonly dpr: number;
  private samples: number[] = [];
  private downgraded = false;
  onChange?: (t: Tier) => void;

  constructor() {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const mem = nav.deviceMemory ?? 4;
    this.touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    this.dpr = Math.max(1, Math.min(4, window.devicePixelRatio || 1));
    const forced = new URLSearchParams(location.search).get('tier');
    this.tier = forced === 'low' || forced === 'high' ? forced : cores <= 4 && mem <= 3 ? 'low' : 'high';
  }

  get budget(): Budget {
    return BUDGETS[this.tier];
  }

  /** Llamar cada cuadro con el delta real (ms). */
  sample(dtMs: number): void {
    if (this.downgraded || this.tier === 'low') return;
    this.samples.push(dtMs);
    if (this.samples.length < 240) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (avg > 1000 / 42) {
      this.tier = 'low';
      this.downgraded = true;
      console.info('[Device] rendimiento bajo detectado: paso a perfil liviano');
      this.onChange?.(this.tier);
    }
  }
}
