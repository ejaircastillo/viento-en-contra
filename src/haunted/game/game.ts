import * as THREE from 'three';
import type { App } from '../core/app';
import type { Input, Action } from '../core/input';
import { createMaterials, windUniforms, type Materials } from '../gfx/materials';
import { LightPool } from '../gfx/lights';
import { Particles } from '../gfx/particles';
import { glowTexture } from '../gfx/textures';
import { Ghost } from '../world/ghost';
import type { Area } from '../world/area';
import { buildGraveyard, type GraveyardArea } from '../world/graveyardArea';
import { CAMP } from '../world/graveyard';
import { applyMoon, cloudTexture, makeSkyEnvironment, moonPool, updateSky } from '../gfx/sky';
import { buildCrypt, type CryptArea } from '../world/crypt';
import type { Interactable } from '../world/ctx';
import { Hud } from '../ui/hud';
import { Tools } from '../ui/tools';
import { Sound, type Voice } from '../core/audio';
import { Interaction } from './interaction';
import { Story, type StoryHost } from './story';
import type { Epitaph } from './content';

const voiceOf = (name: string): Voice => (/huesos/i.test(name) ? 'huesos' : /lutin/i.test(name) ? 'lutin' : /pelusa/i.test(name) ? 'pelusa' : /^vos$/i.test(name) ? 'ghost' : 'narrator');

/**
 * El juego: junta el mundo (áreas), el fantasma, la entrada, la historia y la interfaz. Se ocupa de cambiar
 * de área con fundido, abrir las puertas, caminar hasta lo que se toca y de los efectos de los eventos
 * (la perrita desenterrando el sello, el sellado del certificado).
 */
export class Game {
  readonly mats: Materials;
  readonly pool: LightPool;
  readonly ghost: Ghost;
  readonly hud: Hud;
  readonly sound = new Sound();
  readonly story: Story;
  readonly graveyard: GraveyardArea;
  readonly crypt: CryptArea;
  area: Area;
  private sparks: Particles;
  private interaction: Interaction;
  private talkingId: string | null = null;
  private modal = false;
  private transition = false;
  private walkTarget: { x: number; z: number; stop: number; then?: () => void } | null = null;
  private focus = new THREE.Vector3();
  private sealFlash = 0;
  private stampFlash = 0;
  private tools: Tools;
  private digSfxT = 0;

  constructor(
    private app: App,
    private input: Input,
  ) {
    this.mats = createMaterials();
    this.pool = new LightPool(app.scene, app.quality.lightPool);
    this.graveyard = buildGraveyard(this.mats, this.pool, app.quality);
    this.crypt = buildCrypt(this.mats, this.pool, app.quality);
    moonPool.uCloud.value = cloudTexture();
    app.scene.environment = makeSkyEnvironment(app.renderer);
    applyMoon(this.graveyard.group);
    this.graveyard.group.traverse((o) => {
      if (o.userData.noOutline) app.post.noOutline.add(o);
    });
    this.sparks = new Particles({ max: 60, map: glowTexture(64, 2), additive: true });
    app.scene.add(this.sparks.mesh);
    this.ghost = new Ghost(this.mats, this.sparks);
    app.scene.add(this.ghost.root);

    const roots = { hud: document.getElementById('hud')!, panels: document.getElementById('panels')!, tags: document.getElementById('tags')! };
    this.hud = new Hud(
      roots,
      { onButton: (b) => void this.button(b), onTag: () => this.useCurrent(), onModal: (o) => this.setModal(o), onPanel: () => this.sound.sfx('open'), onVoice: (n) => this.sound.blip(voiceOf(n)) },
      app.touch,
    );
    this.tools = new Tools(roots.hud, app, this.sound);
    // el audio sólo puede arrancar con un gesto del usuario
    const unlock = () => {
      this.sound.unlock();
      if (this.sound.ready) for (const e of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(e, unlock);
    };
    for (const e of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(e, unlock, { passive: true });
    this.interaction = new Interaction(app.post, this.hud, app.rig.camera);
    this.story = new Story(this.host());

    this.area = this.graveyard;
    app.scene.add(this.graveyard.group);
    this.applyArea(this.graveyard, 'start', true);
    const puff = this.graveyard.dog.onPuff;
    this.graveyard.dog.onPuff = (x, z, kind) => {
      puff(x, z, kind);
      if (kind === 'fart') this.sound.sfx('puff');
      else if (this.digSfxT <= 0) {
        this.sound.sfx('dig');
        this.digSfxT = 0.6;
      }
    };

    input.onAction = (a) => this.action(a);
    input.onTap = (x, y) => this.tap(x, y);
    input.onManualMove = () => (this.walkTarget = null);
    app.onUpdate = (dt, t) => this.update(dt, t);
  }

  // ------------------------------------------------------------------ áreas
  private applyArea(area: Area, spawn: string, snap: boolean): void {
    this.area = area;
    this.sound.setArea(area === this.crypt ? 'crypt' : 'graveyard');
    const sp = area.spawns[spawn] ?? Object.values(area.spawns)[0];
    this.ghost.place(sp.x, sp.z, sp.yaw);
    this.app.scene.environmentIntensity = area.env;
    this.app.scene.fog = area.fog.density > 0 ? new THREE.FogExp2(area.fog.color, area.fog.density) : null;
    this.app.rig.configure(area.rig, true);
    this.app.rig.setAspect(innerWidth / innerHeight);
    this.app.rig.setTarget(sp.x, sp.z, snap);
    this.interaction.clear();
    this.walkTarget = null;
  }

  private fade(on: boolean): Promise<void> {
    const f = document.getElementById('fade')!;
    f.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, 420));
  }

