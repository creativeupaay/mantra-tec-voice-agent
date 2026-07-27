import { FC, useRef, useState, useEffect, useCallback, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  ExternalLink,
  AlertTriangle,
  Pause,
  Play,
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

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  // Token in query so <audio> can send Range requests without Authorization headers.
  const src = useMemo(() => callApi.getRecordingStreamUrl(callDbId), [callDbId])

  // Reset player state when the recording source changes
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
    }
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1))
      }
    }
    const handleEnded = () => setIsPlaying(false)
    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement
      setError(audioEl.error?.message || 'Failed to load audio')
      setIsLoading(false)
    }
    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

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

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return
    const close = () => setShowSpeedMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showSpeedMenu])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(err => {
        setError(err.message)
        setIsPlaying(false)
      })
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      const progress = progressRef.current
      if (!audio || !progress || duration === 0) return

      const rect = progress.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      audio.currentTime = percent * duration
      setCurrentTime(percent * duration)
    },
    [duration]
  )

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
      if (!audio) return
      audio.currentTime = Math.max(0, Math.min(duration || audio.duration || 0, audio.currentTime + delta))
    },
    [duration]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const audio = audioRef.current
      if (!audio) return

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
    [handlePlayPause, seekBy, handleMuteToggle]
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download recording')
    }
  }, [callDbId, title, callId])

  const handleOpenNewTab = useCallback(() => {
    window.open(src, '_blank')
  }, [src])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div
      className="bg-surface-page border border-border rounded-xl overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Audio player for ${title}`}
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        {/* Scrubber */}
        <div>
          <div
            ref={progressRef}
            className="group relative h-2 rounded-full cursor-pointer bg-border/60"
            onClick={handleSeek}
            role="slider"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                seekBy(e.key === 'ArrowLeft' ? -5 : 5)
              }
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${bufferedPercent}%`,
                backgroundColor: 'var(--color-accent)',
                opacity: 0.2,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: 'var(--color-accent)',
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `${progressPercent}%`,
                backgroundColor: 'var(--color-surface-card)',
                borderColor: 'var(--color-accent)',
              }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary transport */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => seekBy(-10)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
            title="Rewind 10s"
            aria-label="Rewind 10 seconds"
          >
            <SkipBack size={18} strokeWidth={2} />
          </button>

          <button
            onClick={handlePlayPause}
            className="w-11 h-11 rounded-full flex items-center justify-center text-surface-card shadow-sm transition-transform hover:scale-[1.03] disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoading || !!error}
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
              <Pause size={18} strokeWidth={2.25} fill="currentColor" />
            ) : (
              <Play size={18} strokeWidth={2.25} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekBy(10)}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
            title="Forward 10s"
            aria-label="Forward 10 seconds"
          >
            <SkipForward size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Secondary controls — separated so the transport isn't cramped */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/70">
          <div className="relative">
            <button
              onClick={e => {
                e.stopPropagation()
                setShowSpeedMenu(prev => !prev)
              }}
              className="px-2.5 py-1 rounded-md text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors tabular-nums"
              aria-label={`Playback speed: ${playbackRate}x`}
              aria-expanded={showSpeedMenu}
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div
                className="absolute bottom-full left-0 mb-1.5 bg-surface-card border border-border rounded-lg shadow-lg py-1 min-w-18 z-10"
                onClick={e => e.stopPropagation()}
              >
                {playbackRates.map(rate => (
                  <button
                    key={rate}
                    onClick={() => handleSpeedChange(rate)}
                    className={`w-full px-3 py-1.5 text-left text-[12px] tabular-nums transition-colors ${
                      playbackRate === rate
                        ? 'bg-accent text-surface-card font-medium'
                        : 'text-text-secondary hover:bg-surface-page'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center max-w-35">
            <button
              onClick={handleMuteToggle}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors shrink-0"
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={15} strokeWidth={2} />
              ) : (
                <Volume2 size={15} strokeWidth={2} />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1 appearance-none bg-border rounded-full cursor-pointer accent-accent"
              aria-label="Volume"
            />
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
              title="Download recording"
              aria-label="Download recording"
            >
              <Download size={15} strokeWidth={2} />
            </button>
            {showFullscreen && (
              <button
                onClick={handleOpenNewTab}
                className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
                title="Open in new tab"
                aria-label="Open in new tab"
              >
                <ExternalLink size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            className="flex items-start gap-2 p-2.5 rounded-lg text-[12px]"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--color-status-escalated)',
              border: '1px solid rgba(239, 68, 68, 0.18)',
            }}
          >
            <AlertTriangle size={14} strokeWidth={2} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  )
}

export default AudioPlayer
