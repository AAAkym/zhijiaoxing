import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, AlertCircle, Bookmark } from 'lucide-react'

const BACKEND_URL = 'http://localhost:5000'

function getFullVideoUrl(videoUrl) {
  if (!videoUrl) return null
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://') || videoUrl.startsWith('blob:')) {
    return videoUrl
  }
  return `${BACKEND_URL}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`
}

const VideoPlayer = forwardRef(({ 
  videoUrl, 
  title, 
  autoPlay = false, 
  onTimeUpdate, 
  onEnded,
  noteMarkers = [],
  onSeekToNote
}, ref) => {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredMarker, setHoveredMarker] = useState(null)

  const fullVideoUrl = getFullVideoUrl(videoUrl)

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    seekTo: (time) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time
        setCurrentTime(time)
      }
    },
    play: () => {
      if (videoRef.current) {
        videoRef.current.play()
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause()
      }
    },
    getCurrentTime: () => {
      return videoRef.current?.currentTime || 0
    }
  }))

  useEffect(() => {
    const video = videoRef.current
    if (!video || !fullVideoUrl) {
      if (!fullVideoUrl) {
        setError('视频地址无效')
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
      setError(null)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    const handleError = (e) => {
      console.error('[VideoPlayer] 视频加载错误:', e)
      setIsLoading(false)
      setError('视频加载失败，请检查视频地址或格式')
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      setError(null)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)
    video.addEventListener('canplay', handleCanPlay)

    video.load()

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [fullVideoUrl, onTimeUpdate, onEnded])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handlePlayPause = () => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleSeekToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
      if (onSeekToNote) {
        onSeekToNote(time)
      }
    }
  }

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.volume = vol
      setVolume(vol)
      setIsMuted(vol === 0)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const newMuted = !isMuted
    video.muted = newMuted
    setIsMuted(newMuted)
    if (!newMuted && volume === 0) {
      video.volume = 0.5
      setVolume(0.5)
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (error) {
    return (
      <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-white font-medium mb-2">视频加载失败</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          {videoUrl && (
            <p className="text-gray-500 text-xs break-all max-w-md">{videoUrl}</p>
          )}
        </div>
      </div>
    )
  }

  if (!fullVideoUrl) {
    return (
      <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
          <p className="text-white font-medium">暂无视频</p>
          <p className="text-gray-400 text-sm mt-2">请先添加视频地址</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {title && (
        <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white text-sm">加载视频中...</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={fullVideoUrl}
        className="w-full aspect-video"
        onClick={handlePlayPause}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
      />

      {!isPlaying && !isLoading && (
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"
        >
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </button>
      )}

      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="mb-3 relative">
          <div className="absolute inset-0 h-1 bg-white/20 rounded-full top-1/2 -translate-y-1/2"></div>
          <div 
            className="absolute h-1 bg-blue-500 rounded-full top-1/2 -translate-y-1/2" 
            style={{ width: `${progress}%` }}
          ></div>
          
          {noteMarkers && noteMarkers.length > 0 && noteMarkers.map((marker, index) => {
            const markerPosition = duration > 0 ? (marker.timestamp / duration) * 100 : 0
            return (
              <div
                key={index}
                className="absolute top-1/2 -translate-y-1/2 z-20 group"
                style={{ left: `${markerPosition}%`, transform: 'translate(-50%, -50%)' }}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSeekToTime(marker.timestamp)
                }}
              >
                <div className="w-3 h-3 bg-yellow-400 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform shadow-md" />
                {hoveredMarker === marker && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap max-w-48 truncate z-30">
                    <div className="font-medium">{formatTime(marker.timestamp)}</div>
                    {marker.title && (
                      <div className="text-gray-300 truncate">{marker.title}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="relative w-full h-1 bg-transparent rounded-full appearance-none cursor-pointer z-10 accent-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="text-white hover:text-white/80 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-white/80 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-white/80 transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
