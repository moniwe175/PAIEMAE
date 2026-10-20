function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.min(ordered.length - 1, Math.max(0, Math.floor((ordered.length - 1) * ratio)));
  return ordered[index];
}

function smoothRms(frames) {
  return frames.map((frame, index) => {
    const from = Math.max(0, index - 1);
    const to = Math.min(frames.length, index + 2);
    const values = frames.slice(from, to).map(item => item.rms);
    return { ...frame, rms: values.reduce((sum, value) => sum + value, 0) / values.length };
  });
}

function mergeCloseSilences(silences, maxSpeechGapS) {
  const merged = [];
  silences.forEach(silence => {
    const previous = merged[merged.length - 1];
    if (previous && silence.start - previous.end <= maxSpeechGapS) {
      previous.end = silence.end;
    } else {
      merged.push({ ...silence });
    }
  });
  return merged;
}

/**
 * Detecta pausas usando piso de ruído + nível típico da voz, em vez do maior
 * pico do arquivo. Histerese evita que respirações e ruídos curtos quebrem uma
 * pausa em vários pedaços.
 */
export function detectAdaptiveSilences(rmsFrames = [], duration = 0, config = {}) {
  if (!rmsFrames.length || duration <= 0) return [];

  const {
    minPauseS = 0.38,
    paddingS = 0.1,
    thresholdRatio = 0.24,
    bridgeSpeechS = 0.08,
  } = config;
  const smoothed = smoothRms(rmsFrames);
  const levels = smoothed.map(frame => frame.rms).filter(Number.isFinite);
  const noiseFloor = percentile(levels, 0.2);
  const voiceLevel = percentile(levels, 0.88);

  // Arquivos sem contraste suficiente entre ruído e voz não são cortados.
  if (voiceLevel <= Math.max(0.0001, noiseFloor * 1.18)) return [];

  const threshold = noiseFloor + (voiceLevel - noiseFloor) * thresholdRatio;
  const enterThreshold = threshold * 0.9;
  const leaveThreshold = threshold * 1.12;
  const frameStep = rmsFrames.length > 1
    ? Math.max(0.005, rmsFrames[1].t - rmsFrames[0].t)
    : 0.02;
  const raw = [];
  let silenceStart = null;

  smoothed.forEach(({ t, rms }) => {
    if (silenceStart == null && rms <= enterThreshold) {
      silenceStart = t;
      return;
    }

    if (silenceStart != null && rms >= leaveThreshold) {
      raw.push({ start: silenceStart, end: t });
      silenceStart = null;
    }
  });

  if (silenceStart != null) raw.push({ start: silenceStart, end: duration });

  return mergeCloseSilences(raw, bridgeSpeechS)
    .filter(silence => silence.end - silence.start >= minPauseS)
    .map(silence => {
      const edgePaddingStart = silence.start <= frameStep * 2 ? 0 : paddingS;
      const edgePaddingEnd = duration - silence.end <= frameStep * 2 ? 0 : paddingS;
      return {
        start: Math.min(silence.end, silence.start + edgePaddingStart),
        end: Math.max(silence.start, silence.end - edgePaddingEnd),
      };
    })
    .filter(silence => silence.end - silence.start >= 0.08);
}

/** Converte os intervalos removidos nos trechos que devem permanecer. */
export function buildKeepSegments(silences = [], duration = 0, minKeepS = 0.14) {
  if (duration <= 0) return [];
  const ordered = [...silences]
    .map(silence => ({
      start: Math.max(0, Math.min(duration, Number(silence.start) || 0)),
      end: Math.max(0, Math.min(duration, Number(silence.end) || 0)),
    }))
    .filter(silence => silence.end > silence.start)
    .sort((a, b) => a.start - b.start);

  if (!ordered.length) return [{ start: 0, end: duration }];

  const segments = [];
  let cursor = 0;
  ordered.forEach(silence => {
    if (silence.start - cursor >= minKeepS) segments.push({ start: cursor, end: silence.start });
    cursor = Math.max(cursor, silence.end);
  });
  if (duration - cursor >= minKeepS) segments.push({ start: cursor, end: duration });
  return segments.length ? segments : [{ start: 0, end: duration }];
}

