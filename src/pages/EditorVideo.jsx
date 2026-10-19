import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Download, Play, Pause, SkipBack, SkipForward,
  Type, Sliders, Scissors, Trash2, Plus, Film, CheckCircle2,
  AlertCircle, Loader2, Volume2, VolumeX
} from "lucide-react";

const S = {
  page: { minHeight: "100vh", background: "var(--bg-main)", fontFamily: "var(--font-sans)", color: "var(--text-dark)", display: "flex", flexDirection: "column" },
  header: { padding: "20px 28px", borderBottom: "1px solid var(--border-color)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--shadow-sm)" },
  headerTitle: { display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--color-primary)" },
  headerBadge: { fontSize: 11, background: "var(--color-accent-soft)", color: "var(--text-light)", padding: "2px 8px", borderRadius: 20, fontWeight: 500 },
  body: { flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", overflow: "hidden", minHeight: 0 },
  panel: { background: "#fff", borderRight: "1px solid var(--border-color)", overflowY: "auto", display: "flex", flexDirection: "column" },
  section: { borderBottom: "1px solid var(--border-color)", padding: "16px 20px" },
  sectionTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-light)", marginBottom: 14 },
  uploadZone: { border: "2px dashed var(--border-color)", borderRadius: 12, padding: "28px 16px", textAlign: "center", cursor: "pointer", transition: "all .2s", background: "var(--color-accent-soft)" },
  fileChosen: { display: "flex", alignItems: "center", gap: 8, background: "var(--success-bg)", border: "1px solid #a6d1b3", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#3a7a50" },
  label: { fontSize: 12, fontWeight: 600, color: "var(--text-medium)", marginBottom: 6, display: "block" },
  slider: { width: "100%", accentColor: "var(--color-primary)", cursor: "pointer" },
  filterGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" },
  captionCard: { border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 13, position: "relative", background: "var(--bg-main)" },
  input: { width: "100%", border: "1px solid var(--border-color)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--text-dark)", background: "#fff", outline: "none", boxSizing: "border-box" },
  row: { display: "flex", gap: 8, marginTop: 8 },
  preview: { flex: 1, display: "flex", flexDirection: "column", background: "#1a1014", position: "relative", overflow: "hidden" },
  canvasWrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", minHeight: 0 },
  controls: { background: "#241418", borderTop: "1px solid rgba(255,255,255,.08)", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 },
  playRow: { display: "flex", alignItems: "center", gap: 12 },
  timeDisplay: { fontSize: 12, color: "rgba(255,255,255,.6)", fontVariantNumeric: "tabular-nums", minWidth: 90 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.85)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", transition: "color .15s" },
  exportBtn: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, background: "linear-gradient(135deg, #B3857A, #C8A26A)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity .18s", boxShadow: "0 2px 8px rgba(179,133,122,.4)" },
  toast: { position: "fixed", bottom: 28, right: 28, background: "#fff", border: "1px solid var(--border-color)", borderRadius: 12, padding: "12px 18px", boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 500, zIndex: 9999, animation: "slideIn .25s ease" },
};

const fmt = (s) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const DEFAULT_FILTERS = { brightness: 100, contrast: 100, saturation: 100, sepia: 0, blur: 0 };
const DEFAULT_CAPTION = { text: "", startTime: 0, endTime: 3, x: 50, y: 85, size: 32, color: "#FFFFFF" };

const PRESETS = [
  { label: "Original", v: { brightness: 100, contrast: 100, saturation: 100, sepia: 0, blur: 0 } },
  { label: "Vintage",  v: { brightness: 95,  contrast: 105, saturation: 70,  sepia: 40, blur: 0 } },
  { label: "Vivo",     v: { brightness: 110, contrast: 115, saturation: 150, sepia: 0,  blur: 0 } },
  { label: "Suave",    v: { brightness: 105, contrast: 90,  saturation: 80,  sepia: 10, blur: 0.5 } },
  { label: "P&B",      v: { brightness: 100, contrast: 120, saturation: 0,   sepia: 0,  blur: 0 } },
  { label: "Quente",   v: { brightness: 108, contrast: 105, saturation: 120, sepia: 25, blur: 0 } },
];

