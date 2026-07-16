// hooks/useStorage.js
// Persistent states for cart, calendar, todos, and chat shelf.
// Synced to localStorage (per-user namespaced key) and Firestore (user-scoped path).

import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getUid() {
  return (localStorage.getItem('heccker_persona') || '').toLowerCase()
}

function useCloudStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const uid = getUid()
      if (!uid) return initial  // no persona yet (onboarding) → start clean
      const raw = localStorage.getItem(`${uid}_${key}`)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })

  // Write to namespaced localStorage + cloud
  useEffect(() => {
    const uid = getUid() || 'guest'
    try { localStorage.setItem(`${uid}_${key}`, JSON.stringify(value)) } catch {}

    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/state/${encodeURIComponent(key)}?user_id=${encodeURIComponent(uid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: value })
      }).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [key, value])

  // Fetch from cloud on mount or after persona is set (sync_state event)
  useEffect(() => {
    const fetchCloud = () => {
      const uid = getUid()
      if (!uid) return  // skip during onboarding — persona not set yet
      fetch(`${API_URL}/api/state/${encodeURIComponent(key)}?user_id=${encodeURIComponent(uid)}`)
        .then(res => res.json())
        .then(data => {
          if (data.data !== null && data.data !== undefined) {
            const lsKey = `${uid}_${key}`
            if (Array.isArray(data.data) && data.data.length === 0) {
              const currentLocal = JSON.parse(localStorage.getItem(lsKey) || '[]')
              if (Array.isArray(currentLocal) && currentLocal.length > 0) return
            }
            setValue(data.data)
            localStorage.setItem(lsKey, JSON.stringify(data.data))
          }
        })
        .catch(() => {})
    }

    fetchCloud()
    window.addEventListener('sync_state', fetchCloud)
    return () => window.removeEventListener('sync_state', fetchCloud)
  }, [key])

  return [value, setValue]
}

// ── Shopping Cart ───────────────────────────────────────────────────────
export function useCart() {
  const [cart, setCart] = useCloudStorage('heccker_cart', [])

  const addItem = (item_name, price, source_url) =>
    setCart(prev => [
      ...prev,
      { id: Date.now(), item_name, price, source_url, status: 'pending_checkout' },
    ])

  const removeItem = id => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart  = ()   => setCart([])

  return { cart, addItem, removeItem, clearCart }
}