  /** Cruza una puerta: camina hasta ella, se abre, funde a negro, cambia de área y vuelve a mostrar. */
  private async through(to: 'crypt' | 'graveyard'): Promise<void> {
    if (this.transition) return;
    this.transition = true;
    this.interaction.clear();
    this.sound.sfx('door');
    const door = to === 'crypt' ? this.graveyard.crypt : null;
    if (door) for (let i = 0; i <= 10; i++) { door.setOpen(i / 10); await this.host().sleep(45); }
    else for (let i = 0; i <= 10; i++) { this.crypt.setExitOpen(i / 10); await this.host().sleep(45); }
    await this.fade(true);
    this.app.scene.remove(this.area.group);
    const next = to === 'crypt' ? this.crypt : this.graveyard;
    this.app.scene.add(next.group);
    this.applyArea(next, to === 'crypt' ? 'entry' : 'fromCrypt', true);
    this.graveyard.crypt.setOpen(0);
    this.crypt.setExitOpen(0);
    if (to === 'crypt') this.hud.setObjective(this.story.stage === 3 ? 'Hablá con Lutin: tenés el sello' : 'Explorá la cripta y hablá con Lutin');
    else this.hud.setObjective(this.story.objective, false);
    await this.fade(false);
    this.transition = false;
  }

  // ------------------------------------------------------------------ entrada y acciones
  private setModal(open: boolean): void {
    this.modal = open;
    this.input.blocked = open;
    if (open) {
      this.input.axis.x = 0;
      this.input.axis.y = 0;
      this.walkTarget = null;
    }
  }

  private action(a: Action): void {
    if (this.hud.handleAction(a)) return;
    if (this.transition) return;
    if (a === 'interact') this.useCurrent();
    else if (a === 'journal' || a === 'bag' || a === 'help') void this.button(a);
  }

  private async button(b: 'journal' | 'bag' | 'help'): Promise<void> {
    if (this.hud.isOpen || this.transition) return;
    if (b === 'journal') {
      this.hud.setNew('journal', false);
      await this.hud.list('Diario', 'Diario del fantasma', this.story.journal(), 'Todavía no anotaste nada.');
    } else if (b === 'bag') {
      this.hud.setNew('bag', false);
      const items = this.story.inventory.map((i) => ({ text: i.name, note: i.note }));
      await this.hud.list('Bolso', 'Lo que llevás', items, 'Los fantasmas viajan livianos: el bolso está vacío.');
    } else {
      await this.hud.page(
        'Ayuda',
        'Cómo se juega',
        '<p><kbd>W A S D</kbd> o flechas: flotar. En el celular, arrastrá el dedo.</p><p>Tocá un lugar del piso para ir hasta ahí. <kbd>E</kbd>, <kbd>Espacio</kbd> o tocar la etiqueta: interactuar.</p><p><kbd>J</kbd> diario · <kbd>B</kbd> bolso · <kbd>H</kbd> ayuda · <kbd>Esc</kbd> cerrar.</p>',
      );
    }
  }

  private tap(cx: number, cy: number): void {
    if (this.modal || this.transition) return;
    const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.app.rig.camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
    const it = this.interaction.pickNear(this.area.interactables, p.x, p.z, 1.7);
    if (it) {
      const d = Math.hypot(it.x - this.ghost.x, it.z - this.ghost.z);
      if (d <= it.radius * 0.9) void this.use(it);
      else this.walkTarget = { x: it.x, z: it.z, stop: Math.max(0.5, it.radius * 0.55), then: () => void this.use(it) };
    } else this.walkTarget = { x: p.x, z: p.z, stop: 0.2 };
  }

  private useCurrent(): void {
    const it = this.interaction.current;
    if (it && !this.modal && !this.transition) void this.use(it);
  }

  private async use(it: Interactable): Promise<void> {
    if (this.modal || this.transition || this.story.busy) return;
    this.walkTarget = null;
    this.ghost.faceTowards(it.x, it.z);
    if (it.id === 'crypt_door') await this.through('crypt');
    else if (it.id === 'exit_door') await this.through('graveyard');
    else await this.story.interact(it.id);
  }

