import { FC, useRef, useState, useEffect, useCallback } from 'react'
import { Volume2, VolumeX, SkipBack, SkipForward, RotateCcw, Maximize2, ExternalLink } from 'lucide-react'

interface AudioPlayerProps {
  src: string
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
  src, 
  callId, 
  title = 'Call Recording',
  showFullscreen = true 
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
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
  const progressRef = useRef<HTMLDivElement>(null)

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  // Load duration when metadata is loaded
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
  }, [])

  // Apply playback rate changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Apply volume/mute changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

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

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const progress = progressRef.current
    if (!audio || !progress || duration === 0) return

    const rect = progress.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = percent * duration
    setCurrentTime(percent * duration)
  }, [duration])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
  }, [])

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleSpeedChange = useCallback((rate: number) => {
    setPlaybackRate(rate)
    setShowSpeedMenu(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        audio.currentTime = Math.max(0, audio.currentTime - 5)
        break
      case 'ArrowRight':
        e.preventDefault()
        audio.currentTime = Math.min(duration, audio.currentTime + 5)
        break
      case 'ArrowUp':
        e.preventDefault()
        setVolume(Math.min(1, volume + 0.1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setVolume(Math.max(0, volume - 0.1))
        break
      case 'm':
        handleMuteToggle()
        break
    }
  }, [handlePlayPause, duration, volume, handleMuteToggle])

  const handleDownload = useCallback(() => {
    const a = document.createElement('a')
    a.href = src
    a.download = `${title || 'recording'}-${callId || 'call'}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [src, title, callId])

  const handleOpenNewTab = useCallback(() => {
    window.open(src, '_blank')
  }, [src])

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0

  return (
    <div 
      className="relative bg-surface-page border border-border rounded-xl overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`Audio player for ${title}`}
    >
      {/* Progress bar with buffer indicator */}
      <div
        ref={progressRef}
        className="relative h-1.5 bg-transparent cursor-pointer"
        onClick={handleSeek}
        style={{ background: 'transparent' }}
        role="slider"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault()
            const step = e.key === 'ArrowLeft' ? -5 : 5
            const newPercent = Math.max(0, Math.min(100, progressPercent + step))
            if (audioRef.current && duration > 0) {
              audioRef.current.currentTime = (newPercent / 100) * duration
            }
          }
        }}
      >
        {/* Buffered portion */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ 
            width: `${bufferedPercent}%`,
            backgroundColor: 'var(--color-accent)',
            opacity: 0.2 
          }}
        />
        {/* Played portion */}
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ 
            width: `${progressPercent}%`,
            backgroundColor: 'var(--color-accent)' 
          }}
        />
        {/* Playhead */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 shadow-md transition-transform duration-75"
          style={{ 
            left: `${progressPercent}%`,
            backgroundColor: 'var(--color-surface-card)',
            borderColor: 'var(--color-accent)',
            transform: isPlaying ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
          }}
        />
      </div>

      {/* Controls */}
      <div className="px-4 py-3 space-y-3">
        {/* Time display */}
        <div className="flex items-center justify-between text-[12px] font-mono tabular-nums text-text-secondary">
          <span>{formatTime(currentTime)}</span>
          <span className="text-text-muted">{formatTime(duration)}</span>
        </div>

        {/* Main controls row */}
        <div className="flex items-center justify-between gap-4">
          {/* Rewind 10s */}
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
              }
            }}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
            title="Rewind 10s (←)"
            aria-label="Rewind 10 seconds"
          >
            <SkipBack size={18} strokeWidth={2} />
          </button>

          {/* Play/Pause - Large button */}
          <button
            onClick={handlePlayPause}
            className="flex-shrink-0 p-2.5 rounded-full text-text-primary hover:bg-surface-card transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isLoading || error}
          >
            {isLoading ? (
              <svg className="w-6 h-6 animate-spin text-surface-card" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isPlaying ? (
              <span className="block w-5 h-6 flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-card)' }}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-6 rounded bg-current animate-none" />
                  <div className="w-1.5 h-6 rounded bg-current animate-none" />
                </div>
              </span>
            ) : (
              <svg className="w-6 h-6 text-surface-card" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={() => {
              if (audioRef.current && duration > 0) {
                audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10)
              }
            }}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
            title="Forward 10s (→)"
            aria-label="Forward 10 seconds"
          >
            <SkipForward size={18} strokeWidth={2} />
          </button>

          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
              aria-label={`Playback speed: ${playbackRate}x`}
              aria-expanded={showSpeedMenu}
              aria-haspopup="menu"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-surface-card border border-border rounded-lg shadow-lg py-1 min-w-[80px] z-10">
                {playbackRates.map(rate => (
                  <button
                    key={rate}
                    onClick={() => handleSpeedChange(rate)}
                    className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors ${
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

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteToggle}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} strokeWidth={2} />
              ) : volume < 0.5 ? (
                <Volume2 size={18} strokeWidth={2} />
              ) : (
                <Volume2 size={18} strokeWidth={2} />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1.5 appearance-none bg-border rounded-full cursor-pointer accent-accent"
              aria-label="Volume"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
              title="Download recording"
              aria-label="Download recording"
            >
              <RotateCcw size={16} strokeWidth={2} />
            </button>
            {showFullscreen && (
              <button
                onClick={handleOpenNewTab}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card transition-colors"
                title="Open in new tab"
                aria-label="Open in new tab"
              >
                <ExternalLink size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-3 rounded-lg text-[12px]" style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-status-escalated)',
            border: '1px solid',
            borderColor: 'rgba(239, 68, 68, 0.2)'
          }}>
            <p className="flex items-center gap-2">
              <AlertTriangle size={14} strokeWidth={2} />
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  )
}

export default AudioPlayer