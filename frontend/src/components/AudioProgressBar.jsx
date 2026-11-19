import React, { useRef, useState, useCallback } from 'react';

/**
 * Spotify-inspired Audio Progress Bar
 * - Smooth continuous playback tracking synchronized with HTML5 audio
 * - Filled deep terracotta track (#9a3412) and warm neutral remaining track (#e7dfd1)
 * - Scaled thumb indicator on hover/drag
 * - Direct click and drag-seeking with pointer capture
 * - Synchronized current time, remaining time, and total duration
 */
export default function AudioProgressBar({
  currentTime = 0,
  duration = 0,
  onSeek,
  disabled = false,
  showTimeLabels = true,
  className = '',
}) {
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const activeTime = isDragging ? dragTime : (currentTime || 0);
  const percent = duration > 0 ? Math.min(100, Math.max(0, (activeTime / duration) * 100)) : 0;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '0:00';
    const totalSecs = Math.floor(Math.max(0, secs));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatRemaining = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '-0:00';
    const totalSecs = Math.floor(Math.max(0, secs));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `-${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const calculateTimeFromEvent = useCallback((e) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const clientX = e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * (duration || 0);
  }, [duration]);

  const handlePointerDown = (e) => {
    if (disabled || !duration || duration <= 0) return;
    if (e.button !== undefined && e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    setIsDragging(true);
    const targetTime = calculateTimeFromEvent(e);
    setDragTime(targetTime);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const targetTime = calculateTimeFromEvent(e);
    setDragTime(targetTime);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const finalTime = calculateTimeFromEvent(e);
    setIsDragging(false);
    if (onSeek) {
      onSeek(finalTime);
    }
  };

  const handlePointerCancel = (e) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
  };

  const handleKeyDown = (e) => {
    if (disabled || !duration || duration <= 0) return;
    let target = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      target = Math.max(0, (currentTime || 0) - 5);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      target = Math.min(duration, (currentTime || 0) + 5);
    } else if (e.key === 'Home') {
      target = 0;
    } else if (e.key === 'End') {
      target = duration;
    }

    if (target !== null) {
      e.preventDefault();
      onSeek?.(target);
    }
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Scrubber Interactive Track Area */}
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={Math.round(activeTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration || 0)}
        aria-label="Audio playback scrubber"
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        className={`relative py-3 cursor-pointer group flex items-center touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#9a3412]/50 rounded-lg ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {/* Track Bar */}
        <div
          ref={trackRef}
          className={`w-full transition-all duration-150 bg-[#e7dfd1] rounded-full relative ${
            isDragging ? 'h-2' : 'h-1.5 group-hover:h-2'
          }`}
        >
          {/* Terracotta Progress Fill */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#9a3412] to-[#b43a14] rounded-full pointer-events-none"
            style={{ width: `${percent}%` }}
          />

          {/* Scrubber Thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#9a3412] ring-2 ring-white shadow-md pointer-events-none transition-transform duration-100 ${
              isDragging ? 'w-4 h-4 scale-125' : 'w-3.5 h-3.5 group-hover:scale-125'
            }`}
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>

      {/* Synchronized Time Labels */}
      {showTimeLabels && (
        <div className="flex justify-between text-xs font-mono text-[#78716c] mt-0.5 font-medium select-none">
          <span>{formatTime(activeTime)}</span>
          <span className="text-[#a8a29e]">{formatRemaining(Math.max(0, (duration || 0) - activeTime))}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
