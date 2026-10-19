// src/workers/whisperWorker.js
// Runs entirely in a Web Worker - no DOM, no Supabase, no external API
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true; // cache model after first download

let transcriber = null;

/**
 * Attempt to load Whisper, trying WebGPU first, then WASM.
 * Emits model_progress events so the UI can show a download bar.
 */
async function loadModel() {
  const devices = ['webgpu', 'wasm'];
  let lastError = null;

  for (const device of devices) {
    try {
      self.postMessage({ type: 'log', message: `Tentando dispositivo: ${device}` });

      const t = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-base',
        {
          dtype:
            device === 'webgpu'
              ? { encoder_model: 'fp32', decoder_model_merged: 'q4' }
              : { encoder_model: 'q8', decoder_model_merged: 'q4' },
          device,
          progress_callback: (progress) => {
            self.postMessage({ type: 'model_progress', progress });
          },
        }
      );

      transcriber = t;
      return device;
    } catch (err) {
      lastError = err;
      self.postMessage({
        type: 'log',
        message: `${device} indisponivel: ${err.message}`,
      });
    }
  }

  throw new Error(
    lastError?.message || 'Nenhum dispositivo de IA disponivel neste navegador.'
  );
}

self.addEventListener('message', async ({ data }) => {
  switch (data.type) {
    case 'load': {
      try {
        const device = await loadModel();
        self.postMessage({ type: 'ready', device });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
      }
      break;
    }

    case 'transcribe': {
      try {
        if (!transcriber) {
          throw new Error('Modelo nao carregado. Carregue o modelo primeiro.');
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
