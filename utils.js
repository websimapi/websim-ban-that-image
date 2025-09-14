export const GALLERY = 'gallery_image';
export const BANSTATE = 'ban_state';
export const CREATOR_META = 'creator_metadata';
export const TTS_VOICE = 'en-male';

export function calcBounty(created_at) {
  const hours = Math.floor((Date.now() - new Date(created_at).getTime()) / 3600000);
  return Math.max(0, Math.min(3, hours));
}

export const tutorialImage = {
  id: 'tutorial',
  url: 'tutorial_image.png',
  title: 'Tutorial Image',
  created_at: new Date(Date.now() - 3600000).toISOString(),
  owner_id: 'system'
};

