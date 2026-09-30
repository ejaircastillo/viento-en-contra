import { Hud } from './Hud';
import { DialogueBox } from './DialogueBox';
import { Bubbles } from './Bubbles';
import { PhoneUi, DocumentsUi } from './Overlays';
import { Menus } from './Menus';
import { SignCaptions } from './Captions';
import { DriveUi } from './DriveUi';
import { BraceUi } from './Brace';
import { wait } from './dom';
import type { AudioEngine } from '../audio/AudioEngine';
import type { InputManager } from '../input/InputManager';

/** Raíz de la UI HTML (se superpone al canvas). */
export class Ui {
  readonly hud: Hud;
  readonly dialogue: DialogueBox;
  readonly bubbles: Bubbles;
  readonly phone: PhoneUi;
  readonly docs: DocumentsUi;
  readonly menus: Menus;
  readonly captions: SignCaptions;
  readonly drive: DriveUi;
  readonly brace: BraceUi;
  private fadeEl: HTMLElement;
  private fx: HTMLElement;

  constructor(audio: AudioEngine, input: InputManager, touch = false) {
    const $ = (id: string) => document.getElementById(id)!;
    this.hud = new Hud($('hud'), audio);
    this.dialogue = new DialogueBox($('panels'), audio, input);
    this.bubbles = new Bubbles($('world-ui'));
    this.captions = new SignCaptions($('world-ui'));
    this.drive = new DriveUi($('hud'), input, audio, touch);
    this.brace = new BraceUi($('panels'), audio, touch);
    this.phone = new PhoneUi($('panels'), audio);
    this.docs = new DocumentsUi($('panels'), audio);
    this.menus = new Menus($('panels'), audio);
    this.fadeEl = $('fade');
    this.fx = $('fx-overlay');
  }

  setAuto(on: boolean): void {
    this.dialogue.auto = on;
    this.phone.auto = on;
    this.docs.auto = on;
    this.menus.auto = on;
    this.brace.auto = on;
  }

  async fadeOut(ms = 450): Promise<void> {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.add('on');
    await wait(ms);
  }

  async fadeIn(ms = 450): Promise<void> {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.remove('on');
    await wait(ms);
  }

  get faded(): boolean {
    return this.fadeEl.classList.contains('on');
  }

  setInterior(on: boolean): void {
    this.fx.classList.toggle('interior', on);
  }
}
