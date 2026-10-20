import React, { useEffect, useState } from 'react';
import { PHOTO_EVENT, loadProfilePhoto } from '../../services/profilePhoto';

/** The live photo taken at sign-up, as a round profile picture (initials until it exists). */
export const ProfileAvatar: React.FC<{ name?: string; size?: number }> = ({ name, size = 44 }) => {
  const [src, setSrc] = useState<string | null>(() => loadProfilePhoto()?.dataUrl ?? null);
  useEffect(() => {
    const on = () => setSrc(loadProfilePhoto()?.dataUrl ?? null);
    window.addEventListener(PHOTO_EVENT, on);
    return () => window.removeEventListener(PHOTO_EVENT, on);
  }, []);
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return src
    ? <img src={src} alt={name ? `Profile photo of ${name}` : 'Profile photo'} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size, border: '2px solid var(--brand-primary)', flex: 'none' }}/>
    : <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full font-black" style={{ width: size, height: size, background: 'var(--brand-soft)', color: 'var(--brand-hover)', flex: 'none', fontSize: size * 0.36 }}>{initials}</span>;
};