  begin(): void {
    void this.hud
      .page('Fantasma en trámite', 'Un cuento de ultratumba', '<p>Hace treinta y siete años que esperás tu Certificado de Descanso Eterno.</p><p>Esta noche, por fin, te llamaron. O eso parece.</p>')
      .then(() => this.story.start());
  }

  // ------------------------------------------------------------------ puente con la historia
  private hostObj: StoryHost | null = null;
  private host(): StoryHost {
    if (this.hostObj) return this.hostObj;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    this.hostObj = {
      say: (name, text) => this.hud.say(name, text),
      choose: (options) => this.hud.choose(null, options),
      inscription: (e: Epitaph) => this.hud.inscription(e),
      talking: (id) => (this.talkingId = id),
      objective: (t) => this.hud.setObjective(t),
      toast: (t) => this.hud.toast(t),
      notify: (k) => {
        this.hud.setNew(k, true);
        this.sound.sfx(k === 'bag' ? 'pickup' : 'open');
      },
      dogLead: () =>
        new Promise<void>((resolve) => {
          const seal = this.graveyard.seal.it;
          this.leading = true;
          this.sound.sfx('bark');
          this.graveyard.dog.lead(seal.x + 0.7, seal.z + 0.5, () => {
            this.graveyard.seal.reveal();
            this.sound.sfx('seal');
            this.leading = false;
            this.hud.toast('Pelusa desenterró algo brillante…');
            resolve();
          });
        }),
      takeSeal: () => {
        this.graveyard.seal.hide();
        this.sound.sfx('pickup');
      },
      stamp: async () => {
        this.app.rig.shake(0.16, 0.4);
        this.stampFlash = 1;
        this.sound.sfx('stamp');
        await sleep(520);
      },
      ending: async () => {
        await this.hud.page(
          'Continuará',
          'Capítulo 2',
          '<p>La ventanilla del más allá</p><p><i>Mañana: formulario nuevo.<br>Todavía no existe.</i></p>',
        );
        this.hud.setObjective(this.story.objective);
      },
      sleep,
    };
    return this.hostObj;
  }
  private leading = false;

  // ------------------------------------------------------------------ cuadro a cuadro
  private update(dt: number, t: number): void {
    windUniforms.uTime.value = t;
    updateSky(this.app.rig.camera, this.ghost.x, this.ghost.z, t);
    windUniforms.uPush.value.set(this.ghost.x, this.ghost.z, 1.35, 1);
    this.digSfxT = Math.max(0, this.digSfxT - dt);
    const g = this.ghost;
    const { forward, right } = this.app.rig.groundBasis();
    let wx = forward.x * this.input.axis.y + right.x * this.input.axis.x;
    let wz = forward.z * this.input.axis.y + right.z * this.input.axis.x;
    if (this.modal || this.transition) {
      wx = 0;
      wz = 0;
    } else if (wx === 0 && wz === 0 && this.walkTarget) {
      const tg = this.walkTarget;
      const dx = tg.x - g.x;
      const dz = tg.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d <= tg.stop) {
        this.walkTarget = null;
        tg.then?.();
      } else {
        const k = Math.min(1, d * 1.6);
        wx = (dx / d) * k;
        wz = (dz / d) * k;
        // si se traba contra algo durante un rato, se cancela el "caminar a…"
        this.stuck = g.speed < 0.25 ? this.stuck + dt : 0;
        if (this.stuck > 0.7) {
          this.walkTarget = null;
          this.stuck = 0;
        }
      }
    }
    g.step(dt, t, { x: wx, z: wz }, this.area.cols);
    if (this.leading && this.area === this.graveyard) this.app.rig.setTarget(this.graveyard.dog.x, this.graveyard.dog.z);
    else this.app.rig.setTarget(g.x, g.z);
    this.focus.set(g.x, 0, g.z);
    this.pool.update(t, dt, this.focus, this.area.id);
    this.area.update(dt, t, { ghost: { x: g.x, z: g.z }, camera: this.app.rig.camera, talking: this.talkingId });
    this.sparks.update(dt, t, this.app.rig.camera);
    const camp = CAMP;
    const fire = Math.max(0, 1 - Math.hypot(g.x - camp.x, g.z - camp.z) / 15);
    this.sound.update(dt, fire * fire);
    this.tools.update(dt);
    this.interaction.update(this.area.interactables, g.x, g.z, !this.modal && !this.transition && !this.story.busy);
    if (this.talkingId && this.talkingId !== 'dog') this.sealFlash = 0;
    if (this.stampFlash > 0) {
      this.stampFlash = Math.max(0, this.stampFlash - dt * 2.5);
      if (this.app.post.bloom) this.app.post.bloom.strength = this.app.post.bloomBase + this.stampFlash * 1.2;
    }
  }
  private stuck = 0;
}
