/// <reference lib="webworker" />
import { paintChunk, type GroundModel } from './ground';

// Worker de pintado de suelo: el hilo principal nunca se traba generando chunks.
let model: GroundModel | null = null;

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'model') {
    model = msg.model as GroundModel;
    return;
  }
  if (msg.type === 'chunk' && model) {
    const r = paintChunk(model, msg.cx, msg.cy, msg.size);
    (self as unknown as Worker).postMessage({ type: 'chunk', id: msg.id, ...r }, [r.data.buffer]);
  }
};
