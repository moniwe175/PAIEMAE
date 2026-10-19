/* eslint-disable react/prop-types */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Download, Play, Pause, SkipBack, SkipForward,
  CheckCircle2, AlertCircle, Loader2, Volume2, VolumeX,
  Sparkles, Settings2, RefreshCw, Clock, Film, Trash2, Info, ImagePlus, X
} from "lucide-react";
import {
  buildAutomaticBrollCues,
  buildKeepSegments,
  detectAdaptiveSilences,
  fitCover,
} from "../lib/videoAutoEdit";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_VIDEO_DURATION = 5 * 60; // 5 minutos

const SENSITIVITY = {
  suave:     { minPauseS: 0.50, paddingS: 0.16, thresholdRatio: 0.18, bridgeSpeechS: 0.06 },
  normal:    { minPauseS: 0.35, paddingS: 0.12, thresholdRatio: 0.24, bridgeSpeechS: 0.08 },
  agressivo: { minPauseS: 0.20, paddingS: 0.08, thresholdRatio: 0.32, bridgeSpeechS: 0.10 },
};

const STEPS = [
  { key: "extracting",    label: "Extraindo áudio" },
  { key: "loading_model", label: "Carregando Whisper" },
  { key: "transcribing",  label: "Transcrevendo fala" },
  { key: "analyzing",     label: "Analisando silêncios" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  page:      { minHeight: "100vh", background: "var(--bg-main)", fontFamily: "var(--font-sans)", color: "var(--text-dark)", display: "flex", flexDirection: "column" },
  hdr:       { padding: "14px 22px", borderBottom: "1px solid var(--border-color)", background: "#fff", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-sm)" },
  hdrTitle:  { display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--color-primary)", marginRight: "auto" },
  badge:     { fontSize: 10, background: "var(--color-accent-soft)", color: "var(--text-light)", padding: "2px 7px", borderRadius: 20, fontWeight: 500 },
  body:      { flex: 1, display: "grid", gridTemplateColumns: "310px 1fr", overflow: "hidden", minHeight: 0 },
  panel:     { background: "#fff", borderRight: "1px solid var(--border-color)", overflowY: "auto" },
  sec:       { borderBottom: "1px solid var(--border-color)", padding: "14px 18px" },
  secT:      { display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-light)", marginBottom: 11 },
  lbl:       { fontSize: 11, fontWeight: 600, color: "var(--text-medium)", marginBottom: 4, display: "block" },
  inp:       { width: "100%", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 9px", fontSize: 12, fontFamily: "var(--font-sans)", color: "var(--text-dark)", background: "#fff", outline: "none", boxSizing: "border-box" },
  uploadZone:{ border: "2px dashed var(--border-color)", borderRadius: 10, padding: "24px 12px", textAlign: "center", cursor: "pointer", background: "var(--color-accent-soft)", transition: "all .2s" },
  fileChosen:{ display: "flex", alignItems: "center", gap: 7, background: "var(--success-bg)", border: "1px solid #a6d1b3", borderRadius: 7, padding: "7px 9px", fontSize: 11, color: "#3a7a50" },
  preview:   { flex: 1, display: "flex", flexDirection: "column", background: "#140e11", overflow: "hidden" },
  canvasWrap:{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", minHeight: 0 },
  ctrl:      { background: "#1f1418", borderTop: "1px solid rgba(255,255,255,.08)", padding: "9px 18px", display: "flex", flexDirection: "column", gap: 6 },
  playRow:   { display: "flex", alignItems: "center", gap: 9 },
  timeTxt:   { fontSize: 11, color: "rgba(255,255,255,.6)", fontVariantNumeric: "tabular-nums", minWidth: 84 },
  iconBtn:   { background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.8)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" },
  bigBtn:    (disabled) => ({ width: "100%", padding: "12px 0", borderRadius: 9, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, background: disabled ? "var(--border-color)" : "linear-gradient(135deg,#B3857A,#C8A26A)", color: disabled ? "var(--text-light)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: disabled ? "none" : "0 3px 10px rgba(179,133,122,.35)", transition: "opacity .15s" }),
  expBtn:    { display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#B3857A,#C8A26A)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(179,133,122,.35)" },
  stepRow:   { display: "flex", alignItems: "flex-start", gap: 9, padding: "5px 0" },
  dot:       (s) => ({ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, marginTop: 3, background: s === "done" ? "var(--success)" : s === "active" ? "var(--color-primary)" : "var(--border-color)" }),
  pbar:      { height: 4, borderRadius: 2, background: "var(--color-accent-soft)", overflow: "hidden", marginTop: 4 },
  pfill:     { height: "100%", background: "linear-gradient(90deg,#B3857A,#C8A26A)", transition: "width .3s" },
  statBox:   { background: "var(--color-accent-soft)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
  toast:     { position: "fixed", bottom: 22, right: 22, background: "#fff", border: "1px solid var(--border-color)", borderRadius: 9, padding: "9px 14px", boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500, zIndex: 9999, animation: "ev_slide .25s ease" },
  toggle:    (on) => ({ width: 32, height: 17, borderRadius: 9, border: "none", cursor: "pointer", background: on ? "var(--color-primary)" : "var(--border-color)", position: "relative", transition: "background .2s", flexShrink: 0 }),
  knob:      (on) => ({ position: "absolute", top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left .2s" }),
  capCard:   { border: "1px solid var(--border-color)", borderRadius: 6, padding: "7px 9px", marginBottom: 5, fontSize: 11, position: "relative", background: "var(--bg-main)" },
  warnBox:   { background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: 8, padding: "9px 11px", fontSize: 11, color: "#5D4037", display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 9 },
};

const fmt = (s) => {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

// Detect preferred browser export extension (.mp4 or .webm)
const getExportExt = () => {
  if (typeof MediaRecorder === "undefined") return ".webm";
  if (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1,mp4a.40.2") || MediaRecorder.isTypeSupported("video/mp4")) {
    return ".mp4";
  }
  return ".webm";
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio / analysis helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeWords(output) {
  if (!output) return [];
  const chunks = output.chunks || (Array.isArray(output) ? output : []);
  return chunks
    .filter((c) => Array.isArray(c.timestamp) && c.timestamp.length === 2 && c.timestamp[0] != null)
    .map((c) => ({
      text: (c.text || "").trim(),
      start: c.timestamp[0],
      end: c.timestamp[1] ?? c.timestamp[0] + 0.3
    }))
    .filter((c) => c.text.length > 0);
}

async function extractAudio16k(file) {
  const ctx = new AudioContext();
  const buffer = await file.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buffer);
  ctx.close();

  const offCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = offCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

function computeRMS(mono, sr, windowMs = 20) {
  const ws = Math.floor(sr * windowMs / 1000);
  const r = [];
  for (let i = 0; i < mono.length; i += ws) {
    const chunk = mono.subarray(i, i + ws);
    let sum = 0;
    for (let j = 0; j < chunk.length; j++) {
      sum += chunk[j] * chunk[j];
    }
    r.push({ t: i / sr, rms: Math.sqrt(sum / chunk.length) });
  }
  return r;
}

function removeRepetitions(segs, words) {
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-záéíóúãõâêôç]/g, "");
  const withW = segs.map((s) => ({
    ...s,
    words: words.filter((w) => w.start >= s.start - 0.1 && w.end <= s.end + 0.1),
  }));

  const result = [];
  for (const seg of withW) {
    if (!result.length) { result.push(seg); continue; }
    const prev = result[result.length - 1];
    const cmp = Math.min(4, prev.words.length, seg.words.length);
    if (cmp < 2) { result.push(seg); continue; }
    let matches = 0;
    for (let i = 0; i < cmp; i++) {
      if (norm(prev.words[i]?.text) === norm(seg.words[i]?.text)) matches++;
    }
    // If the repeated phrase is found, keep the last take
    if (matches >= 2) {
      result[result.length - 1] = seg;
    } else {
      result.push(seg);
    }
  }
  return result;
}

function groupIntoPhrases(words, maxN = 4) {
  const phrases = [];
  for (let i = 0; i < words.length; i += maxN) {
    const sl = words.slice(i, i + maxN);
    phrases.push({
      id: Date.now() + i,
      text: sl.map((w) => w.text).join(" "),
      startTime: sl[0].start,
      endTime: sl[sl.length - 1].end,
      words: sl,
    });
  }
  return phrases;
}

function drawWordCaption(ctx, words, ct, cw, ch) {
  const ci = words.findIndex((w) => ct >= w.start && ct < w.end);
  if (ci < 0) return;

  const st = Math.max(0, ci - 1);
  const sl = words.slice(st, st + 4);
  const fs = Math.max(24, Math.floor(Math.min(cw, ch) / 22));
  ctx.font = `800 ${fs}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const line = sl.map((w) => w.text).join(" ");
  const lw = ctx.measureText(line).width;
  const yb = ch * 0.86;
  const pad = 14;

  // Background pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cw / 2 - lw / 2 - pad, yb - fs / 2 - 8, lw + pad * 2, fs + 20, 8);
  } else {
    ctx.rect(cw / 2 - lw / 2 - pad, yb - fs / 2 - 8, lw + pad * 2, fs + 20);
  }
  ctx.fill();

  let x = cw / 2 - lw / 2;
  sl.forEach((w, i) => {
    const isCur = st + i === ci;
    const wordWidth = ctx.measureText(w.text).width;
    const spaceWidth = ctx.measureText(" ").width;

    // Stroke
    ctx.font = `800 ${fs}px Inter, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(w.text, x + wordWidth / 2, yb);

    // Text fill with gold highlight for the active word
    ctx.fillStyle = isCur ? "#FFE600" : "#FFFFFF";
    ctx.fillText(w.text, x + wordWidth / 2, yb);

    x += wordWidth + spaceWidth;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function EditorVideo() {
  // Shared
  const [videoSrc,    setVideoSrc]    = useState(null);
  const [videoFile,   setVideoFile]   = useState(null);
  const [fileName,    setFileName]    = useState("");
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [dragOver,    setDragOver]    = useState(false);

  // Pipeline
  const [step,       setStep]      = useState(null);
  const [stepLabel,  setStepLabel] = useState("");
  const [stepPct,    setStepPct]   = useState(0);
  const [pipeError,  setPipeError] = useState(null);
  const [noWhisper,  setNoWhisper] = useState(false);

  // Results
  const [segments,   setSegments]   = useState([]);
  const [captions,   setCaptions]   = useState([]);
  const [brollAssets, setBrollAssets] = useState([]);
  const [brollCues, setBrollCues] = useState([]);
  const [origDur,    setOrigDur]    = useState(0);
  const [finalDur,   setFinalDur]   = useState(0);

  // Settings
  const [settings, setSettings] = useState({
    sensitivity:    "normal",
    enableCaptions: true,
    enableAudio:    true,
  });

  // Misc
  const [toast, setToast] = useState(null);

  // Refs
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const fileRef     = useRef(null);
  const brollFileRef = useRef(null);
  const workerRef   = useRef(null);
  const audioCtxR   = useRef(null);
  const cancelRef   = useRef(false);
  const chunksRef   = useRef([]);
  const segmentsRef = useRef([]);
  const brollAssetsRef = useRef([]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    setBrollCues(buildAutomaticBrollCues(segments, brollAssets));
  }, [segments, brollAssets]);

  useEffect(() => {
    brollAssetsRef.current = brollAssets;
  }, [brollAssets]);

  useEffect(() => () => {
    brollAssetsRef.current.forEach(asset => {
      if (asset.type === "video") asset.element?.pause();
      URL.revokeObjectURL(asset.url);
    });
  }, []);

  const isDone    = step === "done";
  const isExp     = step === "exporting";
  const isRunning = step && step !== "done" && step !== "error" && step !== "exporting";
  const isError   = step === "error";
  const stepIdx   = STEPS.findIndex((s) => s.key === step);
  const exportExt = getExportExt();

  // ── Load file ────────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("video/")) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFile(file);
    setFileName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setSegments([]);
    setCaptions([]);
    setBrollAssets((current) => {
      current.forEach(asset => {
        if (asset.type === "video") asset.element?.pause();
        URL.revokeObjectURL(asset.url);
      });
      return [];
    });
    setBrollCues([]);
    setStep(null);
    setPipeError(null);
    setNoWhisper(false);
  }, [videoSrc]);

  const addBrollFiles = useCallback(async (fileList) => {
    const files = [...(fileList || [])]
      .filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, 8);
    if (!files.length) return;

    const loaded = await Promise.all(files.map(file => new Promise((resolve) => {
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const url = URL.createObjectURL(file);
      if (file.type.startsWith("image/")) {
        const image = new Image();
        image.onload = () => resolve({ id, name: file.name, type: "image", url, element: image });
        image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        image.src = url;
        return;
      }

      const video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.onloadedmetadata = () => resolve({
        id, name: file.name, type: "video", url, element: video, duration: video.duration,
      });
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      video.src = url;
      video.load();
    })));

    const valid = loaded.filter(Boolean);
    setBrollAssets(current => {
      const combined = [...current, ...valid];
      combined.slice(8).forEach(asset => {
        if (asset.type === "video") asset.element?.pause();
        URL.revokeObjectURL(asset.url);
      });
      return combined.slice(0, 8);
    });
    if (valid.length) {
      setToast({ msg: `${valid.length} mídia(s) de apoio adicionada(s).`, isError: false });
      setTimeout(() => setToast(null), 5000);
    }
  }, []);

  const removeBrollAsset = useCallback((assetId) => {
    setBrollAssets(current => current.filter(asset => {
      if (asset.id !== assetId) return true;
      if (asset.type === "video") asset.element?.pause();
      URL.revokeObjectURL(asset.url);
      return false;
    }));
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (v.duration > MAX_VIDEO_DURATION) {
        showToast(`Vídeo muito longo (${fmt(v.duration)}). Limite de 5 minutos.`, true);
        setVideoSrc(null);
        setVideoFile(null);
        return;
      }
      setDuration(v.duration);
    };

    const onTime = () => {
      const t = v.currentTime;
      setCurrentTime(t);

      // In auto-edited preview, skip cut silences smoothly
      if (segmentsRef.current.length > 0 && !v.paused) {
        const inSeg = segmentsRef.current.some((s) => t >= s.start && t < s.end);
        if (!inSeg) {
          const nextSeg = segmentsRef.current.find((s) => s.start > t);
          if (nextSeg) {
            v.currentTime = nextSeg.start;
          } else {
            v.pause();
            setIsPlaying(false);
          }
        }
      }
    };

    const onEnded = () => setIsPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoSrc]);

  // ── Canvas draw loop ──────────────────────────────────────
  const drawFrame = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !videoSrc) return;
    const ctx = c.getContext("2d");
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
    }

    ctx.drawImage(v, 0, 0, c.width, c.height);

    // B-roll substitui somente a imagem; a voz do vídeo principal continua.
    const ct = v.currentTime;
    const activeCue = brollCues.find(cue => ct >= cue.start && ct < cue.end);
    const activeAsset = activeCue && brollAssets.find(asset => asset.id === activeCue.assetId);
    brollAssets.forEach(asset => {
      if (asset.type === "video" && asset.id !== activeAsset?.id && !asset.element.paused) asset.element.pause();
    });
    if (activeCue && activeAsset?.element) {
      const media = activeAsset.element;
      if (activeAsset.type === "video" && Number.isFinite(activeAsset.duration) && activeAsset.duration > 0) {
        const targetTime = (ct - activeCue.start) % activeAsset.duration;
        if (Math.abs(media.currentTime - targetTime) > 0.18) media.currentTime = targetTime;
        if (v.paused) {
          if (!media.paused) media.pause();
        } else if (media.paused) {
          media.play().catch(() => {});
        }
      }
      const sourceWidth = activeAsset.type === "image" ? media.naturalWidth : media.videoWidth;
      const sourceHeight = activeAsset.type === "image" ? media.naturalHeight : media.videoHeight;
      if (sourceWidth && sourceHeight) {
        const rect = fitCover(sourceWidth, sourceHeight, c.width, c.height);
        const fade = Math.min(1, (ct - activeCue.start) / 0.16, (activeCue.end - ct) / 0.16);
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.drawImage(media, rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      }
    }

    // Word captions
    const captionWords = captions.flatMap(caption => caption.words || []);
    if (settings.enableCaptions && captionWords.length > 0) {
      drawWordCaption(ctx, captionWords, v.currentTime, c.width, c.height);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [videoSrc, settings, captions, brollAssets, brollCues]);

  useEffect(() => {
    if (videoSrc) rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoSrc, drawFrame]);

  // ── Pipeline ──────────────────────────────────────────────
  const runPipeline = async () => {
    if (!videoFile || !videoRef.current) return;
    cancelRef.current = false;
    setPipeError(null);
    setNoWhisper(false);
    setSegments([]);
    setCaptions([]);

    const go = (key, label, pct = 0) => { setStep(key); setStepLabel(label); setStepPct(pct); };
    let words = [];
    let audio16k = null;

    try {
      // ── 1. Extração de áudio ──
      go("extracting", "Extraindo áudio do vídeo…", 15);
      try {
        audio16k = await extractAudio16k(videoFile);
      } catch (err) {
        throw new Error("Não foi possível decodificar o áudio: " + err.message);
      }
      if (cancelRef.current) return;
      setStepPct(100);

      // ── 2. Carregar modelo Whisper ──
      go("loading_model", "Iniciando Whisper (~35 MB)…", 25);
      workerRef.current?.terminate();

      let worker = null;
      try {
        worker = new Worker(new URL("../workers/whisperWorker.js", import.meta.url), { type: "module" });
        workerRef.current = worker;
      } catch {
        worker = null;
      }

      if (worker) {
        try {
          const loadResult = await new Promise((resolve) => {
            worker.onmessage = ({ data: d }) => {
              if (d.type === "ready") resolve({ ok: true, device: d.device });
              if (d.type === "whisper_unavailable") resolve({ ok: false, error: d.error });
              if (d.type === "error") resolve({ ok: false, error: d.error });
              if (d.type === "model_progress" && d.progress?.status === "progress") {
                const pct = d.progress.total > 0 ? Math.round((d.progress.loaded / d.progress.total) * 100) : 0;
                setStepPct(pct);
                setStepLabel(`Baixando Whisper (${pct}%)…`);
              }
            };
            worker.onerror = (e) => resolve({ ok: false, error: e.message });
            worker.postMessage({ type: "load" });
          });

          if (cancelRef.current) { worker.terminate(); return; }

          if (loadResult.ok) {
            setStepPct(100);

            // ── 3. Transcrever fala ──
            go("transcribing", "Transcrevendo fala e sincronizando palavras…", 40);
            const whisperOut = await new Promise((resolve, reject) => {
              worker.onmessage = ({ data: d }) => {
                if (d.type === "result") resolve(d.output);
                if (d.type === "error")  reject(new Error(d.error));
              };
              worker.postMessage({ type: "transcribe", audio: audio16k });
            });
            if (cancelRef.current) { worker.terminate(); return; }
            words = normalizeWords(whisperOut);
            setStepPct(100);
          } else {
            console.warn("Whisper indisponível:", loadResult.error);
            setNoWhisper(true);
          }
        } catch (workerErr) {
          console.warn("Falha no worker de transcrição:", workerErr);
          setNoWhisper(true);
        } finally {
          worker.terminate();
        }
      } else {
        setNoWhisper(true);
      }

      if (cancelRef.current) return;

      // ── 4. Analisar silêncios e cortes ──
      go("analyzing", "Analisando pausas e gerando cortes automáticos…", 60);
      const cfg   = SENSITIVITY[settings.sensitivity];
      const rms   = computeRMS(audio16k, 16000, 20);
      const sils  = detectAdaptiveSilences(rms, videoRef.current.duration, cfg);
      const raw   = buildKeepSegments(sils, videoRef.current.duration);
      const segs  = words.length > 0 ? removeRepetitions(raw, words) : raw;
      const segsW = segs.map((s) => ({
        ...s,
        words: words.filter((w) => w.start >= s.start - 0.1 && w.end <= s.end + 0.1)
      }));

      const fDur = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
      setSegments(segsW);
      setOrigDur(videoRef.current.duration);
      setFinalDur(fDur);
      if (words.length > 0) {
        setCaptions(groupIntoPhrases(words, 4));
      }
      setStepPct(100);

      setStep("done");
      setStepLabel(`${segsW.length} trecho(s) · ${fmt(fDur)} finais`);
      showToast(`Pronto! ${segsW.length} trechos · ${fmt(fDur)} de vídeo final.`);

    } catch (err) {
      if (!cancelRef.current) {
        setStep("error");
        setPipeError(err.message);
        showToast("Erro: " + err.message, true);
      }
      workerRef.current?.terminate();
    }
  };

  // ── Export ────────────────────────────────────────────────
  const runExport = async () => {
    if (!segments.length || !videoRef.current || !canvasRef.current) return;
    setStep("exporting");
    setStepLabel("Exportando vídeo editado…");
    setStepPct(0);
    cancelRef.current = false;
    chunksRef.current = [];

    const v = videoRef.current;
    const c = canvasRef.current;
    try {
      const cs = c.captureStream(30);
      if (settings.enableAudio) {
        try {
          const actx = new AudioContext();
          audioCtxR.current = actx;
          const src  = actx.createMediaElementSource(v);
          const hp   = actx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 80;
          const cmp  = actx.createDynamicsCompressor(); cmp.threshold.value = -18; cmp.ratio.value = 3;
          const gn   = actx.createGain(); gn.gain.value = 1.25;
          const dst  = actx.createMediaStreamDestination();
          src.connect(hp); hp.connect(cmp); cmp.connect(gn); gn.connect(dst); gn.connect(actx.destination);
          cs.addTrack(dst.stream.getAudioTracks()[0]);
        } catch {
          try {
            const vs = v.captureStream?.();
            if (vs) vs.getAudioTracks().forEach((t) => cs.addTrack(t));
          } catch {
            // Alguns navegadores não expõem a faixa de áudio via captureStream.
          }
        }
      } else {
        try {
          const vs = v.captureStream?.();
          if (vs) vs.getAudioTracks().forEach((t) => cs.addTrack(t));
        } catch {
          // Exportação segue somente com o vídeo quando a captura de áudio não existe.
        }
      }

      const preferredMimes = [
        "video/mp4;codecs=avc1,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm"
      ];
      const mime = preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
      const ext  = mime.startsWith("video/mp4") ? ".mp4" : ".webm";

      const rec = new MediaRecorder(cs, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = fileName.replace(/\.[^.]+$/, "") + "_auto_editado" + ext;
        a.click();
        URL.revokeObjectURL(url);
        audioCtxR.current?.close();
        audioCtxR.current = null;
        setStep("done");
        setStepLabel("Download concluído!");
        showToast(`Vídeo exportado com sucesso (${ext})!`);
      };
      rec.start(100);
      v.muted = false;

      const total = segments.reduce((s, sg) => s + (sg.end - sg.start), 0);
      let elapsed = 0;
      for (const seg of segments) {
        if (cancelRef.current) break;
        v.currentTime = seg.start;
        await new Promise((r) => { v.onseeked = r; });
        v.play();
        await new Promise((r) => {
          const tick = () => {
            if (cancelRef.current) { v.pause(); r(); return; }
            if (v.currentTime >= seg.end) {
              v.pause();
              elapsed += seg.end - seg.start;
              setStepPct(Math.min(99, Math.round((elapsed / total) * 100)));
              r();
            } else {
              requestAnimationFrame(tick);
            }
          };
          tick();
        });
      }
      setStepPct(100);
      rec.stop();
    } catch (err) {
      audioCtxR.current?.close();
      audioCtxR.current = null;
      setStep("done");
      showToast("Erro na exportação: " + err.message, true);
    }
  };

  const cancelAll = () => {
    cancelRef.current = true;
    workerRef.current?.terminate();
    videoRef.current?.pause();
    audioCtxR.current?.close();
    audioCtxR.current = null;
    setStep(null);
    setPipeError(null);
    setStepLabel("");
    setIsPlaying(false);
  };

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 5000);
  };

  const Toggle = ({ on, onChange }) => (
    <button style={C.toggle(on)} onClick={() => onChange(!on)}>
      <div style={C.knob(on)} />
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={C.page}>
      <style>{`
        @keyframes ev_slide { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes ev_spin  { to{transform:rotate(360deg)} }
        .ev-up:hover { border-color:var(--color-primary)!important;background:#F3E5E2!important; }
        .ev-exp:hover { opacity:.88; }
        .ev-ib:hover  { color:#fff!important; }
        select.ev-sel { appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238C7573'/%3E%3C/svg%3E") no-repeat right 8px center;padding-right:24px; }
      `}</style>

      {/* Header */}
      <div style={C.hdr}>
        <div style={C.hdrTitle}>
          <Film size={20} /> Editor de Vídeo Automático
          <span style={C.badge}>100% local no navegador · sem banco de dados</span>
        </div>
        {isDone && segments.length > 0 && (
          <button className="ev-exp" style={C.expBtn} onClick={runExport} disabled={isExp}>
            <Download size={13} /> Exportar {exportExt}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={C.body}>
        {/* ── Left panel ── */}
        <div style={C.panel}>

          {/* Upload */}
          <div style={C.sec}>
            <div style={C.secT}><Upload size={11} /> Arquivo de Vídeo</div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => loadFile(e.target.files[0])}
            />
            {!videoSrc ? (
              <div
                className="ev-up"
                style={{ ...C.uploadZone, borderColor: dragOver ? "var(--color-primary)" : "var(--border-color)" }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]); }}
              >
                <Film size={32} color="var(--color-primary)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-medium)" }}>
                  Arraste ou clique para enviar
                </div>
                <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>
                  MP4, MOV ou WebM (máx. 5 minutos)
                </div>
              </div>
            ) : (
              <div style={C.fileChosen}>
                <CheckCircle2 size={14} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fileName}
                </span>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6B9B7A", padding: 0 }}
                  onClick={() => fileRef.current?.click()}
                  title="Trocar vídeo"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Settings & Action */}
          {!isRunning && !isExp && (
            <div style={C.sec}>
              <div style={C.secT}><Settings2 size={11} /> Configurações de Edição</div>

              <label style={C.lbl}>Sensibilidade de corte dos silêncios</label>
              <select
                className="ev-sel"
                style={{ ...C.inp, marginBottom: 12 }}
                value={settings.sensitivity}
                onChange={(e) => setSettings((s) => ({ ...s, sensitivity: e.target.value }))}
              >
                <option value="suave">Suave — corta pausas {">"} 0.50 s</option>
                <option value="normal">Normal — corta pausas {">"} 0.35 s (Recomendado)</option>
                <option value="agressivo">Agressivo — corta pausas {">"} 0.20 s</option>
              </select>

              {[
                { key: "enableCaptions", label: "Legenda animada palavra por palavra" },
                { key: "enableAudio",    label: "Melhora de áudio (redução de ruído e volume)" },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-medium)" }}>{label}</span>
                  <Toggle on={settings[key]} onChange={(v) => setSettings((s) => ({ ...s, [key]: v }))} />
                </div>
              ))}

              <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--border-color)" }}>
                <div style={{ ...C.secT, marginBottom: 7 }}><ImagePlus size={11} /> B-roll automático (opcional)</div>
                <input
                  ref={brollFileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(event) => {
                    addBrollFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => brollFileRef.current?.click()}
                  disabled={!videoSrc || brollAssets.length >= 8}
                  style={{ width: "100%", border: "1px dashed var(--border-color)", borderRadius: 7, padding: "8px 9px", background: "var(--bg-main)", color: "var(--text-medium)", cursor: videoSrc ? "pointer" : "not-allowed", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <ImagePlus size={13} /> Adicionar fotos ou vídeos
                </button>
                <p style={{ fontSize: 9.5, color: "var(--text-light)", margin: "5px 0 0", lineHeight: 1.4 }}>
                  O editor distribui as mídias sobre a fala e mantém o áudio principal. Máximo de 8 arquivos.
                </p>

                {brollAssets.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                    {brollAssets.map(asset => (
                      <div key={asset.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-accent-soft)", borderRadius: 6, padding: "5px 7px", fontSize: 10 }}>
                        <Film size={11} color="var(--color-primary)" />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-medium)" }}>{asset.name}</span>
                        <button type="button" onClick={() => removeBrollAsset(asset.id)} title="Remover B-roll" style={{ border: "none", background: "none", color: "var(--text-light)", cursor: "pointer", padding: 1 }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                style={{ ...C.bigBtn(!videoSrc), marginTop: 12 }}
                disabled={!videoSrc}
                onClick={runPipeline}
              >
                <Sparkles size={16} /> ✨ Editar automaticamente
              </button>
              <p style={{ fontSize: 10, color: "var(--text-light)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
                100% no navegador: corta pausas, remove repetições, sincroniza legendas e posiciona o B-roll.
              </p>
            </div>
          )}

          {/* Progress */}
          {(isRunning || isExp) && (
            <div style={C.sec}>
              <div style={C.secT}>
                <Loader2 size={12} style={{ animation: "ev_spin 1s linear infinite" }} /> Processando vídeo…
              </div>
              {STEPS.map((s, i) => {
                const st = i < stepIdx ? "done" : i === stepIdx ? "active" : "idle";
                return (
                  <div key={s.key} style={C.stepRow}>
                    <div style={C.dot(st)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: st === "idle" ? "var(--text-light)" : "var(--text-dark)", fontWeight: st === "active" ? 600 : 400 }}>
                        {s.label}
                      </div>
                      {st === "active" && (
                        <>
                          <div style={{ fontSize: 10, color: "var(--text-light)", marginTop: 2 }}>{stepLabel}</div>
                          <div style={C.pbar}><div style={{ ...C.pfill, width: `${stepPct}%` }} /></div>
                        </>
                      )}
                    </div>
                    {st === "done" && <CheckCircle2 size={12} color="var(--success)" />}
                  </div>
                );
              })}

              {isExp && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-medium)", marginBottom: 4 }}>Renderizando arquivo {exportExt}…</div>
                  <div style={C.pbar}><div style={{ ...C.pfill, width: `${stepPct}%` }} /></div>
                  <div style={{ fontSize: 10, color: "var(--text-light)", marginTop: 2 }}>{stepPct}%</div>
                </div>
              )}

              <button
                onClick={cancelAll}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid #f5c0c0", borderRadius: 7, padding: "6px 0", cursor: "pointer", fontSize: 11, fontWeight: 600, width: "100%", justifyContent: "center", marginTop: 12 }}
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Results */}
          {isDone && (
            <div style={C.sec}>
              <div style={C.secT}><CheckCircle2 size={11} color="var(--success)" /> Edição Concluída</div>

              {noWhisper && (
                <div style={C.warnBox}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    A transcrição com IA não ficou disponível neste navegador. As pausas ainda foram removidas pela análise acústica e o áudio foi tratado, mas esta versão será exportada sem legendas.
                  </span>
                </div>
              )}

              {segments.length > 0 ? (
                <>
                  <div style={C.statBox}>
                    <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>
                      <Clock size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />
                      Duração original → editada
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
                      <span style={{ color: "var(--text-light)" }}>{fmt(origDur)}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                      <span style={{ color: "var(--color-primary)" }}>{fmt(finalDur)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--success)", marginTop: 3 }}>
                      {Math.max(0, Math.round((1 - finalDur / (origDur || 1)) * 100))}% mais dinâmico · {segments.length} trechos
                    </div>
                  </div>

                  <button style={C.bigBtn(false)} onClick={runExport}>
                    <Download size={14} /> Baixar Vídeo ({exportExt})
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "var(--text-light)", textAlign: "center", padding: "6px 0" }}>
                  Nenhum corte foi necessário com a sensibilidade atual. Experimente &quot;Agressivo&quot;.
                </div>
              )}

              <button
                onClick={() => { setStep(null); setPipeError(null); setNoWhisper(false); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--color-accent-soft)", color: "var(--text-medium)", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 0", cursor: "pointer", fontSize: 11, width: "100%", justifyContent: "center", marginTop: 8 }}
              >
                <RefreshCw size={11} /> Ajustar e refazer análise
              </button>

              {captions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={C.secT}><span>Legendas Geradas ({captions.length})</span></div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }}>
                    {captions.map((cap) => (
                      <div key={cap.id} style={C.capCard}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{cap.text}</div>
                        <div style={{ fontSize: 10, color: "var(--text-light)" }}>
                          {fmt(cap.startTime)} → {fmt(cap.endTime)}
                        </div>
                        <button
                          style={{ position: "absolute", top: 5, right: 5, background: "none", border: "none", cursor: "pointer", color: "var(--text-light)", padding: 2 }}
                          onClick={() => setCaptions((p) => p.filter((c) => c.id !== cap.id))}
                          title="Remover legenda"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div style={C.sec}>
              <div style={{ background: "var(--danger-bg)", border: "1px solid #f5c0c0", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <AlertCircle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", marginBottom: 3 }}>Erro na análise</div>
                    <div style={{ fontSize: 11, color: "var(--text-medium)", wordBreak: "break-word" }}>{pipeError}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setStep(null); setPipeError(null); }}
                style={{ ...C.bigBtn(false), fontSize: 12 }}
              >
                <RefreshCw size={13} /> Tentar novamente
              </button>
            </div>
          )}
        </div>

        {/* ── Canvas / Preview ── */}
        <div style={C.preview}>
          <video
            ref={videoRef}
            src={videoSrc || ""}
            style={{ display: "none" }}
            muted={muted}
            preload="auto"
            crossOrigin="anonymous"
          />

          <div style={C.canvasWrap}>
            {!videoSrc ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", pointerEvents: "none" }}>
                <Film size={56} style={{ marginBottom: 12, opacity: 0.35 }} />
                <div style={{ fontSize: 14, opacity: 0.5, fontWeight: 500 }}>Nenhum vídeo carregado</div>
                <div style={{ fontSize: 11, opacity: 0.3, marginTop: 4 }}>Escolha ou arraste um vídeo no painel à esquerda</div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                style={{ maxWidth: "100%", maxHeight: "100%", display: "block", borderRadius: 4, boxShadow: "0 4px 28px rgba(0,0,0,.5)" }}
              />
            )}

            {/* Export overlay */}
            {isExp && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <Loader2 size={36} color="#C8A26A" style={{ animation: "ev_spin 1s linear infinite" }} />
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Exportando vídeo auto-editado…</div>
                <div style={{ width: 220, height: 5, background: "rgba(255,255,255,.2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${stepPct}%`, height: "100%", background: "linear-gradient(90deg,#B3857A,#C8A26A)", transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)" }}>{stepPct}%</div>
                <button
                  onClick={cancelAll}
                  style={{ color: "rgba(255,255,255,.7)", background: "none", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, padding: "4px 14px", cursor: "pointer", fontSize: 11 }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Playback bar */}
          {videoSrc && (
            <div style={C.ctrl}>
              <input
                type="range"
                style={{ width: "100%", accentColor: "#B3857A", height: 4 }}
                min={0}
                max={duration}
                step={0.05}
                value={Math.min(currentTime, duration)}
                onChange={(e) => {
                  const v = videoRef.current;
                  if (v) {
                    v.currentTime = +e.target.value;
                    setCurrentTime(+e.target.value);
                  }
                }}
              />
              <div style={C.playRow}>
                <button
                  style={C.iconBtn}
                  className="ev-ib"
                  onClick={() => {
                    const v = videoRef.current;
                    if (v) {
                      const firstSegStart = segmentsRef.current.length > 0 ? segmentsRef.current[0].start : 0;
                      v.currentTime = firstSegStart;
                      setCurrentTime(firstSegStart);
                    }
                  }}
                  title="Voltar ao início"
                >
                  <SkipBack size={15} />
                </button>
                <button
                  style={{ ...C.iconBtn, background: "var(--color-primary)", borderRadius: "50%", padding: 7 }}
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (v.paused) {
                      v.play();
                      setIsPlaying(true);
                    } else {
                      v.pause();
                      setIsPlaying(false);
                    }
                  }}
                  title={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
                </button>
                <button
                  style={C.iconBtn}
                  className="ev-ib"
                  onClick={() => {
                    const v = videoRef.current;
                    if (v) {
                      v.currentTime = duration;
                    }
                  }}
                  title="Avançar ao fim"
                >
                  <SkipForward size={15} />
                </button>
                <button
                  style={C.iconBtn}
                  className="ev-ib"
                  onClick={() => {
                    if (videoRef.current) videoRef.current.muted = !muted;
                    setMuted((m) => !m);
                  }}
                  title={muted ? "Ativar som" : "Desativar som"}
                >
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>

                <span style={C.timeTxt}>{fmt(currentTime)} / {fmt(duration)}</span>

                {isDone && segments.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(179,133,122,.9)", fontWeight: 500 }}>
                    {segments.length} trechos · {fmt(finalDur)} finais
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...C.toast, borderLeft: `3px solid ${toast.isError ? "var(--danger)" : "var(--success)"}` }}>
          {toast.isError ? <AlertCircle size={15} color="var(--danger)" /> : <CheckCircle2 size={15} color="var(--success)" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
