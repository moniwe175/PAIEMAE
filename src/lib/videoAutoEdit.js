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
  for (const segment of segments) {
    const length = segment.end - segment.start;
    if (editedOffset <= elapsed + length) {
      return { segment, sourceTime: segment.start + Math.max(0, editedOffset - elapsed) };
    }
    elapsed += length;
  }
  return null;
}

/**
 * Distribui cada mídia de apoio uma vez, em intervalos regulares da versão já
 * cortada, e converte as posições para o tempo do vídeo original.
 */
export function buildAutomaticBrollCues(segments = [], assets = [], options = {}) {
  if (!segments.length || !assets.length) return [];
  const cueDuration = options.cueDuration || 2.5;
  const gap = options.gap || 5;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.end - segment.start), 0);
  if (total < 1) return [];

  const cues = [];
  assets.forEach((asset, index) => {
    const desiredOffset = Math.min(Math.max(0.5, 2 + index * gap), Math.max(0.5, total - 0.5));
    const location = sourceTimeAtEditedOffset(segments, desiredOffset);
    if (!location) return;

    const available = location.segment.end - location.sourceTime;
    const duration = Math.min(cueDuration, available);
    if (duration < 0.65) return;
    cues.push({
      id: `broll-cue-${asset.id}-${index}`,
      assetId: asset.id,
      start: location.sourceTime,
      end: location.sourceTime + duration,
    });
  });
  return cues;
}

export function fitCover(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

