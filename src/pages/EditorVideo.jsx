import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Download, Play, Pause, SkipBack, SkipForward,
  Type, Sliders, Scissors, Trash2, Plus, Film, CheckCircle2,
  AlertCircle, Loader2, Volume2, VolumeX, Sparkles, Settings2,
  ChevronDown, RefreshCw, Clock
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const MAX_VIDEO_DURATION = 5 * 60; // 5 minutes

const SENSITIVITY = {
  suave:     { minPauseS: 0.50, paddingS: 0.15, rmsRatio: 0.08 },
  normal:    { minPauseS: 0.35, paddingS: 0.12, rmsRatio: 0.12 },
  agressivo: { minPauseS: 0.20, paddingS: 0.08, rmsRatio: 0.18 },
};

const PIPELINE_STEPS = [
  { key: "loading_model",  label: "Carregando modelo de IA"   },
  { key: "extracting",     label: "Extraindo audio"            },
  { key: "transcribing",   label: "Transcrevendo fala"         },
  { key: "analyzing",      label: "Analisando silêncios"       },
  { key: "done",           label: "Pronto para exportar"       },
  { key: "exporting",      label: "Exportando video"           },
];

const DEFAULT_FILTERS  = { brightness: 100, contrast: 100, saturation: 100, sepia: 0, blur: 0 };
const DEFAULT_CAPTION  = { text: "", startTime: 0, endTime: 3, x: 50, y: 85, size: 32, color: "#FFFFFF" };

