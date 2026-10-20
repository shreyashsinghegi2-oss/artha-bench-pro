import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCcw } from 'lucide-react';

/**
 * Live photo from the device camera (front camera on phones). No file upload: the photo is taken now.
 * The image is cropped to a square and compressed before it is kept.
 */
export const CameraCapture: React.FC<{ current?: string | null; onUse: (dataUrl: string) => void }> = ({ current, onUse }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'preview' | 'error'>('idle');
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(''); setShot(null); setState('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('This browser cannot open the camera. Open ArthaMind in Chrome, Edge, Safari or Firefox on a device with a camera.');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = s;
      setState('live');
    } catch (e) {
      const name = (e as DOMException)?.name;
      setState('error');
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Camera access was blocked. Allow the camera for this site in your browser settings, then tap Try again.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No camera was found on this device. Use a phone or a computer with a camera to finish setup.'
          : 'The camera could not start. Close other apps that use the camera, then tap Try again.');
    }
  };

  // The preview element only exists once the camera is live, so the stream is attached here, after render.
  useEffect(() => {
    if (state !== 'live') return;
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    v.srcObject = s;
    void v.play().catch(() => undefined);
  }, [state]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError('The camera is still warming up. Wait a second, then tap Take photo.');
      return;
    }
    const side = Math.min(v.videoWidth, v.videoHeight);
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    if (!g) return;
    g.translate(size, 0); g.scale(-1, 1); // match the mirrored preview
    g.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, size, size);
    const url = c.toDataURL('image/jpeg', 0.86);
    stop();
    setShot(url);
    setState('preview');
  };

  return <div className="ro-camera">
    {state === 'idle' && <>
      {current && <img className="ro-photo-current" src={current} alt="Your current profile photo"/>}
      <p className="ro-note">{current ? 'Your photo is saved. You can take a new one now.' : 'Look at the camera, with your face in the middle. Good light helps.'}</p>
      <button type="button" className="ro-primary" onClick={() => void start()}><Camera size={16}/> {current ? 'Take a new photo' : 'Open camera'}</button>
    </>}
    {state === 'starting' && <p className="ro-note" role="status">Opening your camera…</p>}
    {state === 'live' && <>
      <div className="ro-video-wrap"><video ref={videoRef} className="ro-video" muted playsInline autoPlay aria-label="Camera preview"/></div>
      <button type="button" className="ro-primary" onClick={capture}><Camera size={16}/> Take photo</button>
    </>}
    {state === 'preview' && shot && <>
      <img className="ro-photo-current" src={shot} alt="Photo taken for your profile"/>
      <div className="ro-actions">
        <button type="button" className="ro-ghost" onClick={() => void start()}><RotateCcw size={15}/> Retake</button>
        <button type="button" className="ro-primary" onClick={() => onUse(shot)}><Check size={16}/> Use this photo</button>
      </div>
    </>}
    {state === 'error' && <>
      <div className="ro-problem is-error" role="alert"><div><p>{error}</p></div></div>
      <div className="ro-actions"><button type="button" className="ro-primary" onClick={() => void start()}><RotateCcw size={15}/> Try again</button></div>
    </>}
  </div>;
};
