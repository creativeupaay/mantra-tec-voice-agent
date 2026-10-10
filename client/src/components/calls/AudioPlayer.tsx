import { FC, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  ExternalLink,
  Pause,
  Play,
  Music2,
  Info,
} from 'lucide-react'
import { callApi } from '../../api/client'

interface AudioPlayerProps {
  /** MongoDB call document `_id` — streams via authenticated backend proxy. */
  callDbId: string
  callId?: string
  title?: string
  showFullscreen?: boolean
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Generate realistic fine-grained waveform amplitudes (delicate height variance)
const generateFineWaveform = (id: string, count: number = 72) => {
  const bars: number[] = []
  let seed = 0
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) % 10000
  }
  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const rand = seed / 233280
    // Natural audio profile: smooth modulation with conversational speech bursts
    const envelope = Math.sin((i / count) * Math.PI) * 0.5 + 0.3
    const height = Math.min(24, Math.max(4, Math.round((rand * 0.7 + envelope) * 22)))
    bars.push(height)
  }
  return bars
}

export const AudioPlayer: FC<AudioPlayerProps> = ({
  callDbId,
  callId,
  title = 'Call Recording',
  showFullscreen = true,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [buffered, setBuffered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [hoverPercent, setHoverPercent] = useState<number | null>(null)

  const waveformBars = useMemo(() => generateFineWaveform(callDbId || 'default', 72), [callDbId])
  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  const src = useMemo(() => callApi.getRecordingStreamUrl(callDbId), [callDbId])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setBuffered(0)
    setError(null)
    setIsLoading(true)
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
      setError(null)
    }
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1))
      }
    }
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      setError('Recording file unavailable in storage')
      setIsLoading(false)
    }
    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => {
      setIsLoading(false)
      setError(null)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('progress', handleProgress)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('progress', handleProgress)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  useEffect(() => {
    if (!showSpeedMenu) return
    const close = () => setShowSpeedMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showSpeedMenu])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || error) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(err => {
        setError('Playback error: ' + err.message)
        setIsPlaying(false)
      })
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, error])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      const progress = progressRef.current
      if (!audio || !progress || duration === 0 || error) return

      const rect = progress.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      audio.currentTime = percent * duration
      setCurrentTime(percent * duration)
    },
    [duration, error]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const progress = progressRef.current
    if (!progress) return
    const rect = progress.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverPercent(percent)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoverPercent(null)
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
  }, [])

  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }, [])

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current
      if (!audio || error) return
      audio.currentTime = Math.max(0, Math.min(duration || audio.duration || 0, audio.currentTime + delta))
    },
    [duration, error]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const audio = audioRef.current
      if (!audio || error) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          handlePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekBy(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekBy(5)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(v => Math.min(1, v + 0.1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(v => Math.max(0, v - 0.1))
          break
        case 'm':
          handleMuteToggle()
          break
      }
    },
    [handlePlayPause, seekBy, handleMuteToggle, error]
  )

  const handleDownload = useCallback(async () => {
    try {
      const response = await callApi.getRecording(callDbId)
      const blob = response.data
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title || 'recording'}-${callId || 'call'}.wav`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Recording file not found in storage')
    }
  }, [callDbId, title, callId])

  const handleOpenNewTab = useCallback(() => {
    window.open(src, '_blank')
  }, [src])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const isAudioAvailable = !error && !isLoading

  return (
    <div
      className="bg-surface-card border border-border rounded-2xl overflow-hidden shadow-2xs font-sans transition-all"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Audio player for ${title}`}
    >
      {/* ── Studio Header Row ───────────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-surface-page/70 border-b border-border/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md bg-text-primary text-surface-card flex items-center justify-center shrink-0">
            <Music2 size={11} strokeWidth={2.5} />
          </div>
          <span className="text-[11px] font-semibold text-text-primary truncate max-w-[220px]">
            {title}
          </span>
          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-surface-card border border-border text-text-muted">
            WAV • 16kHz
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleDownload}
            disabled={!isAudioAvailable}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-card disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Download Audio (.wav)"
            aria-label="Download Audio"
          >
            <Download size={13} strokeWidth={2} />
          </button>
          {showFullscreen && (
            <button
              onClick={handleOpenNewTab}
              disabled={!isAudioAvailable}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-card disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Open stream in new tab"
              aria-label="Open stream in new tab"
            >
              <ExternalLink size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* ── Fine-line Waveform Timeline (ElevenLabs delicate 2px lines) ── */}
        <div className="space-y-1">
          <div
            ref={progressRef}
            onClick={handleSeek}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="group relative h-9 px-2 rounded-xl bg-surface-page border border-border/70 flex items-center cursor-pointer overflow-hidden transition-colors hover:border-border-strong select-none"
            role="slider"
            aria-label="Audio scrubber timeline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
            tabIndex={0}
          >
            {/* SVG Waveform: 72 delicate thin 2px bars */}
            <svg
              className="w-full h-full overflow-visible"
              viewBox={`0 0 ${waveformBars.length * 4} 28`}
              preserveAspectRatio="none"
            >
              {waveformBars.map((height, idx) => {
                const barPercent = (idx / waveformBars.length) * 100
                const isPlayed = barPercent <= progressPercent
                const isHovered = hoverPercent !== null && barPercent <= hoverPercent * 100
                const x = idx * 4 + 1
                const y = (28 - height) / 2

                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width="1.8"
                    height={height}
                    rx="0.9"
                    fill={
                      isPlayed
                        ? 'var(--color-text-primary)'
                        : isHovered
                          ? 'var(--color-text-secondary)'
                          : 'var(--color-border-strong)'
                    }
                    className="transition-colors duration-75"
                  />
                )
              })}
            </svg>

            {/* Delicate 1.5px Hairline Scrub Head */}
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-text-primary pointer-events-none transition-all shadow-xs"
              style={{ left: `${progressPercent}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-[2.25px] w-1.5 h-1.5 rounded-full bg-text-primary border border-surface-card" />
            </div>

            {/* Hover Tooltip Timestamp */}
            {hoverPercent !== null && duration > 0 && (
              <div
                className="absolute top-0.5 -translate-x-1/2 px-1.5 py-0.2 bg-text-primary text-surface-card text-[9px] font-mono rounded pointer-events-none shadow-sm z-10"
                style={{ left: `${hoverPercent * 100}%` }}
              >
                {formatTime(hoverPercent * duration)}
              </div>
            )}
          </div>

          {/* Time Readout: Current / Total */}
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-text-muted px-1">
            <span className="font-semibold text-text-primary">{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* ── Studio Transport Toolbar (Compact & Sleek) ─────────────── */}
        <div className="flex items-center justify-between pt-0.5">
          {/* Left: Play/Pause & Skip Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => seekBy(-10)}
              disabled={!isAudioAvailable}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Rewind 10s"
              aria-label="Rewind 10s"
            >
              <SkipBack size={14} strokeWidth={2} />
            </button>

            <button
              onClick={handlePlayPause}
              disabled={isLoading || !isAudioAvailable}
              className="w-8 h-8 rounded-full bg-text-primary text-surface-card flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading && !error ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-surface-card border-t-transparent animate-spin" />
              ) : isPlaying ? (
                <Pause size={14} strokeWidth={2.5} fill="currentColor" />
              ) : (
                <Play size={14} strokeWidth={2.5} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            <button
              onClick={() => seekBy(10)}
              disabled={!isAudioAvailable}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Forward 10s"
              aria-label="Forward 10s"
            >
              <SkipForward size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Right: Speed & Volume Controls */}
          <div className="flex items-center space-x-3">
            {/* Speed Pill Selector */}
            <div className="relative">
              <button
                onClick={e => {
                  e.stopPropagation()
                  setShowSpeedMenu(prev => !prev)
                }}
                disabled={!isAudioAvailable}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-text-secondary hover:text-text-primary bg-surface-page border border-border disabled:opacity-40 disabled:pointer-events-none transition-all tabular-nums cursor-pointer"
                aria-label={`Playback speed: ${playbackRate}x`}
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div
                  className="absolute bottom-full right-0 mb-1.5 bg-surface-card border border-border rounded-xl shadow-lg py-1 min-w-18 z-20"
                  onClick={e => e.stopPropagation()}
                >
                  {playbackRates.map(rate => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full px-2.5 py-1 text-left text-[11px] tabular-nums transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-text-primary text-surface-card font-semibold'
                          : 'text-text-secondary hover:bg-surface-page'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Slider */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleMuteToggle}
                disabled={!isAudioAvailable}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-page disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={13} strokeWidth={2} />
                ) : (
                  <Volume2 size={13} strokeWidth={2} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                disabled={!isAudioAvailable}
                className="w-14 h-1 appearance-none bg-border rounded-full cursor-pointer accent-text-primary disabled:opacity-40"
                aria-label="Volume slider"
              />
            </div>
          </div>
        </div>

        {/* ── Subtle Status Notice (Clean & Non-alarming) ────────────── */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-page border border-border text-[11px] text-text-muted">
            <Info size={13} className="shrink-0 text-text-muted" />
            <span>Audio file unavailable in storage for this session</span>
          </div>
        )}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}

export default AudioPlayer
