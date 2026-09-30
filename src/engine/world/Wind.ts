/**
 * Viento patagónico: intensidad base + ráfagas periódicas. Lo leen el audio, los efectos
 * visuales, la velocidad al caminar (en contra se camina más lento) y el vaivén de la vegetación.
 */
export class Wind {
  base = 0.45;
  strength = 0.45;
  /** Hacia dónde sopla (vector de mundo normalizado): hacia la derecha de la pantalla. */
  readonly dirX = Math.SQRT1_2;
  readonly dirY = -Math.SQRT1_2;
  private t = 0;
  private nextGust = 5;
  private gust = { start: 0, dur: 0, peak: 0 };
  onGust?: (peak: number) => void;
  /** Multiplicador del efecto al caminar (ej. cargando un cartel grande). */
  carry = 1;
  /** Fuerza fija (mini-juegos guionados): ignora las ráfagas al azar. null = viento normal. */
  forced: number | null = null;

  /** Ráfaga guionada (ceremonias, ensayos): sube en campana durante `seconds`. */
  gustNow(peak: number, seconds: number): void {
    this.gust = { start: this.t, dur: seconds, peak };
    this.nextGust = Math.max(this.nextGust, this.t + seconds + 4);
    this.onGust?.(peak);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t >= this.nextGust) {
      this.gust = { start: this.t, dur: 2.2 + Math.random() * 2.6, peak: 0.35 + Math.random() * 0.4 };
      this.nextGust = this.t + 7 + Math.random() * 9;
      this.onGust?.(this.gust.peak);
    }
    const g = this.gust;
    let add = 0;
    if (this.t < g.start + g.dur) {
      const k = (this.t - g.start) / g.dur;
      add = g.peak * Math.sin(Math.PI * k);
    }
    const flutter = Math.sin(this.t * 0.7) * 0.05 + Math.sin(this.t * 2.3) * 0.03;
    this.strength = this.forced !== null ? Math.max(0, Math.min(1, this.forced)) : Math.max(0, Math.min(1, this.base + add + flutter));
  }

  get gusting(): boolean {
    return this.strength > this.base + 0.2;
  }

  /** Multiplicador de velocidad para una dirección de caminata (vector de mundo normalizado). */
  walkFactor(mx: number, my: number): number {
    const dot = mx * this.dirX + my * this.dirY;
    if (dot < 0) return Math.max(0.25, 1 + 0.42 * dot * this.strength * this.carry);
    return 1 + 0.14 * dot * this.strength * this.carry;
  }
}
