"use client";

import { useRef, useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function WalkthroughPlayer() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  return (
    <>
      <video
        ref={video}
        id="walkthrough-video"
        controls
        playsInline
        tabIndex={0}
        preload={loaded ? "metadata" : "none"}
        // Withhold the resource itself: preload="none" is only a browser hint.
        src={loaded ? "/media/airport-walkthrough.mp4" : undefined}
        width="1280"
        height="864"
        poster="/images/walkthrough-poster.webp"
        aria-label="AV Weather airport search walkthrough"
        aria-describedby="walkthrough-caption walkthrough-status"
        onError={() => setFailed(true)}
      >
        {loaded && (
          <track
            kind="captions"
            src="/media/airport-walkthrough.vtt"
            srcLang="en"
            label="English"
          />
        )}
        Your browser cannot play this recording. Read the steps below or download
        the recording.
      </video>
      <div className="walkthrough-media-actions">
        {!loaded && (
          <button
            type="button"
            className="landing-button"
            disabled={!hydrated}
            aria-controls="walkthrough-video"
            onClick={() => {
              setLoaded(true);
              video.current?.focus();
            }}
          >
            Load recording
          </button>
        )}
        <p id="walkthrough-status" role="status">
          {failed
            ? "The recording could not be loaded. Download it or read the steps below."
            : loaded
              ? "Recording enabled. Use the video controls to play, pause, seek or turn on English captions."
              : "Load the recording when you’re ready, then press play. No video downloads before you choose to load it."}
        </p>
        <a href="/media/airport-walkthrough.mp4" download>
          Download the walkthrough video
        </a>
        <noscript>
          <p>Enable JavaScript to use the player, download the video, or read the steps below.</p>
        </noscript>
      </div>
    </>
  );
}
