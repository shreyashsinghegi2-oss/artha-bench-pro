import React, { useEffect, useRef, useState } from 'react';
import './heroSlideshow.css';

// Coin stacks rising slowly with a growth chart, graded to the brand green. One ~22 s loop (about one cycle of the
// hero phone), with a 2.5 s crossfade at the loop point so it never stops or jumps.
// Landscape screens get the 1080p cut; tall phone screens get a portrait crop, so neither is stretched or
// shows a tiny letterboxed strip. Each cut ships as H.264 MP4 (every browser) and VP9 WebM (browsers built
// without H.264).
const SOURCES = {
  wide: { video: '/hero/grow-1080', poster: '/hero/grow-poster.webp' },
  tall: { video: '/hero/grow-portrait', poster: '/hero/grow-poster-m.webp' },
};
const TALL = '(max-aspect-ratio: 4/5)';

type NetworkInfo = { saveData?: boolean };

/**
 * Hero background video. The poster frame paints immediately; the video starts after the page has
 * loaded so it never delays the headline. Muted, inline and looping so it autoplays on phones.
 * Pauses off-screen and in background tabs. Reduced-motion and data-saver visitors keep the still frame.
 */
export const HeroVideo: React.FC = () => {
  const [tall, setTall] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(TALL).matches);
  const [start, setStart] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const still =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      Boolean((navigator as Navigator & { connection?: NetworkInfo }).connection?.saveData));
  const src = tall ? SOURCES.tall : SOURCES.wide;

  useEffect(() => {
    const mq = window.matchMedia?.(TALL);
    if (!mq) return;
    const on = () => setTall(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    if (still) return;
    const go = () => setStart(true);
    if (document.readyState === 'complete') go();
    else {
      window.addEventListener('load', go, { once: true });
      return () => window.removeEventListener('load', go);
    }
  }, [still]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !start) return;
    // iOS only autoplays when muted is set as a property before play().
    v.muted = true;
    v.defaultMuted = true;
    let inView = true;
    const sync = () => {
      if (inView && document.visibilityState === 'visible') v.play().catch(() => undefined);
      else v.pause();
    };
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            inView = e.isIntersecting;
            sync();
          })
        : null;
    io?.observe(v);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [start, src.video]);

  return (
    <div className="hs" aria-hidden="true">
      <img className="hv-poster" src={src.poster} alt="" decoding="async" fetchPriority="high" />
      {start && (
        <video
          key={src.video}
          ref={ref}
          className={`hv-video ${playing ? 'on' : ''}`}
          poster={src.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
        >
          <source src={`${src.video}.mp4`} type="video/mp4" />
          <source src={`${src.video}.webm`} type="video/webm" />
        </video>
      )}
      <div className="hs-shade" />
    </div>
  );
};
