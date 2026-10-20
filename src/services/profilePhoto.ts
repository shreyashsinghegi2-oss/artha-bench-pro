/**
 * The user's live photo, taken with their device camera at the end of sign-up (no uploads). It is the profile
 * picture and appears on the report as proof of who the report is for. Stored only on this device.
 */
export const PHOTO_KEY = 'arthamind.profilePhoto.v1';
export const PHOTO_EVENT = 'arthamind:profile-photo';

export interface ProfilePhoto { dataUrl: string; takenAt: string }

export function loadProfilePhoto(): ProfilePhoto | null {
  try {
    const p = JSON.parse(localStorage.getItem(PHOTO_KEY) || 'null') as ProfilePhoto | null;
    return p && typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/') ? p : null;
  } catch {
    return null;
  }
}

export function saveProfilePhoto(dataUrl: string): void {
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify({ dataUrl, takenAt: new Date().toISOString() } satisfies ProfilePhoto)); } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent(PHOTO_EVENT));
}

/** Round-cropped PNG of a photo, for the report and avatars. */
export function circleCrop(dataUrl: string, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      if (!g) return reject(new Error('canvas unavailable'));
      g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.closePath(); g.clip();
      const side = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('photo could not be read'));
    img.src = dataUrl;
  });
}