export default function EditorVideo() {
  const [videoSrc, setVideoSrc]       = useState(null);
  const [fileName, setFileName]       = useState("");
  const [duration, setDuration]       = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [muted, setMuted]             = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [trimStart, setTrimStart]     = useState(0);
  const [trimEnd, setTrimEnd]         = useState(0);
  const [filters, setFilters]         = useState({ ...DEFAULT_FILTERS });
  const [captions, setCaptions]       = useState([]);
  const [newCap, setNewCap]           = useState({ ...DEFAULT_CAPTION });
  const [exporting, setExporting]     = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [toast, setToast]             = useState(null);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);
  const fileInputRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("video/")) return;
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setFileName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setFilters({ ...DEFAULT_FILTERS });
    setCaptions([]);
  }, [videoSrc]);

  const onFileChange = (e) => loadFile(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]); };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => { setDuration(v.duration); setTrimStart(0); setTrimEnd(v.duration); };
    const onTime   = () => setCurrentTime(v.currentTime);
    const onEnded  = () => setIsPlaying(false);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => { v.removeEventListener("loadedmetadata", onLoaded); v.removeEventListener("timeupdate", onTime); v.removeEventListener("ended", onEnded); };
  }, [videoSrc]);

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
    ctx.filter = filterString;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.filter = "none";

    const ct = v.currentTime;
    captions.forEach((cap) => {
      if (ct < cap.startTime || ct > cap.endTime) return;
      const xPx = (cap.x / 100) * c.width;
      const yPx = (cap.y / 100) * c.height;
      ctx.font = `bold ${cap.size || 32}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = cap.color || "#FFFFFF";
      ctx.fillText(cap.text, xPx, yPx);
      ctx.shadowBlur  = 0;
    });

    if (!v.paused && v.currentTime >= trimEnd) {
      v.pause();
      v.currentTime = trimEnd;
      setIsPlaying(false);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [videoSrc, filterString, captions, trimEnd]);

  useEffect(() => {
    if (videoSrc) rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [videoSrc, drawFrame]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
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

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const exportVideo = async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !videoSrc) return;
    const trimDuration = trimEnd - trimStart;
    if (trimDuration <= 0) { showToast("Defina um intervalo de corte valido.", true); return; }
    setExporting(true);
    setExportProgress(0);
    chunksRef.current = [];

    const canvasStream = c.captureStream(30);
    try {
      const vidStream = v.captureStream ? v.captureStream() : null;
      if (vidStream) vidStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
    } catch (_) {}

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_000_000 });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = fileName.replace(/\.[^.]+$/, "") + "_editado.webm";
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
      setExportProgress(0);
      showToast("Download iniciado! Arquivo salvo em .webm");
    };

    v.currentTime = trimStart;
    await new Promise((res) => { v.onseeked = res; });
    v.muted = false;
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

  const cancelExport = () => {
    recorderRef.current?.stop();
    videoRef.current?.pause();
    setExporting(false);
    setExportProgress(0);
    showToast("Exportacao cancelada.", true);
  };

  const addCaption = () => {
    if (!newCap.text.trim()) return;
    setCaptions((prev) => [...prev, { ...newCap, id: Date.now() }]);
    setNewCap({ ...DEFAULT_CAPTION });
  };
  const removeCaption = (id) => setCaptions((prev) => prev.filter((c) => c.id !== id));

  return (
    <div style={S.page}>
      <style>{`
        @keyframes slideIn { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes spin    { to { transform:rotate(360deg) } }
        .ev-upload:hover  { border-color: var(--color-primary) !important; background: #F3E5E2 !important; }
        .ev-iconbtn:hover { color: #fff !important; }
        .ev-preset { background: var(--color-accent-soft); border: 1px solid var(--border-color); border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer; transition:all .15s; font-family:var(--font-sans); color:var(--text-medium); }
        .ev-preset:hover  { background: var(--color-primary); color:#fff; border-color:var(--color-primary); }
        .ev-export:hover  { opacity:.85; }
        .ev-rmbtn { position:absolute; top:8px; right:8px; background:none; border:none; cursor:pointer; color:var(--text-light); padding:2px; border-radius:4px; }
        .ev-rmbtn:hover   { color:var(--danger); }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <Film size={22}/>
          Editor de Video
          <span style={S.headerBadge}>100% local · sem upload para banco</span>
        </div>
        {videoSrc && !exporting && (
          <button className="ev-export" style={S.exportBtn} onClick={exportVideo}>
            <Download size={15}/> Exportar video
          </button>
        )}
        {exporting && (
          <button style={{...S.exportBtn, background:"#555"}} onClick={cancelExport}>
            Cancelar exportacao
          </button>
        )}
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Panel */}
        <div style={S.panel}>

          {/* Upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}><Upload size={13}/> Video</div>
            <input ref={fileInputRef} type="file" accept="video/*" style={{display:"none"}} onChange={onFileChange}/>
            {!videoSrc ? (
              <div className="ev-upload" style={{...S.uploadZone,...(dragOver?{borderColor:"var(--color-primary)",background:"#F3E5E2"}:{})}}
                onClick={()=>fileInputRef.current?.click()}
                onDragOver={(e)=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={onDrop}>
                <Film size={36} color="var(--color-primary)" style={{marginBottom:8}}/>
                <div style={{fontSize:14,color:"var(--text-medium)",lineHeight:1.5}}>Arraste um video aqui<br/>ou clique para escolher</div>
                <div style={{fontSize:11,color:"var(--text-light)",marginTop:4}}>MP4, MOV, WebM, AVI...</div>
              </div>
            ) : (
              <div style={S.fileChosen}>
                <CheckCircle2 size={16}/>
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</span>
                <button style={{background:"none",border:"none",cursor:"pointer",color:"#6B9B7A",padding:0}} onClick={()=>fileInputRef.current?.click()}>
                  <Upload size={14}/>
                </button>
              </div>
            )}
          </div>

          {/* Trim */}
          <div style={S.section}>
            <div style={S.sectionTitle}><Scissors size={13}/> Corte (Trim)</div>
            <label style={S.label}>Inicio: <strong>{fmt(trimStart)}</strong></label>
            <input type="range" style={S.slider} min={0} max={duration||1} step={0.1} value={trimStart} disabled={!videoSrc}
              onChange={(e)=>{const v=Math.min(Number(e.target.value),trimEnd-0.5);setTrimStart(v);seek(v);}}/>
            <label style={{...S.label,marginTop:10}}>Fim: <strong>{fmt(trimEnd)}</strong></label>
            <input type="range" style={S.slider} min={0} max={duration||1} step={0.1} value={trimEnd} disabled={!videoSrc}
              onChange={(e)=>{const v=Math.max(Number(e.target.value),trimStart+0.5);setTrimEnd(v);}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text-light)",marginTop:4}}>
              <span>Duracao selecionada:</span>
              <strong style={{color:"var(--color-primary)"}}>{fmt(trimEnd-trimStart)}</strong>
            </div>
          </div>

          {/* Filters */}
          <div style={S.section}>
            <div style={S.sectionTitle}><Sliders size={13}/> Filtros</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
              {PRESETS.map((p)=>(
                <button key={p.label} className="ev-preset" onClick={()=>setFilters(p.v)} disabled={!videoSrc}>{p.label}</button>
              ))}
            </div>
            <div style={S.filterGrid}>
              {[
                {key:"brightness",label:"Brilho",   min:50, max:200,unit:"%"},
                {key:"contrast",  label:"Contraste", min:50, max:200,unit:"%"},
                {key:"saturation",label:"Saturacao", min:0,  max:200,unit:"%"},
                {key:"sepia",     label:"Sepia",     min:0,  max:100,unit:"%"},
                {key:"blur",      label:"Blur",      min:0,  max:10, unit:"px"},
              ].map(({key,label,min,max,unit})=>(
                <div key={key}>
                  <label style={S.label}>{label}: <strong>{filters[key]}{unit}</strong></label>
                  <input type="range" style={S.slider} min={min} max={max} step={key==="blur"?0.5:1}
                    value={filters[key]} disabled={!videoSrc}
                    onChange={(e)=>setFilters((f)=>({...f,[key]:Number(e.target.value)}))}/>
                </div>
              ))}
            </div>
          </div>

          {/* Captions */}
          <div style={S.section}>
            <div style={S.sectionTitle}><Type size={13}/> Legendas / Texto</div>
            {captions.map((cap)=>(
              <div key={cap.id} style={S.captionCard}>
                <div style={{fontWeight:600,marginBottom:4,wordBreak:"break-word"}}>{cap.text}</div>
                <div style={{fontSize:11,color:"var(--text-light)"}}>{fmt(cap.startTime)} → {fmt(cap.endTime)} · {cap.size}px</div>
                <button className="ev-rmbtn" onClick={()=>removeCaption(cap.id)}><Trash2 size={13}/></button>
              </div>
            ))}
            <input style={S.input} placeholder="Texto da legenda..." value={newCap.text}
              onChange={(e)=>setNewCap((c)=>({...c,text:e.target.value}))}/>
            <div style={S.row}>
              <div style={{flex:1}}>
                <label style={{...S.label,marginTop:6}}>Inicio (s)</label>
                <input type="number" style={S.input} min={0} max={duration} step={0.1} value={newCap.startTime}
                  onChange={(e)=>setNewCap((c)=>({...c,startTime:Number(e.target.value)}))}/>
              </div>
              <div style={{flex:1}}>
                <label style={{...S.label,marginTop:6}}>Fim (s)</label>
                <input type="number" style={S.input} min={0} max={duration} step={0.1} value={newCap.endTime}
                  onChange={(e)=>setNewCap((c)=>({...c,endTime:Number(e.target.value)}))}/>
              </div>
            </div>
            <div style={S.row}>
              <div style={{flex:1}}>
                <label style={{...S.label,marginTop:6}}>Tamanho (px)</label>
                <input type="number" style={S.input} min={12} max={120} step={2} value={newCap.size}
                  onChange={(e)=>setNewCap((c)=>({...c,size:Number(e.target.value)}))}/>
              </div>
              <div style={{flex:1}}>
                <label style={{...S.label,marginTop:6}}>Cor</label>
                <input type="color" style={{...S.input,padding:3,height:34}} value={newCap.color}
                  onChange={(e)=>setNewCap((c)=>({...c,color:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <label style={S.label}>Posicao vertical (%)</label>
              <input type="range" style={S.slider} min={10} max={95} step={1} value={newCap.y}
                onChange={(e)=>setNewCap((c)=>({...c,y:Number(e.target.value)}))}/>
            </div>
            <button
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 0",fontSize:13,fontWeight:600,borderRadius:8,border:"none",cursor:"pointer",background:"var(--color-primary)",color:"#fff",marginTop:10,width:"100%",justifyContent:"center"}}
              onClick={addCaption} disabled={!newCap.text.trim()||!videoSrc}>
              <Plus size={14}/> Adicionar legenda
            </button>
          </div>
        </div>

        {/* Preview */}
        <div style={S.preview}>
          <video ref={videoRef} src={videoSrc||""} style={{display:"none"}} muted={muted} preload="auto" crossOrigin="anonymous"/>

          <div style={S.canvasWrap}>
            {!videoSrc ? (
              <div style={{textAlign:"center",color:"rgba(255,255,255,.3)",pointerEvents:"none"}}>
                <Film size={64} style={{marginBottom:16,opacity:.4}}/>
                <div style={{fontSize:16,opacity:.5}}>Nenhum video carregado</div>
                <div style={{fontSize:13,opacity:.35,marginTop:6}}>Escolha um arquivo no painel esquerdo</div>
              </div>
            ) : (
              <canvas ref={canvasRef} style={{maxWidth:"100%",maxHeight:"100%",display:"block",borderRadius:4,boxShadow:"0 4px 32px rgba(0,0,0,.4)"}}/>
            )}

            {exporting && (
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.65)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,borderRadius:4}}>
                <Loader2 size={40} color="#B3857A" style={{animation:"spin 1s linear infinite"}}/>
                <div style={{color:"#fff",fontSize:16,fontWeight:600}}>Exportando video...</div>
                <div style={{width:220,height:6,background:"rgba(255,255,255,.2)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${exportProgress}%`,height:"100%",background:"linear-gradient(90deg,#B3857A,#C8A26A)",transition:"width .3s"}}/>
                </div>
                <div style={{color:"rgba(255,255,255,.6)",fontSize:13}}>{Math.round(exportProgress)}%</div>
              </div>
            )}
          </div>

          {videoSrc && (
            <div style={S.controls}>
              <input type="range" style={{width:"100%",accentColor:"#B3857A",cursor:"pointer",height:4}} min={trimStart} max={trimEnd} step={0.05}
                value={Math.max(trimStart,Math.min(currentTime,trimEnd))}
                onChange={(e)=>seek(e.target.value)}/>
              <div style={S.playRow}>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={()=>seek(trimStart)} title="Inicio do corte"><SkipBack size={18}/></button>
                <button style={{...S.iconBtn,background:"var(--color-primary)",borderRadius:"50%",padding:8}} onClick={togglePlay}>
                  {isPlaying?<Pause size={18} color="#fff"/>:<Play size={18} color="#fff"/>}
                </button>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={()=>seek(trimEnd)} title="Fim do corte"><SkipForward size={18}/></button>
                <button style={S.iconBtn} className="ev-iconbtn" onClick={()=>{if(videoRef.current)videoRef.current.muted=!muted;setMuted(m=>!m);}}>
                  {muted?<VolumeX size={16}/>:<Volume2 size={16}/>}
                </button>
                <span style={S.timeDisplay}>{fmt(currentTime)} / {fmt(trimEnd)}</span>
                <button className="ev-export" style={S.exportBtn} onClick={exportVideo} disabled={exporting}>
                  <Download size={14}/> Baixar .webm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{...S.toast,borderLeft:`4px solid ${toast.isError?"var(--danger)":"var(--success)"}`}}>
          {toast.isError?<AlertCircle size={18} color="var(--danger)"/>:<CheckCircle2 size={18} color="var(--success)"/>}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
