/* Heccker-OS Service Worker — background agent loop
 * Fires OS notifications even when the tab is closed/minimized.
 * Capabilities:
 *   - Calendar event reminders (10 min before)
 *   - Email poll badge (if backend exposes unread count)
 *   - Auto-todo detection from chat messages
 *   - Keeps beating as long as the browser is open
 */

const CACHE_VERSION = 'heccker-sw-v1'

// In-memory state (lives as long as the SW is alive)
let calendarEvents = []
let firedReminders = new Set()
let lastEmailCheck = 0
let knownUnreadCount = 0
let API_URL = 'http://localhost:8000'
let swReady = false

// ── Install & Activate ────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
  swReady = true
})

// ── Message bus (from App.jsx) ────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {}

  if (type === 'INIT') {
    if (payload?.apiUrl) API_URL = payload.apiUrl
  }

  if (type === 'SYNC_CALENDAR') {
    calendarEvents = payload?.events || []
  }

  if (type === 'SYNC_TODOS') {
    // No-op for now — todos handled reactively in App
  }

  if (type === 'PING') {
    // Periodic heartbeat from App — run the background check
    // Note: _checkEmail disabled — server IMAP uses owner credentials, not per-user
    _checkCalendar()
  }

  if (type === 'CHAT_MESSAGE') {
    // Auto-detect todo patterns ("I need to...", "remind me to...", "don't forget to...")
    _detectTodo(payload?.text || '', payload?.persona || 'Guest')
  }

  // Acknowledge every message so the client knows SW is alive
  if (e.ports && e.ports[0]) {
    e.ports[0].postMessage({ alive: true })
  }
})

// ── Push (from backend if configured) ────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return
  try {
    const data = e.data.json()
    e.waitUntil(
      self.registration.showNotification(data.title || 'Heccker', {
        body: data.body || '',
        icon: '/logo.png',
        badge: '/favicon.png',
        requireInteraction: data.requireInteraction || false,
        data: data,
      })
    )
  } catch {}
})

// ── Notification click — focus or open the tab ────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})

// ── Calendar check ────────────────────────────────────────────────────────────
function _checkCalendar() {
  const now = Date.now()
  for (const ev of calendarEvents) {
    if (!ev.date_time || !ev.title) continue
    const eventTime = new Date(ev.date_time).getTime()
    const diffMin = (eventTime - now) / 60000

    // Fire between 10–11 minutes before (gives a ~10s window to avoid duplicate fires on 10s ping)
    if (diffMin > 0 && diffMin <= 11) {
      const key = `cal_${ev.id || ev.title}_${ev.date_time}`
      if (!firedReminders.has(key)) {
        firedReminders.add(key)
        const timeStr = new Date(ev.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        _notify('Heccker — Upcoming Meeting', `📅 "${ev.title}" starts at ${timeStr} — get ready!`, { requireInteraction: true })
        _broadcastToClients({ type: 'CALENDAR_ALERT', event: ev })
      }
    }
  }

  // Clean up stale reminder keys every hour
  if (firedReminders.size > 50) firedReminders.clear()
}

// ── Email poll (lightweight — just checks unread count) ──────────────────────
async function _checkEmail() {
  const now = Date.now()
  if (now - lastEmailCheck < 5 * 60 * 1000) return // Only every 5 minutes
  lastEmailCheck = now

  try {
    const res = await fetch(`${API_URL}/api/email/unread_count`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return
    const data = await res.json()
    const count = data.count || 0
    if (count > knownUnreadCount) {
      const newCount = count - knownUnreadCount
      _notify('Heccker — New Email', `📧 You have ${newCount} new unread email${newCount > 1 ? 's' : ''}.`)
      _broadcastToClients({ type: 'EMAIL_ALERT', newCount, totalUnread: count })
    }
    knownUnreadCount = count
  } catch {
    // Endpoint may not exist — silently skip
  }
}

// ── Todo auto-detection ───────────────────────────────────────────────────────
function _detectTodo(text, persona) {
  const patterns = [
    /\bI need to\b(.{5,80})/i,
    /\bremind me to\b(.{5,80})/i,
    /\bdon't forget (?:to\b)?(.{5,80})/i,
    /\bI have to\b(.{5,80})/i,
    /\bgotta\b(.{5,80})/i,
    /\bI should\b(.{5,80})/i,
    /\bneed to\b(.{5,80})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const task = match[1].replace(/[,.!?].*$/, '').trim()
      if (task.length > 3) {
        _broadcastToClients({ type: 'AUTO_TODO', task, persona })
        // Don't notify for every todo — let the UI handle it silently
        return
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _notify(title, body, opts = {}) {
  if (self.registration.showNotification) {
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/favicon.png',
      ...opts,
    })
  }
}

function _broadcastToClients(data) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage(data)
    }
  })
}