// ── Calendar ────────────────────────────────────────────────────────────
export function useCalendar() {
  const [events, setEvents] = useCloudStorage('heccker_calendar', [])

  const addEvent    = (title, date_time) =>
    setEvents(prev => [...prev, { id: Date.now() + Math.random(), title, date_time }])
  const removeEvent = id => setEvents(prev => prev.filter(e => e.id !== id))

  const parseGoogleDate = (str) => {
    try {
      if (!str) return new Date(0)
      const parts = str.split('/')
      const start = parts[0]
      if (start.length === 16 && start.includes('T') && start.endsWith('Z')) {
        const y = start.substring(0, 4)
        const m = start.substring(4, 6)
        const d = start.substring(6, 8)
        const h = start.substring(9, 11)
        const min = start.substring(11, 13)
        const s = start.substring(13, 15)
        return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`)
      }
      const d = new Date(start)
      return isNaN(d.getTime()) ? new Date(0) : d
    } catch {
      return new Date(0)
    }
  }

  const sorted = [...events].sort((a, b) =>
    parseGoogleDate(a.date_time) - parseGoogleDate(b.date_time)
  )

  const addGoogleEvents = useCallback((gcalEvents) => {
    setEvents(prev => {
      const existingIds = new Set(prev.map(e => e.id))
      const newEvents = gcalEvents.filter(e => !existingIds.has(e.id))
      return [...prev, ...newEvents]
    })
  }, [setEvents])

  return { events: sorted, addEvent, removeEvent, parseGoogleDate, addGoogleEvents }
}

// ── Todos ────────────────────────────────────────────────────────────────
export function useTodos() {
  const [todos, setTodos] = useCloudStorage('heccker_todos', [])

  const addTodo = task => setTodos(prev => {
    if (prev.some(t => t.task === task)) return prev
    return [...prev, { id: Date.now() + Math.random(), task, done: false }]
  })
  const toggleTodo = id   => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const removeTodo = id   => setTodos(prev => prev.filter(t => t.id !== id))
  const clearCompleted = () => setTodos(prev => prev.filter(t => !t.done))
  const clearAll     = () => setTodos([])

  return { todos, addTodo, toggleTodo, removeTodo, clearCompleted, clearAll }
}

// ── Artifacts ────────────────────────────────────────────────────────────
export function useArtifacts() {
  const [artifacts, setArtifacts] = useCloudStorage('heccker_artifacts', [])

  const addArtifact = path => {
    const fileName = path.replace(/\\/g, '/').split('/').pop()
    setArtifacts(prev => {
      if (prev.some(a => a.path.replace(/\\/g, '/').split('/').pop() === fileName)) return prev
      return [{ id: Date.now(), path: fileName, timestamp: new Date().toISOString() }, ...prev]
    })
  }
  const removeArtifact = id => setArtifacts(prev => prev.filter(a => a.id !== id))

  return { artifacts, addArtifact, removeArtifact }
}

// ── Diary ─────────────────────────────────────────────────────────────────
export function useDiary() {
  const [entries, setEntries] = useCloudStorage('heccker_diary', [])

  const addEntry = (title = 'Untitled Entry', content = '') =>
    setEntries(prev => [
      { id: Date.now(), title: title || 'Untitled Entry', content, date: new Date().toISOString() },
      ...prev
    ])

  const updateEntry = (id, changes) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes, updatedAt: new Date().toISOString() } : e))

  const deleteEntry = id => setEntries(prev => prev.filter(e => e.id !== id))

  return { entries, addEntry, updateEntry, deleteEntry }
}

// ── Chat Session Shelf (History) ─────────────────────────────────────────
export function useShelf() {
  const [sessions, setSessions] = useCloudStorage('heccker_sessions', [])
  const [activeSessionId, _setActiveSessionId] = useCloudStorage('heccker_active_session_id', null)

  const createSession = useCallback(() => {
    const newSession = {
      id: Date.now(),
      title: 'New Chat Session',
      messages: [],
      updatedAt: new Date().toISOString()
    }
    setSessions(prev => {
      const updated = [newSession, ...prev]
      // Write synchronously so the cloud-sync guard sees it immediately
      const uid = getUid() || 'guest'
      try { localStorage.setItem(`${uid}_heccker_sessions`, JSON.stringify(updated)) } catch {}
      return updated
    })
    return newSession.id
  }, [setSessions])

  const setActiveSessionId = useCallback((id) => {
    _setActiveSessionId(id)
  }, [_setActiveSessionId])

  const updateSessionTitle = useCallback((sessionId, title) => {
    setSessions(prev => prev.map(s => String(s.id) === String(sessionId) ? { ...s, title } : s))
  }, [setSessions])

  const saveSessionMessages = useCallback((sessionId, messages) => {
    if (!sessionId) return
    setSessions(prev => {
      const exists = prev.some(s => String(s.id) === String(sessionId))
      if (!exists && (!messages || messages.length === 0)) return prev
      if (!exists) {
        const firstUserMsg = (messages || []).find(m => m.role === 'user')
        const title = firstUserMsg ? firstUserMsg.content.slice(0, 32) + (firstUserMsg.content.length > 32 ? '…' : '') : 'New Chat Session'
        return [{ id: sessionId, title, messages: messages || [], updatedAt: new Date().toISOString() }, ...prev]
      }
      return prev.map(s => {
        if (String(s.id) !== String(sessionId)) return s
        let title = s.title
        if ((s.title === 'New Chat Session' || !s.title) && messages && messages.length > 0) {
          const firstUserMsg = messages.find(m => m.role === 'user')
          if (firstUserMsg) {
            title = firstUserMsg.content.slice(0, 32) + (firstUserMsg.content.length > 32 ? '…' : '')
          }
        }
        return { ...s, title, messages: messages || s.messages, updatedAt: new Date().toISOString() }
      })
    })
  }, [setSessions])

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) {
      _setActiveSessionId(null)
    }
  }, [setSessions, activeSessionId, _setActiveSessionId])

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    saveSessionMessages,
    deleteSession,
    updateSessionTitle
  }
}