const PRESETS = [
  { label: "Original", v: { brightness: 100, contrast: 100, saturation: 100, sepia: 0,  blur: 0   } },
  { label: "Vintage",  v: { brightness: 95,  contrast: 105, saturation: 70,  sepia: 40, blur: 0   } },
  { label: "Vivo",     v: { brightness: 110, contrast: 115, saturation: 150, sepia: 0,  blur: 0   } },
  { label: "Suave",    v: { brightness: 105, contrast: 90,  saturation: 80,  sepia: 10, blur: 0.5 } },
  { label: "P&B",      v: { brightness: 100, contrast: 120, saturation: 0,   sepia: 0,  blur: 0   } },
  { label: "Quente",   v: { brightness: 108, contrast: 105, saturation: 120, sepia: 25, blur: 0   } },
];

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────
const S = {
  page:        { minHeight: "100vh", background: "var(--bg-main)", fontFamily: "var(--font-sans)", color: "var(--text-dark)", display: "flex", flexDirection: "column" },
  header:      { padding: "14px 24px", borderBottom: "1px solid var(--border-color)", background: "#fff", display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-sm)", flexWrap: "wrap" },
  headerTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--color-primary)", marginRight: "auto" },
  badge:       { fontSize: 11, background: "var(--color-accent-soft)", color: "var(--text-light)", padding: "2px 8px", borderRadius: 20, fontWeight: 500 },
  body:        { flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", overflow: "hidden", minHeight: 0 },
  panel:       { background: "#fff", borderRight: "1px solid var(--border-color)", overflowY: "auto", display: "flex", flexDirection: "column" },
  section:     { borderBottom: "1px solid var(--border-color)", padding: "14px 18px" },
  secTitle:    { display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-light)", marginBottom: 12 },
  label:       { fontSize: 12, fontWeight: 600, color: "var(--text-medium)", marginBottom: 5, display: "block" },
  slider:      { width: "100%", accentColor: "var(--color-primary)", cursor: "pointer" },
  input:       { width: "100%", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 9px", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--text-dark)", background: "#fff", outline: "none", boxSizing: "border-box" },
  row:         { display: "flex", gap: 8, marginTop: 8 },
  filterGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" },
  fileChosen:  { display: "flex", alignItems: "center", gap: 8, background: "var(--success-bg)", border: "1px solid #a6d1b3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3a7a50" },
  uploadZone:  { border: "2px dashed var(--border-color)", borderRadius: 10, padding: "24px 12px", textAlign: "center", cursor: "pointer", background: "var(--color-accent-soft)", transition: "all .2s" },
  captionCard: { border: "1px solid var(--border-color)", borderRadius: 7, padding: "8px 10px", marginBottom: 6, fontSize: 12, position: "relative", background: "var(--bg-main)" },
  preview:     { flex: 1, display: "flex", flexDirection: "column", background: "#1a1014", overflow: "hidden" },
  canvasWrap:  { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", minHeight: 0 },
  controls:    { background: "#241418", borderTop: "1px solid rgba(255,255,255,.08)", padding: "10px 18px", display: "flex", flexDirection: "column", gap: 7 },
  playRow:     { display: "flex", alignItems: "center", gap: 10 },
  timeDisp:    { fontSize: 11, color: "rgba(255,255,255,.6)", fontVariantNumeric: "tabular-nums", minWidth: 88 },
  iconBtn:     { background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.85)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" },
  exportBtn:   { display: "inline-flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#B3857A,#C8A26A)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(179,133,122,.35)" },
  toast:       { position: "fixed", bottom: 24, right: 24, background: "#fff", border: "1px solid var(--border-color)", borderRadius: 10, padding: "10px 16px", boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, zIndex: 9999, animation: "ev_slideIn .25s ease" },
  modeTabs:    { display: "flex", gap: 4, background: "var(--bg-main)", borderRadius: 8, padding: 3 },
  modeTab:     (active) => ({ padding: "5px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", transition: "all .15s", background: active ? "var(--color-primary)" : "transparent", color: active ? "#fff" : "var(--text-light)" }),
  bigBtn:      { width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#B3857A,#C8A26A)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 3px 12px rgba(179,133,122,.4)", transition: "opacity .15s" },
  stepRow:     { display: "flex", alignItems: "center", gap: 10, padding: "7px 0" },
  stepDot:     (status) => ({ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: status === "done" ? "var(--success)" : status === "active" ? "var(--color-primary)" : "var(--border-color)" }),
  progressBar: { height: 5, borderRadius: 3, background: "var(--color-accent-soft)", overflow: "hidden", marginTop: 4 },
  progressFill:{ height: "100%", background: "linear-gradient(90deg,#B3857A,#C8A26A)", transition: "width .4s" },
  statBox:     { background: "var(--color-accent-soft)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
  toggle:      (on) => ({ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: on ? "var(--color-primary)" : "var(--border-color)", position: "relative", transition: "background .2s", flexShrink: 0 }),
  toggleKnob:  (on) => ({ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .2s" }),
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

/** Normalize Whisper output (chunks with timestamp arrays) into flat word list */
function normalizeWords(output) {
  if (!output) return [];
  const chunks = output.chunks || (Array.isArray(output) ? output : []);
  return chunks
    .filter((c) => Array.isArray(c.timestamp) && c.timestamp.length === 2 && c.timestamp[0] != null)
    .map((c) => ({
      text: (c.text || c.word || "").replace(/^\s+/, ""),
      start: c.timestamp[0],
      end:   c.timestamp[1] ?? c.timestamp[0] + 0.3,
    }))
    .filter((c) => c.text.length > 0);
}

/** Extract mono Float32Array at 16 kHz (required by Whisper) from a File/Blob */
async function extractAudio16k(file) {
  const ctx = new AudioContext();
  const buf = await file.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buf);
  ctx.close();

  const targetSR = 16000;
  const offCtx = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * targetSR),
    targetSR
  );
  const src = offCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offCtx.destination);
  src.start(0);
  const resampled = await offCtx.startRendering();
  return resampled.getChannelData(0); // Float32Array @ 16 kHz
}

/** Compute RMS per windowMs window */
function computeRMS(mono, sampleRate, windowMs = 20) {
  const ws = Math.floor(sampleRate * (windowMs / 1000));
  const result = [];
  for (let i = 0; i < mono.length; i += ws) {
    const chunk = mono.subarray(i, i + ws);
    const rms = Math.sqrt(chunk.reduce((s, v) => s + v * v, 0) / chunk.length);
    result.push({ t: i / sampleRate, rms });
  }
  return result;
}

/** Find silent intervals using adaptive RMS threshold */
function detectSilences(rmsData, cfg) {
  const maxRMS = Math.max(...rmsData.map((d) => d.rms), 0.001);
  const threshold = maxRMS * cfg.rmsRatio;
  const silences = [];
  let silStart = null;

  for (const { t, rms } of rmsData) {
    if (rms < threshold) {
      if (silStart === null) silStart = t;
    } else {
      if (silStart !== null) {
        const dur = t - silStart;
        if (dur >= cfg.minPauseS) {
          silences.push({
            start: silStart + cfg.paddingS,
            end:   t - cfg.paddingS,
          });
        }
        silStart = null;
      }
    }
  }
  return silences;
}

/** Convert silence list → speech segment list */
function silencesToSegments(silences, totalDuration) {
  const segs = [];
  let cursor = 0;
  for (const sil of silences) {
    const end = Math.max(cursor + 0.05, sil.start);
    if (end - cursor > 0.1) segs.push({ start: cursor, end });
    cursor = sil.end;
  }
  if (totalDuration - cursor > 0.1) {
    segs.push({ start: cursor, end: totalDuration });
  }
  return segs;
}

/** Simple repetition removal: if adjacent segments share >=2 opening words, keep the later one */
function removeRepetitions(segments, words) {
  const normalize = (s) =>
    (s || "").toLowerCase().replace(/[^a-záéíóúãõâêôçü]/g, "");

  const withWords = segments.map((seg) => ({
    ...seg,
    words: words.filter(
      (w) => w.start >= seg.start - 0.1 && w.end <= seg.end + 0.1
    ),
  }));

  const result = [];
  for (const seg of withWords) {
    if (result.length === 0) { result.push(seg); continue; }
    const prev = result[result.length - 1];
    const cmpLen = Math.min(4, prev.words.length, seg.words.length);
    if (cmpLen < 2) { result.push(seg); continue; }

    let matches = 0;
    for (let i = 0; i < cmpLen; i++) {
      if (normalize(prev.words[i]?.text) === normalize(seg.words[i]?.text)) {
        matches++;
      }
    }
    if (matches >= 2) {
      result[result.length - 1] = seg; // replace with later take
    } else {
      result.push(seg);
    }
  }
  return result;
}

/** Group words into subtitle chunks (max N words each) */
function groupIntoPhrases(words, maxN = 4) {
  const phrases = [];
  for (let i = 0; i < words.length; i += maxN) {
    const slice = words.slice(i, i + maxN);
    phrases.push({
      id: Date.now() + i,
      text: slice.map((w) => w.text).join(" "),
      startTime: slice[0].start,
      endTime:   slice[slice.length - 1].end,
      words:     slice,
      x: 50, y: 85, size: 36, color: "#FFFFFF",
    });
  }
  return phrases;
}

/** Draw animated word-by-word caption on canvas */
function drawWordCaption(ctx, autoWords, currentTime, cw, ch) {
  // Find current word
  const currIdx = autoWords.findIndex(
    (w) => currentTime >= w.start && currentTime < w.end
  );
  if (currIdx < 0) return;

  // 4-word window centred near current word
  const start = Math.max(0, currIdx - 1);
  const slice = autoWords.slice(start, start + 4);

  const fontSize = Math.max(28, Math.floor(cw / 28));
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const line = slice.map((w) => w.text).join(" ");
  const lineW = ctx.measureText(line).width;
  const yBase = ch * 0.87;
  const pad = 14;

  // Background pill
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cw / 2 - lineW / 2 - pad, yBase - fontSize / 2 - 8, lineW + pad * 2, fontSize + 22, 8);
  } else {
    ctx.rect(cw / 2 - lineW / 2 - pad, yBase - fontSize / 2 - 8, lineW + pad * 2, fontSize + 22);
  }
  ctx.fill();

  // Draw words
  let x = cw / 2 - lineW / 2;
  for (let i = 0; i < slice.length; i++) {
    const word = slice[i];
    const globalIdx = start + i;
    const isCurrent = globalIdx === currIdx;
    ctx.font = `${isCurrent ? "bold" : "600"} ${fontSize}px Inter, sans-serif`;
    ctx.shadowColor = "rgba(0,0,0,.7)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = isCurrent ? "#FFD700" : "#FFFFFF";
    ctx.fillText(word.text, x + ctx.measureText(word.text).width / 2, yBase);
    x += ctx.measureText(word.text + " ").width;
    ctx.shadowBlur = 0;
  }
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────
export default function EditorVideo() {
  // ── Shared state ──────────────────────────────────────
  const [videoSrc,    setVideoSrc]    = useState(null);
  const [videoFile,   setVideoFile]   = useState(null);
  const [fileName,    setFileName]    = useState("");
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [dragOver,    setDragOver]    = useState(false);

  // ── Manual edit state ─────────────────────────────────
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd,   setTrimEnd]   = useState(0);
  const [filters,   setFilters]   = useState({ ...DEFAULT_FILTERS });
  const [captions,  setCaptions]  = useState([]);
  const [newCap,    setNewCap]    = useState({ ...DEFAULT_CAPTION });

  // ── Mode / auto-edit state ────────────────────────────
  const [autoMode,      setAutoMode]      = useState(false);
  const [autoStep,      setAutoStep]      = useState(null);
  const [autoStepLabel, setAutoStepLabel] = useState("");
  const [autoStepPct,   setAutoStepPct]   = useState(0);
  const [autoError,     setAutoError]     = useState(null);
  const [autoSegments,  setAutoSegments]  = useState([]);
  const [autoWords,     setAutoWords]     = useState([]);
  const [origDuration,  setOrigDuration]  = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [modelDevice,   setModelDevice]   = useState(null);
  const [autoSettings,  setAutoSettings]  = useState({
    sensitivity:   "normal",
    enableCaptions: true,
    enableZoom:     true,
    enableAudio:    true,
  });

  // ── Export state ──────────────────────────────────────
  const [exporting,       setExporting]       = useState(false);
  const [exportProgress,  setExportProgress]  = useState(0);
  const [toast,           setToast]           = useState(null);

  // ── Refs ──────────────────────────────────────────────
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const fileInputRef = useRef(null);
  const workerRef    = useRef(null);
  const audioCtxRef  = useRef(null);
  const cancelRef    = useRef(false);
  const zoomRef      = useRef(1.0);

  // ── Load video ────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("video/")) return;

    if (duration > MAX_VIDEO_DURATION) {
      showToast(`Vídeo excede o limite de 5 minutos (${fmt(file.duration)}).`, true);
      return;
    }

    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFile(file);
    setFileName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setFilters({ ...DEFAULT_FILTERS });
    setCaptions([]);
    setAutoSegments([]);
    setAutoWords([]);
    setAutoStep(null);
    zoomRef.current = 1.0;
  }, [videoSrc, duration]);

  const onFileChange = (e) => loadFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  };

  // ── Video element events ──────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta  = () => {
      if (v.duration > MAX_VIDEO_DURATION) {
        showToast(`Vídeo com ${fmt(v.duration)} excede o limite de 5 minutos.`, true);
        setVideoSrc(null);
        setVideoFile(null);
        return;
      }
      setDuration(v.duration);
      setTrimStart(0);
      setTrimEnd(v.duration);
    };
    const onTime  = () => setCurrentTime(v.currentTime);
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

  // ── Canvas draw ───────────────────────────────────────
  const filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`;

  const drawFrame = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !videoSrc) return;
    const ctx = c.getContext("2d");

    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width  = v.videoWidth  || 1280;
      c.height = v.videoHeight || 720;
    }

    // Update zoom
    if (autoMode && autoSettings.enableZoom && autoSegments.length > 0) {
      const ct = v.currentTime;
      const segIdx = autoSegments.findIndex((s) => ct >= s.start && ct < s.end);
      const target = segIdx >= 0 ? (segIdx % 2 === 0 ? 1.0 : 1.08) : 1.0;
      zoomRef.current += (target - zoomRef.current) * 0.04;
    } else if (!autoMode || !autoSettings.enableZoom) {
      zoomRef.current += (1.0 - zoomRef.current) * 0.1;
    }

    const scale = zoomRef.current;

    // Draw video with zoom
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-c.width / 2, -c.height / 2);
    ctx.filter = filterString;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.filter = "none";
    ctx.restore();

    const ct = v.currentTime;

    // Manual captions
    if (!autoMode) {
      captions.forEach((cap) => {
        if (ct < cap.startTime || ct > cap.endTime) return;
        const xPx = (cap.x / 100) * c.width;
        const yPx = (cap.y / 100) * c.height;
        ctx.font = `bold ${cap.size || 32}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,.7)";
        ctx.shadowBlur  = 8;
        ctx.fillStyle   = cap.color || "#fff";
        ctx.fillText(cap.text, xPx, yPx);
        ctx.shadowBlur  = 0;
      });
    }

    // Auto-mode word captions
    if (autoMode && autoSettings.enableCaptions && autoWords.length > 0) {
      drawWordCaption(ctx, autoWords, ct, c.width, c.height);
    }

    // Trim boundary (manual mode)
    if (!autoMode && !v.paused && ct >= trimEnd) {
      v.pause();
      v.currentTime = trimEnd;
      setIsPlaying(false);
    }

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [videoSrc, filterString, captions, trimEnd, autoMode, autoSettings, autoWords, autoSegments]);

  useEffect(() => {
    if (videoSrc) rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoSrc, drawFrame]);

  // ── Playback ──────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (!autoMode && (v.currentTime < trimStart || v.currentTime >= trimEnd)) {
        v.currentTime = trimStart;
      }
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const seek = (val) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(val);
    setCurrentTime(Number(val));
  };

  // ── Toast ─────────────────────────────────────────────
  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Manual export (MediaRecorder) ─────────────────────
  const exportManual = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !videoSrc) return;
    const trimDuration = trimEnd - trimStart;
    if (trimDuration <= 0) { showToast("Defina um intervalo válido.", true); return; }

    setExporting(true);
    setExportProgress(0);
    chunksRef.current = [];

    const canvasStream = c.captureStream(30);
    try {
      const vs = v.captureStream ? v.captureStream() : null;
      if (vs) vs.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch (_) {}

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus" : "video/webm";
    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 5_000_000 });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fileName.replace(/\.[^.]+$/, "") + "_editado.webm"; a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      setExportProgress(0);
      showToast("Download iniciado! Arquivo .webm salvo.");
    };

    v.currentTime = trimStart;
    await new Promise((r) => { v.onseeked = r; });
    v.play();
    recorder.start(100);

    const startAt = Date.now();
    const ticker = setInterval(() => {
      const elapsed = (Date.now() - startAt) / 1000;
      setExportProgress(Math.min(99, (elapsed / trimDuration) * 100));
      if (elapsed >= trimDuration + 0.3) {
        clearInterval(ticker);
        v.pause();
        recorder.stop();
      }
    }, 200);
  };

  // ── Auto-edit pipeline ────────────────────────────────
  const runAutoEdit = async () => {
    if (!videoFile || !videoRef.current) return;

    cancelRef.current = false;
    setAutoError(null);
    setAutoSegments([]);
    setAutoWords([]);
    zoomRef.current = 1.0;

    const step = (key, label, pct = 0) => {
      setAutoStep(key);
      setAutoStepLabel(label);
      setAutoStepPct(pct);
    };

    try {
      // ── 1. Load model ────────────────────────────────
      step("loading_model", "Carregando modelo de IA (Whisper ~150 MB)…");

      // Terminate previous worker if any
      workerRef.current?.terminate();

      let worker;
      try {
        worker = new Worker(
          new URL("../workers/whisperWorker.js", import.meta.url),
          { type: "module" }
        );
      } catch (e) {
        throw new Error("Web Worker não suportado neste navegador. Tente Chrome ou Edge.");
      }
      workerRef.current = worker;

      const device = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data.type === "ready")          resolve(data.device);
          if (data.type === "error")          reject(new Error(data.error));
          if (data.type === "model_progress") {
            const p = data.progress;
            if (p?.status === "progress" && p.total > 0) {
              setAutoStepPct(Math.round((p.loaded / p.total) * 100));
            }
          }
        };
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage({ type: "load" });
      });

      if (cancelRef.current) { worker.terminate(); return; }
      setModelDevice(device);
      setAutoStepPct(100);

      // ── 2. Extract audio ─────────────────────────────
      step("extracting", "Extraindo áudio do vídeo…");
      const audio16k = await extractAudio16k(videoFile);
      if (cancelRef.current) { worker.terminate(); return; }
      setAutoStepPct(100);

      // ── 3. Transcribe ─────────────────────────────────
      step("transcribing", "Transcrevendo fala com Whisper…");

      const whisperOutput = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data.type === "result") resolve(data.output);
          if (data.type === "error")  reject(new Error(data.error));
        };
        worker.postMessage({ type: "transcribe", audio: audio16k });
      });

      if (cancelRef.current) { worker.terminate(); return; }
      worker.terminate();
      setAutoStepPct(100);

      const words = normalizeWords(whisperOutput);

      // ── 4. Analyze ───────────────────────────────────
      step("analyzing", "Analisando silêncios e repetições…");

      const cfg      = SENSITIVITY[autoSettings.sensitivity];
      const rmsData  = computeRMS(audio16k, 16000, 20);
      const silences = detectSilences(rmsData, cfg);
      const rawSegs  = silencesToSegments(silences, videoRef.current.duration);
      const segs     = removeRepetitions(rawSegs, words);

      const segsWithWords = segs.map((s) => ({
        ...s,
        words: words.filter((w) => w.start >= s.start - 0.1 && w.end <= s.end + 0.1),
      }));

      const finalDur = segs.reduce((sum, s) => sum + (s.end - s.start), 0);

      setAutoSegments(segsWithWords);
      setAutoWords(words);
      setOrigDuration(videoRef.current.duration);
      setFinalDuration(finalDur);

      // Populate captions list (phrase groups so user can edit)
      if (words.length > 0) {
        setCaptions(groupIntoPhrases(words, 4));
      }

      setAutoStepPct(100);

      // ── Done ─────────────────────────────────────────
      step("done", `Pronto! ${segsWithWords.length} trecho(s) identificado(s).`, 100);
      showToast(`Análise concluída — ${segsWithWords.length} trechos, ${fmt(finalDur)} finais.`);

    } catch (err) {
      if (!cancelRef.current) {
        setAutoStep("error");
        setAutoError(err.message);
        showToast("Erro: " + err.message, true);
      }
      workerRef.current?.terminate();
    }
  };

  // ── Auto export (segment-by-segment loop) ─────────────
  const runAutoExport = async () => {
    if (autoSegments.length === 0) return;

    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    setAutoStep("exporting");
    setAutoStepLabel("Exportando vídeo…");
    setAutoStepPct(0);
    cancelRef.current = false;
    chunksRef.current = [];

    try {
      // ── Audio filter chain ─────────────────────────
      const canvasStream = c.captureStream(30);

      if (autoSettings.enableAudio) {
        try {
          const actx   = new AudioContext();
          audioCtxRef.current = actx;
          const src    = actx.createMediaElementSource(v);
          const hp     = actx.createBiquadFilter();
          hp.type = "highpass"; hp.frequency.value = 80;
          const cmp    = actx.createDynamicsCompressor();
          cmp.threshold.value = -18; cmp.ratio.value = 3;
          const gain   = actx.createGain();
          gain.gain.value = 1.3;
          const dest   = actx.createMediaStreamDestination();
          src.connect(hp); hp.connect(cmp); cmp.connect(gain);
          gain.connect(dest);
          gain.connect(actx.destination); // hear during export
          canvasStream.addTrack(dest.stream.getAudioTracks()[0]);
        } catch (audioErr) {
          // Audio enhancement unavailable — continue without it
          try {
            const vs = v.captureStream ? v.captureStream() : null;
            if (vs) vs.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
          } catch (_) {}
        }
      } else {
        try {
          const vs = v.captureStream ? v.captureStream() : null;
          if (vs) vs.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
        } catch (_) {}
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus" : "video/webm";
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 6_000_000 });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = fileName.replace(/\.[^.]+$/, "") + "_auto_editado.webm";
        a.click();
        URL.revokeObjectURL(url);
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        setAutoStep("done");
        setAutoStepLabel("Download iniciado!");
        showToast("Vídeo exportado em .webm. Abra no VLC ou Chrome.");
      };

      recorder.start(100);
      v.muted = false;

      const totalDur = autoSegments.reduce((s, seg) => s + (seg.end - seg.start), 0);
      let elapsed = 0;

      for (const seg of autoSegments) {
        if (cancelRef.current) break;

        v.currentTime = seg.start;
        await new Promise((res) => { v.onseeked = res; });
        v.play();

        await new Promise((res) => {
          const tick = () => {
            if (cancelRef.current) { v.pause(); res(); return; }
            if (v.currentTime >= seg.end) {
              v.pause();
              elapsed += seg.end - seg.start;
              setAutoStepPct(Math.round((elapsed / totalDur) * 100));
              res();
            } else {
              requestAnimationFrame(tick);
            }
          };
          tick();
        });
      }

      recorder.stop();

    } catch (err) {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setAutoStep("error");
      setAutoError("Erro na exportação: " + err.message);
      showToast("Erro: " + err.message, true);
    }
  };

  const cancelAuto = () => {
    cancelRef.current = true;
    workerRef.current?.terminate();
    videoRef.current?.pause();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setAutoStep(null);
    setAutoError(null);
    setAutoStepLabel("");
    setExporting(false);
    setIsPlaying(false);
  };

  // ── Caption helpers ───────────────────────────────────
  const addCaption = () => {
    if (!newCap.text.trim()) return;
    setCaptions((p) => [...p, { ...newCap, id: Date.now() }]);
    setNewCap({ ...DEFAULT_CAPTION });
  };
  const removeCaption = (id) => setCaptions((p) => p.filter((c) => c.id !== id));

  // ── Toggle helper ─────────────────────────────────────
  const Toggle = ({ on, onChange }) => (
    <button style={S.toggle(on)} onClick={() => onChange(!on)}>
      <div style={S.toggleKnob(on)} />
    </button>
  );

  const isRunning = autoStep && autoStep !== "done" && autoStep !== "error";
  const isDone    = autoStep === "done";
  const isError   = autoStep === "error";

  const stepIndex = PIPELINE_STEPS.findIndex((s) => s.key === autoStep);

  // ─────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        @keyframes ev_slideIn { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes ev_spin    { to{transform:rotate(360deg)} }
        .ev-upload:hover   { border-color:var(--color-primary)!important;background:#F3E5E2!important; }
        .ev-preset:hover   { background:var(--color-primary)!important;color:#fff!important;border-color:var(--color-primary)!important; }
        .ev-export:hover   { opacity:.85; }
        .ev-rmbtn          { position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--text-light);padding:2px;border-radius:4px; }
        .ev-rmbtn:hover    { color:var(--danger); }
        .ev-iconbtn:hover  { color:#fff!important; }
        select.ev-sel      { appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238C7573'/%3E%3C/svg%3E") no-repeat right 8px center;padding-right:26px; }
      `}</style>

      {/* ── Header ──────────────────────────────────── */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <Film size={20} />
          Editor de Vídeo
          <span style={S.badge}>100% local · sem banco de dados</span>
        </div>

        {/* Mode tabs */}
        <div style={S.modeTabs}>
          <button style={S.modeTab(!autoMode)} onClick={() => setAutoMode(false)}>
            ✂️ Manual
          </button>
          <button style={S.modeTab(autoMode)} onClick={() => setAutoMode(true)}>
            ✨ Auto
          </button>
        </div>

        {/* Export buttons */}
        {!autoMode && videoSrc && !exporting && (
          <button className="ev-export" style={S.exportBtn} onClick={exportManual}>
            <Download size={14} /> Exportar .webm
          </button>
        )}
        {autoMode && isDone && autoSegments.length > 0 && (
          <button className="ev-export" style={S.exportBtn} onClick={runAutoExport}
            disabled={autoStep === "exporting"}>
            <Download size={14} /> Exportar auto
          </button>
        )}
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div style={S.body}>

        {/* ── Left panel ───────────────────────────── */}
        <div style={S.panel}>

          {/* Upload (shared) */}
          <div style={S.section}>
            <div style={S.secTitle}><Upload size={12} /> Vídeo</div>
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onFileChange} />
            {!videoSrc ? (
              <div className="ev-upload" style={S.uploadZone}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}>
                <Film size={32} color="var(--color-primary)" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: "var(--text-medium)" }}>
                  Arraste aqui ou clique para escolher
                </div>
                <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>
                  MP4 / MOV / WebM — máx. 5 minutos
                </div>
              </div>
            ) : (
              <div style={S.fileChosen}>
                <CheckCircle2 size={14} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{fileName}</span>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B9B7A", padding: 0 }}
                  onClick={() => fileInputRef.current?.click()}>
                  <RefreshCw size={13} />
                </button>
              </div>
            )}
          </div>

          {/* ── MANUAL PANEL ───────────────────────── */}
          {!autoMode && (
            <>
              {/* Trim */}
              <div style={S.section}>
                <div style={S.secTitle}><Scissors size={12} /> Corte (Trim)</div>
                <label style={S.label}>Início: <strong>{fmt(trimStart)}</strong></label>
                <input type="range" style={S.slider} min={0} max={duration || 1} step={0.1}
                  value={trimStart} disabled={!videoSrc}
                  onChange={(e) => { const v = Math.min(+e.target.value, trimEnd - 0.5); setTrimStart(v); seek(v); }} />
                <label style={{ ...S.label, marginTop: 8 }}>Fim: <strong>{fmt(trimEnd)}</strong></label>
                <input type="range" style={S.slider} min={0} max={duration || 1} step={0.1}
                  value={trimEnd} disabled={!videoSrc}
                  onChange={(e) => setTrimEnd(Math.max(+e.target.value, trimStart + 0.5))} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-light)", marginTop: 4 }}>
                  <span>Duração selecionada:</span>
                  <strong style={{ color: "var(--color-primary)" }}>{fmt(trimEnd - trimStart)}</strong>
                </div>
              </div>

              {/* Filters */}
              <div style={S.section}>
                <div style={S.secTitle}><Sliders size={12} /> Filtros</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {PRESETS.map((p) => (
                    <button key={p.label} className="ev-preset"
                      style={{ background: "var(--color-accent-soft)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "3px 9px", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-sans)", color: "var(--text-medium)", transition: "all .15s" }}
                      onClick={() => setFilters(p.v)} disabled={!videoSrc}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div style={S.filterGrid}>
                  {[
                    { key: "brightness", label: "Brilho",    min: 50, max: 200, unit: "%" },
                    { key: "contrast",   label: "Contraste", min: 50, max: 200, unit: "%" },
                    { key: "saturation", label: "Saturação", min: 0,  max: 200, unit: "%" },
                    { key: "sepia",      label: "Sépia",     min: 0,  max: 100, unit: "%" },
                    { key: "blur",       label: "Blur",      min: 0,  max: 10,  unit: "px" },
                  ].map(({ key, label, min, max, unit }) => (
                    <div key={key}>
                      <label style={S.label}>{label}: <strong>{filters[key]}{unit}</strong></label>
                      <input type="range" style={S.slider} min={min} max={max} step={key === "blur" ? 0.5 : 1}
                        value={filters[key]} disabled={!videoSrc}
                        onChange={(e) => setFilters((f) => ({ ...f, [key]: +e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Captions */}
              <div style={S.section}>
                <div style={S.secTitle}><Type size={12} /> Legendas</div>
                <div style={{ maxHeight: 160, overflowY: "auto" }}>
                  {captions.map((cap) => (
                    <div key={cap.id} style={S.captionCard}>
                      <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 12 }}>{cap.text}</div>
                      <div style={{ fontSize: 10, color: "var(--text-light)" }}>{fmt(cap.startTime)} → {fmt(cap.endTime)}</div>
                      <button className="ev-rmbtn" onClick={() => removeCaption(cap.id)}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <input style={{ ...S.input, marginTop: 8 }} placeholder="Texto…" value={newCap.text}
                  onChange={(e) => setNewCap((c) => ({ ...c, text: e.target.value }))} />
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.label, marginTop: 6 }}>Início (s)</label>
                    <input type="number" style={S.input} min={0} max={duration} step={0.1}
                      value={newCap.startTime} onChange={(e) => setNewCap((c) => ({ ...c, startTime: +e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.label, marginTop: 6 }}>Fim (s)</label>
                    <input type="number" style={S.input} min={0} max={duration} step={0.1}
                      value={newCap.endTime} onChange={(e) => setNewCap((c) => ({ ...c, endTime: +e.target.value }))} />
                  </div>
                </div>
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.label, marginTop: 6 }}>Tam. (px)</label>
                    <input type="number" style={S.input} min={12} max={120} value={newCap.size}
                      onChange={(e) => setNewCap((c) => ({ ...c, size: +e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...S.label, marginTop: 6 }}>Cor</label>
                    <input type="color" style={{ ...S.input, padding: 3, height: 32 }}
                      value={newCap.color} onChange={(e) => setNewCap((c) => ({ ...c, color: e.target.value }))} />
                  </div>
                </div>
                <button disabled={!newCap.text.trim() || !videoSrc} onClick={addCaption}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 0", cursor: "pointer", fontSize: 12, fontWeight: 600, width: "100%", justifyContent: "center", marginTop: 8 }}>
                  <Plus size={13} /> Adicionar legenda
                </button>
              </div>
            </>
          )}

          {/* ── AUTO PANEL ─────────────────────────── */}
          {autoMode && (
            <>
              {/* Settings */}
              {!isRunning && (
                <div style={S.section}>
                  <div style={S.secTitle}><Settings2 size={12} /> Configurações Auto</div>

                  {/* Sensitivity */}
                  <label style={S.label}>Sensibilidade de corte</label>
                  <select className="ev-sel" style={{ ...S.input, marginBottom: 12 }}
                    value={autoSettings.sensitivity}
                    onChange={(e) => setAutoSettings((s) => ({ ...s, sensitivity: e.target.value }))}>
                    <option value="suave">Suave — corta pausas {">"} 0.5s</option>
                    <option value="normal">Normal — corta pausas {">"} 0.35s</option>
                    <option value="agressivo">Agressivo — corta pausas {">"} 0.2s</option>
                  </select>

                  {/* Toggles */}
                  {[
                    { key: "enableCaptions", label: "Legenda animada" },
                    { key: "enableZoom",     label: "Zoom dinâmico entre cortes" },
                    { key: "enableAudio",    label: "Melhora de áudio (filtros)" },
                  ].map(({ key, label }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13 }}>{label}</span>
                      <Toggle on={autoSettings[key]}
                        onChange={(v) => setAutoSettings((s) => ({ ...s, [key]: v }))} />
                    </div>
                  ))}

                  {/* Big button */}
                  <button style={{ ...S.bigBtn, marginTop: 8, opacity: !videoSrc ? 0.5 : 1 }}
                    disabled={!videoSrc || isRunning} onClick={runAutoEdit}>
                    <Sparkles size={16} />
                    Editar automaticamente
                  </button>

                  <p style={{ fontSize: 11, color: "var(--text-light)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
                    Transcreve, corta silêncios, remove repetições,<br />
                    melhora áudio e gera legendas animadas.
                  </p>
                </div>
              )}

              {/* Pipeline progress */}
              {isRunning && (
                <div style={S.section}>
                  <div style={S.secTitle}><Loader2 size={12} style={{ animation: "ev_spin 1s linear infinite" }} /> Processando…</div>

                  {PIPELINE_STEPS.slice(0, -1).map((s, i) => {
                    const status = i < stepIndex ? "done" : i === stepIndex ? "active" : "idle";
                    return (
                      <div key={s.key} style={S.stepRow}>
                        <div style={S.stepDot(status)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: status === "idle" ? "var(--text-light)" : "var(--text-dark)", fontWeight: status === "active" ? 600 : 400 }}>
                            {s.label}
                          </div>
                          {status === "active" && (
                            <>
                              <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>{autoStepLabel}</div>
                              <div style={S.progressBar}>
                                <div style={{ ...S.progressFill, width: `${autoStepPct}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                        {status === "done" && <CheckCircle2 size={14} color="var(--success)" />}
                      </div>
                    );
                  })}

                  <button onClick={cancelAuto}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid #f5c0c0", borderRadius: 7, padding: "7px 0", cursor: "pointer", fontSize: 12, fontWeight: 600, width: "100%", justifyContent: "center", marginTop: 12 }}>
                    Cancelar
                  </button>
                </div>
              )}

              {/* Result */}
              {isDone && (
                <div style={S.section}>
                  <div style={S.secTitle}><CheckCircle2 size={12} color="var(--success)" /> Resultado</div>

                  {autoSegments.length > 0 && (
                    <>
                      <div style={S.statBox}>
                        <div style={{ fontSize: 12, color: "var(--text-light)", marginBottom: 4 }}>
                          <Clock size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                          Antes vs. Depois
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
                          <span style={{ color: "var(--text-light)" }}>{fmt(origDuration)}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>→</span>
                          <span style={{ color: "var(--color-primary)" }}>{fmt(finalDuration)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--success)", marginTop: 3 }}>
                          {Math.round((1 - finalDuration / origDuration) * 100)}% mais curto ·{" "}
                          {autoSegments.length} trechos ·{" "}
                          Modelo: {modelDevice}
                        </div>
                      </div>

                      <button className="ev-export" style={{ ...S.bigBtn, marginBottom: 8 }} onClick={runAutoExport}>
                        <Download size={15} /> Exportar vídeo (.webm)
                      </button>
                    </>
                  )}

                  {autoSegments.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-light)", textAlign: "center", padding: "8px 0" }}>
                      Nenhum silêncio detectado. Tente sensibilidade "Agressivo".
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: "var(--text-light)", textAlign: "center", marginTop: 6 }}>
                    As legendas foram adicionadas à aba Manual para edição opcional.
                  </p>

                  <button onClick={() => { setAutoStep(null); setAutoError(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-accent-soft)", color: "var(--text-medium)", border: "1px solid var(--border-color)", borderRadius: 7, padding: "6px 0", cursor: "pointer", fontSize: 12, width: "100%", justifyContent: "center", marginTop: 8 }}>
                    <RefreshCw size={12} /> Refazer análise
                  </button>
                </div>
              )}

              {/* Error */}
              {isError && (
                <div style={S.section}>
                  <div style={{ ...S.statBox, background: "var(--danger-bg)", border: "1px solid #f5c0c0" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", marginBottom: 4 }}>Erro na análise</div>
                        <div style={{ fontSize: 12, color: "var(--text-medium)", wordBreak: "break-word" }}>{autoError}</div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setAutoStep(null); setAutoError(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 0", cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%", justifyContent: "center", marginTop: 8 }}>
                    <RefreshCw size={14} /> Tentar novamente
                  </button>
                </div>
              )}

              {/* Auto captions list (editable) */}
              {isDone && captions.length > 0 && (
                <div style={S.section}>
                  <div style={S.secTitle}><Type size={12} /> Legendas geradas ({captions.length})</div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {captions.map((cap) => (
                      <div key={cap.id} style={S.captionCard}>
                        <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 2 }}>{cap.text}</div>
                        <div style={{ fontSize: 10, color: "var(--text-light)" }}>{fmt(cap.startTime)} → {fmt(cap.endTime)}</div>
                        <button className="ev-rmbtn" onClick={() => removeCaption(cap.id)}><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Preview / Canvas ─────────────────────── */}
        <div style={S.preview}>
          <video ref={videoRef} src={videoSrc || ""} style={{ display: "none" }}
            muted={muted} preload="auto" crossOrigin="anonymous" />

          <div style={S.canvasWrap}>
            {!videoSrc ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", pointerEvents: "none" }}>
                <Film size={56} style={{ marginBottom: 12, opacity: .4 }} />
                <div style={{ fontSize: 15, opacity: .5 }}>Nenhum vídeo carregado</div>
              </div>
            ) : (
              <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", display: "block", borderRadius: 3, boxShadow: "0 4px 28px rgba(0,0,0,.45)" }} />
            )}

            {/* Export overlay (manual) */}
            {exporting && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <Loader2 size={36} color="#B3857A" style={{ animation: "ev_spin 1s linear infinite" }} />
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>Exportando…</div>
                <div style={{ width: 200, height: 5, background: "rgba(255,255,255,.2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${exportProgress}%`, height: "100%", background: "linear-gradient(90deg,#B3857A,#C8A26A)", transition: "width .3s" }} />
                </div>
              </div>
            )}

            {/* Auto export overlay */}
            {autoStep === "exporting" && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <Loader2 size={36} color="#C8A26A" style={{ animation: "ev_spin 1s linear infinite" }} />
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>Exportando vídeo auto-editado…</div>
                <div style={{ width: 240, height: 6, background: "rgba(255,255,255,.2)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${autoStepPct}%`, height: "100%", background: "linear-gradient(90deg,#B3857A,#C8A26A)", transition: "width .3s" }} />
                </div>
                <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>{Math.round(autoStepPct)}%</div>
                <button onClick={cancelAuto} style={{ color: "rgba(255,255,255,.7)", background: "none", border: "1px solid rgba(255,255,255,.3)", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Playback controls */}
          {videoSrc && (
            <div style={S.controls}>
              <input type="range" style={{ ...S.slider, accentColor: "#B3857A", height: 3 }}
                min={!autoMode ? trimStart : 0} max={!autoMode ? trimEnd : duration} step={0.05}
                value={Math.max(!autoMode ? trimStart : 0, Math.min(currentTime, !autoMode ? trimEnd : duration))}
                onChange={(e) => seek(e.target.value)} />
              <div style={S.playRow}>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={() => seek(!autoMode ? trimStart : 0)}>
                  <SkipBack size={16} />
                </button>
                <button style={{ ...S.iconBtn, background: "var(--color-primary)", borderRadius: "50%", padding: 7 }} onClick={togglePlay}>
                  {isPlaying ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}
                </button>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={() => seek(!autoMode ? trimEnd : duration)}>
                  <SkipForward size={16} />
                </button>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={() => {
                  if (videoRef.current) videoRef.current.muted = !muted;
                  setMuted((m) => !m);
                }}>
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <span style={S.timeDisp}>{fmt(currentTime)} / {fmt(!autoMode ? trimEnd : duration)}</span>

                {autoMode && isDone && (
                  <span style={{ fontSize: 11, color: "rgba(179,133,122,.9)", marginLeft: "auto" }}>
                    {autoSegments.length} trechos · {fmt(finalDuration)} finais
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, borderLeft: `4px solid ${toast.isError ? "var(--danger)" : "var(--success)"}` }}>
          {toast.isError
            ? <AlertCircle size={16} color="var(--danger)" />
            : <CheckCircle2 size={16} color="var(--success)" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
