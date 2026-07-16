// hooks/useChat.js
// Manages the chat message stream via SSE from the Heccker FastAPI backend.
// Session IDs come from useShelf (heccker_active_session_id) — not a separate ID system.

import { useState, useCallback, useEffect } from 'react'
import { getValidAccessToken } from '../utils/googleCalendar'
import { launchApp, getAppDisplayName } from '../utils/launchApp'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useChat(timer, onNavigate) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setStreaming] = useState(false)
  const [backendOk, setBackendOk] = useState(null)
  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const userId = (localStorage.getItem('heccker_persona') || '').toLowerCase()
      if (!userId) return []  // no persona yet — start clean
      localStorage.removeItem('heccker_logs')
      const saved = localStorage.getItem(`heccker_logs_${userId}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [sessionCost, setSessionCost] = useState(0.00)
  const [isLocked, setIsLocked] = useState(false)
  const [lockReason, setLockReason] = useState('stress')

  useEffect(() => {
    const userId = (localStorage.getItem('heccker_persona') || '').toLowerCase()
    if (!userId) return
    localStorage.setItem(`heccker_logs_${userId}`, JSON.stringify(auditLogs))
  }, [auditLogs])

  useEffect(() => {
    const userId = (localStorage.getItem('heccker_persona') || '').toLowerCase()
    if (!userId) return  // don't fetch logs until persona is established
    fetch(`${API_URL}/api/logs?user_id=${encodeURIComponent(userId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.logs && data.logs.length > 0) {
          setAuditLogs(prev => {
            const merged = [...data.logs, ...prev]
            const unique = Array.from(new Map(merged.map(item => [item.id, item])).values())
            return unique.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 100)
          })
        }
      })
      .catch(() => {})
  }, [])

  const addAuditLog = useCallback((entry) => {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const userId = (localStorage.getItem('heccker_persona') || 'guest').toLowerCase()
    const fullEntry = { ...entry, time, id: Date.now().toString(), user_id: userId }

    setAuditLogs(prev => [fullEntry, ...prev].slice(0, 100))

    fetch(`${API_URL}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullEntry)
    }).catch(() => {})
  }, [])

  const sendMessage = useCallback(async (text, storageHooks = {}, hidden = false, fallbackMsg = null, overrideHistory = null) => {
    if (!text.trim() || isStreaming) return

    const { addItem, updateSessionTitle, sessionId } = storageHooks
    let activeSessionId = sessionId
    if (activeSessionId == null) {
      try {
        const raw = localStorage.getItem('heccker_active_session_id')
        activeSessionId = raw ? JSON.parse(raw) : null
      } catch { activeSessionId = null }
    }
    if (activeSessionId == null) activeSessionId = Date.now()

    const userId = Date.now()
    if (!hidden) {
      setMessages(prev => [
        ...prev,
        { id: userId, role: 'user', content: text, timestamp: new Date() },
      ])
    }

    const agentId = userId + 1
    setMessages(prev => [
      ...prev,
      { id: agentId, role: 'agent', content: '', toolCalls: [], timestamp: new Date(), streaming: true },
    ])

    setStreaming(true)
    if (!hidden) {
      addAuditLog({ tag: 'user', msg: `Message sent: "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"` })
    }

    const wakeUpTimeout = setTimeout(() => {
      setMessages(prev => prev.map(m => {
        if (m.id === agentId) {
          return { ...m, content: m.content + '\n\n*(Heccker is taking longer than usual to respond. This might be a network delay, please hold on...)*\n\n' }
        }
        return m
      }))
    }, 6000)

    try {
      const chatHistory = overrideHistory || messages
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, parts: [{ text: m.content }] }))

      const persona = localStorage.getItem('heccker_persona') || 'guest'
      const accessToken = getValidAccessToken()

      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory,
          user_id: persona.toLowerCase(),
          session_id: String(activeSessionId),
          local_time: new Date().toString(),
          workspace_connect: localStorage.getItem('heccker_workspace_connect') === 'true',
          access_token: accessToken || '',
        }),
      })

      clearTimeout(wakeUpTimeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setBackendOk(true)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { reader.cancel(); break }

          try {
            const ev = JSON.parse(raw)

            if (ev.type === 'text' || ev.content) {
              const textContent = ev.type === 'text' ? ev.content : ev.content
              setMessages(prev => prev.map(m => {
                if (m.id === agentId) {
                  const blocks = m.blocks ? [...m.blocks] : []
                  if (blocks.length > 0 && blocks[blocks.length - 1].type === 'text') {
                    const lastBlock = { ...blocks[blocks.length - 1] }
                    lastBlock.content += textContent
                    blocks[blocks.length - 1] = lastBlock
                  } else {
                    blocks.push({ type: 'text', content: textContent })
                  }
                  return { ...m, content: m.content + textContent, blocks }
                }
                return m
              }))
            } else if (ev.type === 'agent_action') {
              setMessages(prev => prev.map(m => {
                if (m.id === agentId) {
                  let updatedBlocks = [...(m.blocks || [])]

                  if (ev.status?.toLowerCase() === 'cleared') {
                    const idx = updatedBlocks.findIndex(b => b.type === 'tool' && b.tool === ev.tool && b.status?.toLowerCase() === 'executing')
                    if (idx !== -1) {
                      updatedBlocks[idx] = { ...updatedBlocks[idx], status: 'cleared', detail: ev.detail }
                    } else {
                      updatedBlocks.push({ ...ev, type: 'tool' })
                    }
                  } else {
                    updatedBlocks.push({ ...ev, type: 'tool' })
                  }

                  return {
                    ...m,
                    toolCalls: [...(m.toolCalls || []), ev],
                    blocks: updatedBlocks
                  }
                }
                return m
              }))
              addAuditLog({ tag: ev.agent || 'agent', msg: `${ev.detail || ev.status}` })
            } else if (ev.type === 'launch_app') {
              const displayName = getAppDisplayName(ev.app || '')
              addAuditLog({ tag: 'heccker', msg: `Launching ${displayName}` })
              launchApp(ev.app || '')
            } else if (ev.type === 'cart_add') {
              addAuditLog({ tag: 'shopping_agent', msg: `Cart staged: ${ev.item} @ ${ev.price}` })
              if (addItem) addItem(ev.item, ev.price, ev.url)
              if (onNavigate) onNavigate('cart')
            } else if (ev.type === 'calendar_add') {
              addAuditLog({ tag: 'calendar_agent', msg: `Event staged: ${ev.title}` })
              if (storageHooks.addEvent) storageHooks.addEvent(ev.title, ev.date_time)
              if (onNavigate) onNavigate('calendar', 'calendar')
            } else if (ev.type === 'todo_add') {
              addAuditLog({ tag: 'todo_agent', msg: `Task added: ${ev.task}` })
              if (storageHooks.addTodo) storageHooks.addTodo(ev.task)
              if (onNavigate) onNavigate('todos')
            } else if (ev.type === 'artifact_add') {
              addAuditLog({ tag: 'heccker', msg: `Artifact created: ${ev.path}` })
              if (storageHooks.addArtifact) storageHooks.addArtifact(ev.path)
              setMessages(prev => prev.map(m => {
                if (m.id === agentId) {
                  const blocks = m.blocks || []
                  const base = (p) => (p || '').split('/').pop().toLowerCase()
                  const already = blocks.some(
                    b => b.type === 'artifact' && base(b.path) === base(ev.path)
                  )
                  if (already) return m
                  return { ...m, blocks: [...blocks, { type: 'artifact', path: ev.path }] }
                }
                return m
              }))
            } else if (ev.type === 'session_title') {
              if (updateSessionTitle) updateSessionTitle(activeSessionId, ev.title)
            } else if (ev.type === 'security_block') {
              setMessages(prev => prev.map(m => {
                if (m.id === agentId) {
                  const blocks = [...(m.blocks || []), { type: 'security_block', content: ev.content }]
                  return { ...m, content: ev.content, isBlocked: true, blocks }
                }
                return m
              }))
              addAuditLog({ tag: 'security_agent', msg: `BLOCKED: ${ev.content?.slice(0, 60)}` })
            } else if (ev.type === 'system_lock') {
              setIsLocked(true)
              setLockReason(ev.reason || 'stress')
              addAuditLog({ tag: 'system', msg: `SCREEN LOCKED: ${ev.reason}` })
            } else if (ev.type === 'set_timer') {
              if (timer) {
                timer.setMinutes(ev.minutes.toString().padStart(2, '0'))
                timer.setSeconds(ev.seconds.toString().padStart(2, '0'))
                timer.setIsActive(true)
                timer.setTimeLeft((parseInt(ev.minutes) || 0) * 60 + (parseInt(ev.seconds) || 0))
              }
              if (onNavigate) onNavigate('calendar', 'timer')
              addAuditLog({ tag: 'timer_agent', msg: `Timer started: ${ev.minutes}:${ev.seconds}` })
            } else if (ev.type === 'error') {
              setMessages(prev => prev.map(m => {
                if (m.id === agentId) {
                  const blocks = [...(m.blocks || []), { type: 'error', content: 'Error: ' + ev.content }]
                  return { ...m, content: 'Error: ' + ev.content, isError: true, blocks }
                }
                return m
              }))
              addAuditLog({ tag: 'error', msg: ev.content })
            } else if (ev.type === 'token_update') {
              if (ev.cost_usd !== undefined) setSessionCost(ev.cost_usd)
            }
          } catch { /* skip malformed SSE chunk */ }
        }
      }
      } finally {
        try { reader.cancel() } catch {}
      }
    } catch (err) {
      setBackendOk(false)
      addAuditLog({ tag: 'system', msg: `Backend error: ${err.message}` })

      if (fallbackMsg) {
        setMessages(prev => prev.map(m =>
          m.id === agentId ? { ...m, content: fallbackMsg, isError: false, streaming: false, blocks: [{ type: 'text', content: fallbackMsg }] } : m
        ))
      } else {
        const offline = err.message.includes('fetch')
          ? `Heccker is offline — try again in a moment.`
          : `Error: ${err.message}`

        setMessages(prev => prev.map(m =>
          m.id === agentId ? { ...m, content: offline, isError: true, streaming: false } : m
        ))
      }
      setStreaming(false)
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === agentId ? { ...m, streaming: false } : m
      ))
      setStreaming(false)
    }
  }, [messages, isStreaming, addAuditLog, timer, onNavigate])

  const retryMessage = useCallback(async (failedAgentMessageId, passedStorageHooks = {}) => {
    const idx = messages.findIndex(m => m.id === failedAgentMessageId)
    if (idx > 0 && messages[idx - 1].role === 'user') {
      const userText = messages[idx - 1].content
      const historyToPass = messages.slice(0, idx - 1)
        .filter(m => !m.streaming)
        .map(m => ({ role: m.role, parts: [{ text: m.content }] }))

      setMessages(prev => prev.filter(m => m.id !== failedAgentMessageId))
      setTimeout(() => sendMessage(userText, passedStorageHooks, true, null, historyToPass), 50)
    }
  }, [messages, sendMessage])

  return {
    messages,
    setMessages,
    isStreaming,
    setStreaming,
    backendOk,
    sendMessage,
    retryMessage,
    auditLogs,
    setAuditLogs,
    sessionCost,
    isLocked,
    setIsLocked,
    lockReason
  }
}
