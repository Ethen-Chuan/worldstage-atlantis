import { readFile } from 'node:fs/promises';
import { gateInvocation } from './src/gate-language.js';

export function hasAudiblePCM(audio) {
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') return false;
  let format; let data;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const kind = audio.toString('ascii', offset, offset + 4); const size = audio.readUInt32LE(offset + 4); const end = offset + 8 + size;
    if (end > audio.length) return false;
    if (kind === 'fmt ' && size >= 16) format = { pcm: audio.readUInt16LE(offset + 8), rate: audio.readUInt32LE(offset + 12), bits: audio.readUInt16LE(offset + 22) };
    if (kind === 'data') data = audio.subarray(offset + 8, end);
    offset = end + size % 2;
  }
  if (!format || format.pcm !== 1 || format.bits !== 16 || !data || data.length < format.rate * 0.4) return false;
  for (let offset = 0; offset + 1 < data.length; offset += 2) if (Math.abs(data.readInt16LE(offset)) > 64) return true;
  return false;
}
export function gateText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f]/.test(value)) throw new Error('回声限 160 字，请使用普通文字。');
  return value.trim();
}

export async function synthesizeGate(value) {
  const invocation = gateInvocation(gateText(value));
  const audio = await readFile(new URL(`./public/${invocation.file}`, import.meta.url));
  if (audio.length < 1000 || audio.length > 2000000) throw new Error('古希腊语音色未就绪。');
  return audio;
}
