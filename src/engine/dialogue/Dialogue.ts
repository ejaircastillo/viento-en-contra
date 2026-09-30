import type { ChoiceOption, Speaker } from '../ui/DialogueBox';
import type { CancelToken } from '../core/Scheduler';
import { CancelledError } from '../core/Scheduler';

/**
 * Diálogos como datos. Un diálogo es una lista de nodos:
 *   { who, text }                      línea (who: 'player' | 'kid' | id de NPC | 'radio' | null)
 *   { think: true, text }              pensamiento en la caja de diálogo (bloqueante)
 *   { thought }                        pensamiento en globo (no bloquea)
 *   { choice: [{ text, tone, set, then }] }   2-3 opciones que pueden cambiar líneas posteriores
 *   { set: { flag: valor } }
 *   { if: 'cond', then: [...], else: [...] }
 *   { do: 'hook', args }               acción del guion (sonidos, reloj, animaciones)
 * Cualquier nodo acepta `if` (condición) y `only` (id de personaje).
 * Condiciones: "flag", "!flag", "flag=valor", "char=municipal", combinables con "&".
 */

export type Flags = Record<string, string | number | boolean>;

interface Base {
  if?: string;
  only?: string;
}

export type DialogueNode =
  | (Base & { who: string | null; text: string; think?: boolean })
  | (Base & { think: true; text: string })
  | (Base & { thought: string })
  | (Base & { choice: (ChoiceOption & { set?: Flags; then?: DialogueNode[]; if?: string })[] })
  | (Base & { set: Flags })
  | (Base & { then: DialogueNode[]; else?: DialogueNode[] })
  | (Base & { do: string; args?: any })
  | (Base & { wait: number });

export type DialogueLibrary = Record<string, DialogueNode[]>;

export interface DialogueEnv {
  characterId: string;
  flags: Flags;
  vocab: Record<string, string>;
  speaker: (id: string) => Speaker | null;
  say: (speaker: Speaker | null, text: string, think: boolean) => Promise<void>;
  choose: (opts: ChoiceOption[]) => Promise<number>;
  thought: (text: string) => void;
  hook: (name: string, args: any) => Promise<void> | void;
  wait: (ms: number) => Promise<void>;
  token?: CancelToken;
}

export function fillTemplate(text: string, vocab: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => vocab[k] ?? m);
}

export function evalCond(cond: string | undefined, env: { characterId: string; flags: Flags }): boolean {
  if (!cond) return true;
  return cond.split('&').every((raw) => {
    let c = raw.trim();
    if (!c) return true;
    let neg = false;
    if (c.startsWith('!')) {
      neg = true;
      c = c.slice(1).trim();
    }
    let res: boolean;
    const ne = c.indexOf('!=');
    const eq = c.indexOf('=');
    if (ne > 0) {
      const k = c.slice(0, ne).trim();
      const v = c.slice(ne + 2).trim();
      res = k === 'char' ? env.characterId !== v : String(env.flags[k]) !== v;
    } else if (eq > 0) {
      const k = c.slice(0, eq).trim();
      const v = c.slice(eq + 1).trim();
      res = k === 'char' ? env.characterId === v : String(env.flags[k]) === v;
    } else {
      res = !!env.flags[c];
    }
    return neg ? !res : res;
  });
}

type ChoiceNode = Base & { choice: (ChoiceOption & { set?: Flags; then?: DialogueNode[]; if?: string })[] };
type BranchNode = Base & { then: DialogueNode[]; else?: DialogueNode[] };

const isChoice = (n: DialogueNode): n is ChoiceNode => 'choice' in n;
const isBranch = (n: DialogueNode): n is BranchNode => 'then' in n && !('choice' in n);

export async function runDialogue(nodes: DialogueNode[], env: DialogueEnv): Promise<void> {
  for (const node of nodes) {
    env.token?.throwIfCancelled();
    if (node.only && node.only !== env.characterId) continue;
    if (isBranch(node)) {
      const ok = evalCond(node.if, env);
      await runDialogue(ok ? node.then : (node.else ?? []), env);
      continue;
    }
    if (!evalCond(node.if, env)) continue;
    if (isChoice(node)) {
      const opts = node.choice.filter((o) => evalCond(o.if, env));
      const idx = await env.choose(opts.map((o) => ({ text: fillTemplate(o.text, env.vocab), tone: o.tone })));
      env.token?.throwIfCancelled();
      const picked = opts[idx];
      if (picked.set) Object.assign(env.flags, picked.set);
      if (picked.then) await runDialogue(picked.then, env);
    } else if ('set' in node) {
      Object.assign(env.flags, node.set);
    } else if ('do' in node) {
      await env.hook(node.do, node.args);
    } else if ('wait' in node) {
      await env.wait(node.wait);
    } else if ('thought' in node) {
      env.thought(fillTemplate(node.thought, env.vocab));
    } else if ('text' in node) {
      const who = 'who' in node ? node.who : null;
      const think = !!(node as { think?: boolean }).think;
      const sp = who ? env.speaker(who) : null;
      await env.say(sp, fillTemplate(node.text, env.vocab), think);
    }
  }
  if (env.token?.cancelled) throw new CancelledError();
}
