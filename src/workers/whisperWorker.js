// src/workers/whisperWorker.js
// Runs entirely in a Web Worker context – no DOM, no Supabase.
import { pipeline, env } from '@huggingface/transformers';

// ── Environment config ──
env.allowLocalModels = false;
env.useBrowserCache  = true;
// Force single-thread WASM so no SharedArrayBuffer / COOP-COEP headers are required in production
env.backends.onnx.wasm.numThreads = 1;

let transcriber = null;

async function canUseWebGPU() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

async function loadModel(onProgress) {
  const hasGpu = await canUseWebGPU();
  // Safe detection: only attempt WebGPU if navigator.gpu actually acquired an adapter
  const devicesToTry = hasGpu ? ['webgpu', 'wasm'] : ['wasm'];

  let lastError = null;
  for (const device of devicesToTry) {
    try {
      self.postMessage({ type: 'log', message: `Iniciando dispositivo: ${device}` });
      const t = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny',
        {
          dtype: {
            encoder_model: device === 'webgpu' ? 'fp32' : 'q4',
            decoder_model_merged: 'q4',
          },
          device,
          progress_callback: onProgress,
        }
      );
      return { transcriber: t, device };
    } catch (err) {
      lastError = err;
      self.postMessage({ type: 'log', message: `${device} falhou: ${err.message}` });
    }
  }

  throw lastError || new Error('Não foi possível carregar o modelo de transcrição.');
}

self.addEventListener('message', async ({ data }) => {
  switch (data.type) {
    case 'load': {
      try {
        const { transcriber: t, device } = await loadModel((p) =>
          self.postMessage({ type: 'model_progress', progress: p })
        );
        transcriber = t;
        self.postMessage({ type: 'ready', device });
      } catch (err) {
        // Whisper unavailable (e.g. offline or browser memory) -> inform UI to fallback gracefully to silence-only edit
        self.postMessage({ type: 'whisper_unavailable', error: err.message });
      }
      break;
    }

    case 'transcribe': {
      try {
        if (!transcriber) {
          throw new Error('Modelo não carregado.');
        }
        const output = await transcriber(data.audio, {
          language: 'portuguese',
          return_timestamps: 'word',
          chunk_length_s: 30,
          stride_length_s: 5,
        });
        self.postMessage({ type: 'result', output });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
      }
      break;
    }

    default:
      break;
  }
});
