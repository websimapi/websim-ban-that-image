import { WebsimSocket } from '@websim/use-query';
import { CREATOR_META } from './utils.js';

const room = new WebsimSocket();

export async function ensureCreatorMetadata(creator) {
  if (!creator) return null;
  
  const existing = await room.collection(CREATOR_META).filter({ id: creator.id }).getList();
  if (existing.length === 0) {
    await room.collection(CREATOR_META).upsert({
      id: creator.id,
      tts_cache: {}
    });
    return { id: creator.id, tts_cache: {} };
  }
  return existing[0];
}

export async function getCachedTTS(text, voice, creator) {
  if (!creator) return null;
  
  const metadata = await ensureCreatorMetadata(creator);
  if (!metadata) return null;
  
  const textId = `${text}_${voice}`;
  const ttsCache = metadata.tts_cache || {};
  return ttsCache[textId] || null;
}

export async function cacheTTS(text, voice, audioUrl, creator) {
  if (!creator) return;
  
  const textId = `${text}_${voice}`;
  const metadata = await ensureCreatorMetadata(creator);
  const currentCache = metadata?.tts_cache || {};
  const updatedCache = { ...currentCache, [textId]: audioUrl };
  
  await room.collection(CREATOR_META).upsert({
    id: creator.id,
    tts_cache: updatedCache
  });
}

export async function generateOrGetTTS(text, voice, creator) {
  const cached = await getCachedTTS(text, voice, creator);
  if (cached) {
    console.log('Using cached TTS for:', text.substring(0, 50) + '...');
    return { url: cached };
  }
  
  console.log('Generating new TTS for:', text.substring(0, 50) + '...');
  const res = await window.websim.textToSpeech({ text, voice });
  await cacheTTS(text, voice, res.url, creator);
  return res;
}