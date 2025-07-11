import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import '../styles/surveillancestreams.css';

const VideoStream = ({ url }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!url) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });

      return () => {
        video.src = '';
      };
    } else {
      console.error('HLS not supported in this browser');
    }
  }, [url]);

  return (
    <video ref={videoRef} controls muted playsInline className="video-player" />
  );
};

const SurveillanceStreams = () => {
  const [cameras, setCameras] = useState([]);

  const baseCameras = [
    {
      id: 'cam1',
      label: 'Camera 1 - Entrance',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    },
    {
      id: 'cam2',
      label: 'Camera 2 - Parking Lot',
      url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    },
    {
      id: 'cam3',
      label: 'Camera 3 - Lobby',
      url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    },
    {
      id: 'cam4',
      label: 'Camera 4 - Loading Dock',
      url: 'https://bitdash-a.akamaihd.net/content/mi/bbb.m3u8',
    },
  ];

  useEffect(() => {
    const randomCount = Math.floor(Math.random() * baseCameras.length) + 1;

    const shuffled = baseCameras
      .map((v) => ({ value: v, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);

    const selected = shuffled.slice(0, randomCount);

    // Add status and timestamp for demo display
    const camerasWithExtra = selected.map((cam, i) => ({
      ...cam,
      id: `${cam.id}-${i}`,
      status: i % 2 === 0 ? 'ACTIVE' : 'CLEARED', // alternate status
      time: new Date(Date.now() - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    setCameras(camerasWithExtra);
  }, []);

  return (
    <div className="page">
      <h1 className="title">Live Surveillance Streams</h1>
      <div className="streams-grid">
        {cameras.length === 0 ? (
          <p>Loading cameras...</p>
        ) : (
          cameras.map(({ id, url, label, status, time }) => (
            <div key={id} className="stream-card">
              <div className="stream-header">
                <span className="stream-label">{label}</span>
                <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
              </div>
              <VideoStream url={url} />
              <div className="stream-footer">{time}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SurveillanceStreams;
