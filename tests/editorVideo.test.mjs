import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildAutomaticBrollCues,
  buildKeepSegments,
  detectAdaptiveSilences,
  fitCover,
} from '../src/lib/videoAutoEdit.js';

function audioFrames(duration, levelAt, step = 0.02) {
  const frames = [];
  for (let time = 0; time < duration; time += step) {
    frames.push({ t: Number(time.toFixed(4)), rms: levelAt(time) });
  }
  return frames;
}

test('detector adaptativo encontra pausa mesmo com um pico alto isolado', () => {
  const frames = audioFrames(4, time => {
    if (time >= 1 && time < 2) return 0.002;
    if (time >= 2.5 && time < 2.52) return 1;
    return time < 1 ? 0.05 : 0.04;
  });

  const silences = detectAdaptiveSilences(frames, 4, {
    minPauseS: 0.35,
    paddingS: 0.12,
    thresholdRatio: 0.24,
    bridgeSpeechS: 0.08,
  });

  assert.equal(silences.length, 1);
  assert.ok(silences[0].start > 1 && silences[0].start < 1.2);
  assert.ok(silences[0].end > 1.8 && silences[0].end < 2);
});

test('detector inclui silêncio no final e preserva margem junto da fala', () => {
  const frames = audioFrames(3, time => time < 2 ? 0.06 : 0.001);
  const silences = detectAdaptiveSilences(frames, 3, {
    minPauseS: 0.35,
    paddingS: 0.12,
    thresholdRatio: 0.24,
  });

  assert.equal(silences.length, 1);
  assert.ok(silences[0].start >= 2.08);
  assert.equal(silences[0].end, 3);
});

test('converte pausas removidas em segmentos contínuos de fala', () => {
  assert.deepEqual(buildKeepSegments([
    { start: 1.1, end: 1.9 },
    { start: 3.2, end: 4 },
  ], 5), [
    { start: 0, end: 1.1 },
    { start: 1.9, end: 3.2 },
    { start: 4, end: 5 },
  ]);
});

test('distribui B-roll no tempo editado e converte para o vídeo original', () => {
  const cues = buildAutomaticBrollCues(
    [{ start: 0, end: 3 }, { start: 5, end: 11 }],
    [{ id: 'foto-1' }, { id: 'video-2' }],
    { cueDuration: 2, gap: 4 },
  );

  assert.deepEqual(cues.map(cue => cue.assetId), ['foto-1', 'video-2']);
  assert.equal(cues[0].start, 2);
  assert.equal(cues[1].start, 8);
  assert.ok(cues.every(cue => cue.end > cue.start));
});

test('fitCover preenche o quadro sem deformar a mídia', () => {
  const rect = fitCover(1920, 1080, 1080, 1920);
  assert.equal(rect.height, 1920);
  assert.ok(rect.width > 1080);
  assert.ok(rect.x < 0);
});

test('interface remove zoom e oferece B-roll local com legendas sincronizadas', () => {
  const source = fs.readFileSync(path.resolve('src/pages/EditorVideo.jsx'), 'utf8');

  assert.doesNotMatch(source, /enableZoom|zoomRef|Zoom dinâmico/);
  assert.match(source, /B-roll automático/);
  assert.match(source, /accept="image\/\*,video\/\*"/);
  assert.match(source, /const captionWords = captions\.flatMap/);
  assert.match(source, /detectAdaptiveSilences/);
});