function sourceTimeAtEditedOffset(segments, editedOffset) {
  let elapsed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const length = segment.end - segment.start;
    if (editedOffset < elapsed + length || index === segments.length - 1) {
      return { segment, sourceTime: segment.start + Math.max(0, editedOffset - elapsed) };
    }
    elapsed += length;
  }
  return null;
}

function normalizedWords(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const BROLL_STOP_WORDS = new Set([
  "a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos",
  "para", "por", "com", "sem", "um", "uma", "uns", "umas", "foto", "video", "img", "imagem", "arquivo",
]);

function assetKeywords(asset) {
  return normalizedWords(asset?.name).filter(word => word.length > 2 && !BROLL_STOP_WORDS.has(word));
}

function segmentAtTime(segments, time) {
  return segments.find(segment => time >= segment.start && time <= segment.end);
}

function cueOverlaps(cues, start, end, gap = 0.35) {
  return cues.some(cue => start < cue.end + gap && end > cue.start - gap);
}

/**
 * Agrupa palavras em blocos curtos de legenda. O limite considera tempo,
 * pontuação e tamanho para manter no máximo duas linhas em um Reel.
 */
export function buildCaptionPhrases(words = [], options = {}) {
  const {
    maxWords = 6,
    maxChars = 34,
    maxDuration = 2.6,
    gapS = 0.48,
  } = options;
  const valid = words
    .map(word => ({
      ...word,
      text: String(word?.text || "").trim(),
      start: Number(word?.start),
      end: Number(word?.end),
    }))
    .filter(word => word.text && Number.isFinite(word.start) && Number.isFinite(word.end));

  const phrases = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    phrases.push({
      id: `caption-${phrases.length}-${current[0].start.toFixed(3)}`,
      text: current.map(word => word.text).join(" "),
      startTime: current[0].start,
      endTime: current[current.length - 1].end,
      words: current,
    });
    current = [];
  };

  valid.forEach(word => {
    const previous = current[current.length - 1];
    const candidate = [...current, word];
    const candidateText = candidate.map(item => item.text).join(" ");
    const shouldBreak = current.length > 0 && (
      current.length >= maxWords ||
      candidateText.length > maxChars ||
      word.end - current[0].start > maxDuration ||
      word.start - previous.end > gapS ||
      /[.!?]$/.test(previous.text)
    );
    if (shouldBreak) flush();
    current.push(word);
  });
  flush();
  return phrases;
}

/**
 * Distribui cada mídia de apoio uma vez, em intervalos regulares da versão já
 * cortada, e converte as posições para o tempo do vídeo original.
 */
export function buildAutomaticBrollCues(segments = [], assets = [], options = {}) {
  if (!segments.length || !assets.length) return [];
  const cueDuration = options.cueDuration || 2.8;
  const gap = options.gap || 6;
  const words = options.words || [];
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.end - segment.start), 0);
  if (total < 1) return [];

  const cues = [];
  assets.forEach((asset, index) => {
    const keywords = assetKeywords(asset);
    const matchedWord = words.find(word => {
      const spoken = normalizedWords(word.text)[0];
      if (!spoken || !segmentAtTime(segments, word.start)) return false;
      return keywords.some(keyword => keyword === spoken || (keyword.length > 4 && spoken.startsWith(keyword)));
    });
    const fallbackOffset = Math.min(
      Math.max(1.2, 3.2 + index * gap),
      Math.max(1.2, total - 1),
    );
    const location = matchedWord
      ? { segment: segmentAtTime(segments, matchedWord.start), sourceTime: Math.max(0, matchedWord.start - 0.3) }
      : sourceTimeAtEditedOffset(segments, fallbackOffset);
    if (!location?.segment) return;

    let start = Math.max(location.segment.start + 0.08, location.sourceTime);
    let duration = Math.min(cueDuration, location.segment.end - start);
    if (cueOverlaps(cues, start, start + duration)) {
      start = Math.max(location.segment.start + 0.08, location.segment.end - cueDuration);
      duration = Math.min(cueDuration, location.segment.end - start);
    }
    if (duration < 0.65) return;
    cues.push({
      id: `broll-cue-${asset.id}-${index}`,
      assetId: asset.id,
      start,
      end: start + duration,
      placement: "card",
      matchedBy: matchedWord ? "filename" : "automatic",
    });
  });
  return cues;
}

export function fitContain(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}
