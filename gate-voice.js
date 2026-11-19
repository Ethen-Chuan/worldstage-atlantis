import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
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
  const text = gateText(value);
  if (process.platform !== 'darwin') throw new Error('本机语音不可用。');
  const directory = await mkdtemp(path.join(tmpdir(), 'worldstage-echo-'));
  try {
    const output = path.join(directory, 'echo.wav');
    const input = path.join(directory, 'invocation.txt');
    await writeFile(input, text, { mode: 0o600 });
    await execute('/usr/bin/say', ['-v', 'Grandpa (中文（中国大陆）)', '-r', '118', '-o', output, '--file-format=WAVE', '--data-format=LEI16@22050', '-f', input], { timeout: 18000, maxBuffer: 2048 });
    const audio = await readFile(output);
    if (audio.length > 6000000 || !hasAudiblePCM(audio)) throw new Error('本机语音未完成。');
    return audio;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
