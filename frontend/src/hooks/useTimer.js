import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer() {
  const [minutes, setMinutes] = useState('05')
  const [seconds, setSeconds] = useState('00')
  const [isActive, setIsActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRinging, setIsRinging] = useState(false)

  const audioCtxRef = useRef(null)
  const alarmIntervalRef = useRef(null)
  const alarmStartRef = useRef(null)

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }, [])

  const playBeep = useCallback((volume = 0.5, urgency = 0) => {
    const ctx = getAudioCtx()
    // More urgent = higher freq + shorter gap
    const baseFreqs = urgency < 1 
      ? [523.25, 659.25, 783.99, 1046.5]   // normal
      : urgency < 2
      ? [659.25, 880, 1046.5, 1318.5]       // urgent
      : [880, 1046.5, 1318.5, 1568]         // alarm level

    const playTone = (freq, delay) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = urgency >= 2 ? 'sawtooth' : 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(Math.min(volume, 1.0), ctx.currentTime + delay + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + (urgency >= 2 ? 0.8 : 1.2))
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + (urgency >= 2 ? 0.8 : 1.2))
    }

    baseFreqs.forEach((f, i) => playTone(f, i * (urgency >= 2 ? 0.12 : 0.18)))
  }, [getAudioCtx])

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
    alarmStartRef.current = null
  }, [])

  const startAlarm = useCallback(() => {
    alarmStartRef.current = Date.now()

    // Immediate first beep
    playBeep(0.4, 0)

    alarmIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - alarmStartRef.current) / 1000

      let volume, urgency, interval
      if (elapsed < 30) {
        // First 30s: gentle
        volume = 0.4
        urgency = 0
        interval = 2000
      } else if (elapsed < 60) {
        // 30-60s: getting louder
        volume = 0.7
        urgency = 1
        interval = 1200
      } else {
        // 60s+: full alarm
        volume = 1.0
        urgency = 2
        interval = 700
      }

      playBeep(volume, urgency)
    }, 2000) // starts at 2s, gets faster as it reschedules itself

  }, [playBeep])

  useEffect(() => {
    let interval = null
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1)
      }, 1000)
    } else if (isActive && timeLeft === 0) {
      setIsActive(false)
      setIsRinging(true)
      startAlarm()

      // Send desktop notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ Timer Complete!', {
          body: 'Your Heccker timer has finished.',
          icon: '/favicon.ico',
          requireInteraction: true,
        })
      }
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isActive, timeLeft, startAlarm])

  // Escalate alarm interval over time
  useEffect(() => {
    if (!isRinging) return
    stopAlarm()
    startAlarm()
    // Re-start alarm escalation every 30s to update the beep frequency
    const escalationTimer = setInterval(() => {
      if (!isRinging) { clearInterval(escalationTimer); return }
      stopAlarm()
      startAlarm()
    }, 30000)
    return () => { clearInterval(escalationTimer); stopAlarm() }
  }, [isRinging]) // eslint-disable-line

  const toggleTimer = () => {
    if (isRinging) {
      setIsRinging(false)
      stopAlarm()
      setTimeLeft(0)
      return
    }
    if (!isActive && timeLeft === 0) {
      setTimeLeft((parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0))
    }
    setIsActive(!isActive)
  }

  const resetTimer = () => {
    setIsActive(false)
    setIsRinging(false)
    stopAlarm()
    setTimeLeft(0)
  }

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return {
    minutes, setMinutes,
    seconds, setSeconds,
    isActive, setIsActive,
    timeLeft, setTimeLeft,
    isRinging, setIsRinging,
    toggleTimer,
    resetTimer,
    formatTime
  }
}
