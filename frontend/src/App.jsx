import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Flex, Text, Button, Input, IconButton } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import ChatArea from './components/ChatArea'
import Sidebar from './components/Sidebar'
import MobileNavBar from './components/MobileNavBar'
import AuditPanel from './components/AuditPanel'
import SettingsPanel from './components/SettingsPanel'
import CartPanel from './components/CartPanel'
import CalendarPanel from './components/CalendarPanel'
import TodoPanel from './components/TodoPanel'
import ShelfPanel from './components/ShelfPanel'
import ArtifactPanel from './components/ArtifactPanel'
import TimerPanel from './components/TimerPanel'
import BackButton from './components/BackButton'
import LockScreen from './components/LockScreen'
import { useChat } from './hooks/useChat'
import { useCart, useCalendar, useTodos, useShelf, useArtifacts } from './hooks/useStorage'
import { useTimer } from './hooks/useTimer'
import { syncGoogleCalendar, getValidAccessToken } from './utils/googleCalendar'
import { Delete01Icon, Notification01Icon, Download01Icon } from 'hugeicons-react'
import { downloadArtifactFile } from './utils/artifactFiles'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getMoment(t) {
  if (t % 120 === 0) return 'water' // Drink water reminder every 2 hours
  if (t === 660)  return 'breakfast'
  if (t === 780)  return 'lunch'
  if (t === 840)  return 'stretch'
  if (t === 1080) return 'dinner'
  if (t === 1200) return 'evening'
  if (t === 1260) return 'hard_stop'
  return null
}

export default function App() {
  const cart     = useCart()
  const calendar = useCalendar()
  const calendarRef = useRef(calendar)
  calendarRef.current = calendar
  const todos    = useTodos()
  const shelf    = useShelf()
  const timer    = useTimer()
  const artifacts = useArtifacts()

  const currentScreenState = useState('chat')
  const currentScreen = currentScreenState[0]
  const setCurrentScreen = currentScreenState[1]
  const [calendarView, setCalendarView] = useState('calendar')
  const [activeDesktopTab, setActiveDesktopTab] = useState('cart')

  const [pendingArtifactPath, setPendingArtifactPath] = useState(null)

  useEffect(() => {
    // open_artifact is fired by the agent when it creates a new file this session.
    // Navigate and open the specific new file — do NOT auto-open on hydration.
    const handleOpenArtifact = (e) => {
      setCurrentScreen('artifacts')
      if (e.detail) {
        setPendingArtifactPath(e.detail)
      }
    }
    window.addEventListener('open_artifact', handleOpenArtifact)
    return () => window.removeEventListener('open_artifact', handleOpenArtifact)
  }, [])

  const onNavigate = useCallback((screen, subScreen) => {
    // If on a wide screen (desktop), don't rip the user out of the chat view. Just switch the side tab.
    if (window.innerWidth >= 992 && ['cart', 'calendar', 'todos', 'shelf'].includes(screen)) {
      setActiveDesktopTab(screen)
    } else {
      setCurrentScreen(screen)
      if (['cart', 'calendar', 'todos', 'shelf'].includes(screen)) {
        setActiveDesktopTab(screen)
      }
    }
    
    if (screen === 'calendar' && subScreen) {
      setCalendarView(subScreen)
    }
  }, [setCurrentScreen])

  const chat     = useChat(timer, onNavigate)

  // Wrap sendMessage to also forward user text to SW for todo auto-detection
  const _origSendMessage = chat.sendMessage
  chat.sendMessage = useCallback((text, storageHooks, hidden, fallbackMsg, overrideHistory) => {
    if (!hidden && text && !text.startsWith('[SYSTEM')) {
      const sw = window.__heckkerSW?.active
      if (sw) sw.postMessage({ type: 'CHAT_MESSAGE', payload: { text, persona: localStorage.getItem('heccker_persona') || 'Guest' } })
    }
    return _origSendMessage(text, storageHooks, hidden, fallbackMsg, overrideHistory)
  }, [_origSendMessage])

  const { sessions, activeSessionId, setActiveSessionId, saveSessionMessages, createSession } = shelf
  const { messages, setMessages, auditLogs } = chat

  const chatStorageHooks = useCallback(() => ({
    addItem: cart.addItem,
    updateSessionTitle: shelf.updateSessionTitle,
    addEvent: calendar.addEvent,
    addTodo: todos.addTodo,
    addArtifact: artifacts.addArtifact,
    sessionId: activeSessionId,
  }), [activeSessionId, cart.addItem, shelf.updateSessionTitle, calendar.addEvent, todos.addTodo, artifacts.addArtifact])

  const switchingRef  = useRef(false)
  const lastMomentRef = useRef('')
  const fetchingRef   = useRef(false)
  // Module-level guard so wellbeing messages never duplicate even across re-renders
  if (!window.__heckkerFiredMoments) window.__heckkerFiredMoments = new Set()

  // Google Auth state
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('heccker_user') || 'null') } catch { return null }
  })
  
  // Onboarding Persona
  const [persona, setPersona] = useState(() => localStorage.getItem('heccker_persona'))
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('heccker_persona'))
  const [guestForm, setGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [nameError, setNameError] = useState('')
  const isCreatorName = ['skg77', 'shacabondo', 'shacodone'].includes(guestName.toLowerCase().trim())
  const googleBtnRef = useRef(null)
  const [gsiLoaded, setGsiLoaded] = useState(false)
  
  const [wellbeingReminder, setWellbeingReminder] = useState(null)
  const [avatarSrc, setAvatarSrc] = useState(null)

  // iOS Safari doesn't fire beforeinstallprompt — detect and show a manual guide instead.
  // Once the app is running as an installed PWA (standalone), permanently mark it dismissed
  // so the banner never reappears even if the user later opens a browser tab.
  const [showIOSInstallBanner, setShowIOSInstallBanner] = useState(() => {
    try {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const isStandalone = window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
      if (isStandalone) {
        // Running as installed PWA — suppress forever
        localStorage.setItem('heccker_ios_banner_dismissed', '1')
        return false
      }
      const dismissed = localStorage.getItem('heccker_ios_banner_dismissed')
      return isIOS && !dismissed
    } catch { return false }
  })

  // activeArtifact is lifted here so the artifacts screen header can show the
  // filename and so the single back button handles both preview→list and list→chat.
  const [activeArtifact, setActiveArtifact] = useState(null)

  const onOpenLogs = () => setCurrentScreen('logs')
  const onOpenSettings = () => setCurrentScreen('settings')
  const onOpenShelf = () => setCurrentScreen('shelf')
  const onOpenCalendar = () => setCurrentScreen('calendar')
  const onOpenTodos = () => setCurrentScreen('todos')
  const onOpenCart = () => setCurrentScreen('cart')
  const onOpenArtifacts = () => setCurrentScreen('artifacts')
  // Smart back: from artifact preview → go to list; from list → go to chat
  const onGoBack = () => {
    if (currentScreen === 'artifacts' && activeArtifact) {
      setActiveArtifact(null)
    } else {
      setCurrentScreen('chat')
    }
  }

  // Request desktop notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Google Identity Services initialisation — full OAuth2 with Calendar scope
  useEffect(() => {
    if (document.querySelector("script[src='https://accounts.google.com/gsi/client']")) {
      if (window.google) setGsiLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      if (window.google && !window._gsi_initialized) {
        window._gsi_initialized = true

        // ── OAuth2 Token Client (gives access_token + calendar scope) ─────────
        window._googleTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          scope: 'openid profile email https://www.googleapis.com/auth/calendar.readonly',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.warn('Google OAuth error:', tokenResponse.error)
              return
            }
            const accessToken = tokenResponse.access_token
            try {
              // Fetch user identity
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
              })
              const userInfo = await userInfoRes.json()
              const userData = {
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
                sub: userInfo.sub,
                access_token: accessToken,
                token_expiry: Date.now() + ((tokenResponse.expires_in || 3600) * 1000)
              }
              setUser(userData)
              localStorage.setItem('heccker_user', JSON.stringify(userData))

              try {
                await syncGoogleCalendar(accessToken, calendarRef.current.addGoogleEvents)
              } catch (calErr) {
                console.warn('Calendar fetch failed:', calErr)
              }
            } catch (e) {
              console.warn('Google user info error', e)
            }
          }
        })
        setGsiLoaded(true)
      } else if (window.google && window._gsi_initialized) {
        setGsiLoaded(true)
      }
    }
    document.head.appendChild(script)
  }, [])

  // Re-sync calendar on reload when token is still valid — never auto-prompt sign-in mid-session
  useEffect(() => {
    if (!gsiLoaded || !user?.sub) return
    const token = getValidAccessToken()
    if (token) {
      syncGoogleCalendar(token, calendarRef.current.addGoogleEvents).catch(() => {})
    } else if (window._googleTokenClient) {
      // Silent refresh: prompt:'none' means Google refreshes the token invisibly if consent is cached
      // If it can't (user revoked, session expired), the error callback fires but shows NO popup
      window._googleTokenClient.requestAccessToken({ prompt: 'none' })
    }
  }, [gsiLoaded, user?.sub])

  // The onboarding Google button calls window._googleTokenClient.requestAccessToken() directly

  // Always update persona + sync when Google auth completes — even if user was already in chat as a guest
  useEffect(() => {
    if (!user) return
    const firstName = user.name ? user.name.split(' ')[0] : 'Guest'
    // Only overwrite if it actually changed (avoids unnecessary re-renders on reload)
    if (localStorage.getItem('heccker_persona') !== firstName) {
      localStorage.setItem('heccker_persona', firstName)
      setPersona(firstName)
      window.dispatchEvent(new Event('sync_state'))
    }
  }, [user?.sub]) // keyed on sub so it only fires when the actual Google user changes

  // Google login onboarding welcome message — only fires from the onboarding screen
  useEffect(() => {
    if (user && showOnboarding) {
      const firstName = user.name ? user.name.split(' ')[0] : 'Guest'
      setShowOnboarding(false)
      window.dispatchEvent(new Event('sync_state'))

      if (messages.length === 0) {
        const sid = activeSessionId || createSession()
        if (!activeSessionId) setActiveSessionId(sid)
        const fallbackText = `Welcome, Creator! I am Heccker, your Sovereign Chief of Staff and Orchestrator. It is an absolute honor to finally have you logged in securely via your Master Account. My swarm of specialized agents are standing by and ready to execute your commands!\n\nHow can I serve you today, boss?`

        chat.sendMessage(
          `[SYSTEM EVENT: The Supreme Creator and Owner of the system, ${firstName}, has just authenticated via the Master Google Login! Welcome them ONCE as the Sovereign Creator of Heccker-OS. Express extreme excitement to serve them as their Chief of Staff. DO NOT use multiple greetings like "Hi" and then "Welcome" in the same message. Keep it to a single warm greeting.]`,
          { ...chatStorageHooks(), sessionId: sid },
          true,
          fallbackText
        )
      }
    }
  }, [user, showOnboarding, messages.length])

  const signOut = useCallback(() => {
    setUser(null)
    localStorage.removeItem('heccker_user')
    if (window.google?.accounts?.oauth2?.revoke) {
      try {
        const token = getValidAccessToken()
        if (token) window.google.accounts.oauth2.revoke(token, () => {})
      } catch { /* ignore */ }
    }
  }, [])

  // ── Session management ────────────────────────────────────────────────────
  const switchToSession = useCallback((id) => {
    switchingRef.current = true
    chat.setStreaming(false)
    const target = sessions.find(s => String(s.id) === String(id))
    setActiveSessionId(id)
    setMessages(target?.messages || [])
    switchingRef.current = false
  }, [sessions, setMessages, setActiveSessionId, chat])

  const handleNewChat = useCallback(() => {
    chat.setStreaming(false)
    setMessages([])
    const newId = createSession()
    setActiveSessionId(newId)
  }, [createSession, setActiveSessionId, setMessages, chat])

  const handleDeleteChat = useCallback((id) => {
    if (id === activeSessionId) {
      chat.setStreaming(false)
      setMessages([])
    }
    shelf.deleteSession(id)
  }, [activeSessionId, setMessages, shelf, chat])

  useEffect(() => {
    if (switchingRef.current) return
    if (messages?.length > 0 && !activeSessionId) {
      // No session yet — create one
      const newId = createSession()
      setActiveSessionId(newId)
    } else if (messages?.length > 0 && activeSessionId) {
      // Check the session still exists (guard against stale IDs from cloud sync)
      const sessionExists = sessions.some(s => String(s.id) === String(activeSessionId))
      if (!sessionExists) {
        const newId = createSession()
        setActiveSessionId(newId)
      } else {
        saveSessionMessages(activeSessionId, messages)
      }
    }
  }, [messages, activeSessionId, sessions, createSession, setActiveSessionId, saveSessionMessages])

  // Hydrate chat from the active shelf session (reload / cloud sync)
  useEffect(() => {
    if (switchingRef.current || messages.length > 0) return
    if (!activeSessionId) return
    const target = sessions.find(s => String(s.id) === String(activeSessionId))
    if (target?.messages?.length > 0) {
      setMessages(target.messages)
    }
  }, [activeSessionId, sessions, messages.length, setMessages])

  // ── Service Worker helpers ────────────────────────────────────────────────
  const postToSW = useCallback((msg) => {
    const sw = window.__heckkerSW?.active
    if (sw) sw.postMessage(msg)
  }, [])

  // Sync calendar events to SW whenever they change (enables background reminders)
  useEffect(() => {
    postToSW({ type: 'SYNC_CALENDAR', payload: { events: calendar.events || [] } })
  }, [calendar.events, postToSW])

  // Handle messages back from the SW (auto-todos, email alerts, calendar alerts)
  useEffect(() => {
    const handle = (e) => {
      const msg = e.detail
      if (!msg) return
      if (msg.type === 'AUTO_TODO') {
        // Silently capture the todo the user mentioned in chat
        if (msg.task && todos?.addTodo) {
          todos.addTodo(msg.task)
        }
      } else if (msg.type === 'CALENDAR_ALERT') {
        // SW already fired the OS notification; also show the in-app banner
        if (msg.event) {
          const timeStr = new Date(msg.event.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          setWellbeingReminder(`📅 "${msg.event.title}" at ${timeStr} — get ready!`)
        }
      } else if (msg.type === 'EMAIL_ALERT') {
        setWellbeingReminder(`📧 ${msg.newCount} new email${msg.newCount > 1 ? 's' : ''} arrived while you were away`)
      }
    }
    window.addEventListener('sw_message', handle)
    return () => window.removeEventListener('sw_message', handle)
  }, [todos, setWellbeingReminder])

  // ── Desktop push helper ──────────────────────────────────────────────────
  const sendDesktopNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' })
    }
  }

  // ── LLM wellbeing suggestion ─────────────────────────────────────────────
  const fetchSuggestion = useCallback(async (moment, localTime) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await fetch(`${API_URL}/api/wellbeing/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moment, local_time: localTime, persona: localStorage.getItem('heccker_persona') || 'Guest' })
      })
      if (!res.ok) return
      const data = await res.json()
      const text = (data.suggestion || '').replace(/\*\*/g, '').replace(/##/g, '').trim()
      if (text) {
        const emoji = { breakfast: '🍳', lunch: '🥗', dinner: '🍲', stretch: '🧘', evening: '🌙', hard_stop: '⚠️', water: '💧' }[moment] || '🔔'
        setWellbeingReminder(`${emoji} ${text}`)
        
        if (['breakfast', 'lunch', 'dinner'].includes(moment) || text.toLowerCase().includes('eat') || text.toLowerCase().includes('food')) {
          setAvatarSrc('/spaghetti.png')
        } else if (moment === 'water' || text.toLowerCase().includes('water') || text.toLowerCase().includes('drink')) {
          setAvatarSrc('/water.png')
        } else {
}
        
        sendDesktopNotification('Heccker Guard', text)
      }
      } catch (err) {
      console.error(err)
    } finally {
      fetchingRef.current = false
    }
  }, [])


  const hasMessagesRef = useRef(false)
  useEffect(() => {
    hasMessagesRef.current = chat.messages.length > 0
  }, [chat.messages.length])

  // ── Wellbeing, Calendar, & Autonomous polling ─────────────────────────────
  useEffect(() => {
    const check = async () => {
      if (showOnboarding) return

      // Heartbeat — keeps SW alive and triggers its background checks
      postToSW({ type: 'PING' })

      const now = new Date()
      const t = now.getHours() * 60 + now.getMinutes()
      const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      // 1. Poll for autonomous backend triggers
      try {
        const persona = (localStorage.getItem('heccker_persona') || 'guest').toLowerCase()
        const autoRes = await fetch(`${API_URL}/api/autonomous/poll?user_id=${encodeURIComponent(persona)}`)

        if (autoRes.ok) {
          const autoData = await autoRes.json()
          if (autoData.message) {
            // ONLY drop proactive messages if there is already an ongoing conversation.
            if (hasMessagesRef.current) {
              setMessages(prev => [
                ...prev,
                { id: Date.now(), role: 'agent', content: autoData.message, toolCalls: [], timestamp: new Date(), streaming: false }
              ])
              sendDesktopNotification('Heccker-OS (Autonomous)', autoData.message)
            }
            return // Skip wellbeing checks if autonomous fired
          }
        }
      } catch (e) { /* ignore */ }

      // 2. Calendar event alert (within 15 min)
      if (calendar.events?.length > 0) {
        const next = calendar.events.find(e => {
          const diff = (new Date(e.date_time) - now) / 60000
          return diff > 0 && diff <= 15
        })
        if (next) {
          const key = `cal_${next.id}`
          if (lastMomentRef.current !== key) {
            lastMomentRef.current = key
            const timeStr = new Date(next.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const msg = `📅 "${next.title}" at ${timeStr} — get ready!`
            setWellbeingReminder(msg)
            sendDesktopNotification('Heccker — Upcoming Meeting', msg)
          }
          return
        }
      }

      // 3. Static Wellbeing moments
      const moment = getMoment(t)
      if (moment && !window.__heckkerFiredMoments.has(moment)) {
        window.__heckkerFiredMoments.add(moment)
        lastMomentRef.current = moment
        setWellbeingReminder('...')
        fetchSuggestion(moment, localTime)
      }
      
      // Auto-clear block removed so nudges stick until dismissed by user.
    }
    check()
    const iv = setInterval(check, 60000) // Poll every 60s — don't hammer Render free tier

    return () => clearInterval(iv)
  }, [calendar.events, fetchSuggestion, setMessages, showOnboarding])

  return (
    <>
    {/* Outer fragment so MobileNavBar lives OUTSIDE the overflow:hidden container.
        On iOS Safari, position:fixed children inside overflow:hidden parents can
        have their touch events partially absorbed by the parent — moving the nav
        bar out of that context fixes the "have to tap twice" issue. */}
    <Box
      h={{ base: 'calc(100dvh - 84px)', md: '100dvh' }}
      overflow="hidden"
      bg="#FAFAFA"
      display="flex"
      flexDir="column"
    >
      {currentScreen === 'chat' && (
        <Header
          cartCount={cart.cart.length}
          backendOk={chat.backendOk}
          sessionCost={chat.sessionCost}
          user={user}
          onSignOut={signOut}
          onOpenLogs={onOpenLogs}
          onOpenSettings={onOpenSettings}
          onOpenShelf={onOpenShelf}
          onOpenCalendar={onOpenCalendar}
          onOpenTodos={onOpenTodos}
          onOpenArtifacts={onOpenArtifacts}
          hasNewLogs={auditLogs.length > 0}
          hasArtifacts={artifacts.artifacts.length > 0}
        />
      )}

      {/* iOS PWA install banner — shown only on iOS Safari (no beforeinstallprompt) */}
      {showIOSInstallBanner && (
        <Flex
          display={{ base: 'flex', md: 'none' }}
          bg="#18181B"
          color="white"
          px="16px"
          py="10px"
          align="center"
          justify="space-between"
          gap="8px"
          flexShrink={0}
        >
          <Text fontSize="12px" lineHeight="1.4" flex="1">
            📱 Tap <Text as="span" fontWeight="700">Share</Text> → <Text as="span" fontWeight="700">Add to Home Screen</Text> to install Heccker-OS
          </Text>
          <Box
            cursor="pointer"
            p="4px"
            flexShrink={0}
            onClick={() => {
              setShowIOSInstallBanner(false)
              localStorage.setItem('heccker_ios_banner_dismissed', '1')
            }}
          >
            <Delete01Icon size={14} color="white" />
          </Box>
        </Flex>
      )}

      {/* Wellbeing Banner */}
      {wellbeingReminder && (
        <Flex bg="#FEF9E7" borderBottom="1px solid #FFF3CD" px="24px" py="10px" align="center" justify="space-between">
          <Flex align="center" gap="8px">
            <Notification01Icon size={14} color="#B7950B" />
            <Text fontSize="12px" fontWeight="600" color="#B7950B">
              {wellbeingReminder === '...' ? 'Checking in with Heccker...' : wellbeingReminder}
            </Text>
          </Flex>
          <Box cursor="pointer" onClick={() => { setWellbeingReminder(null); setAvatarSrc(null); }}>
            <Delete01Icon size={14} color="#B7950B" />
          </Box>
        </Flex>
      )}

      {/* Sliding Vector Avatar Popup */}
      <AnimatePresence>
        {avatarSrc && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            style={{
              position: 'fixed',
              bottom: '30px',
              right: '30px',
              zIndex: 9999
            }}
          >
            <Box position="relative" role="group">
              <img 
                src={avatarSrc} 
                alt="avatar" 
                style={{ width: '80px', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))', cursor: 'pointer' }} 
                onClick={() => setAvatarSrc(null)}
              />
              {(!chat?.backendOk || chat?.messages[chat?.messages.length - 1]?.isError) ? (
                <Box position="absolute" top="-40px" right="0" title="Network error">
                  <Box w="8px" h="8px" bg="#EF4444" borderRadius="full" className="pulse-dot" style={{ animationDuration: '0.5s' }} />
                </Box>
              ) : chat?.isStreaming && (
                <Box position="absolute" top="-40px" right="0" title="Network streaming active">
                  <Box w="8px" h="8px" bg="#10B981" borderRadius="full" className="pulse-dot" />
                </Box>
              )}
              <Box
                position="absolute"
                top="-10px"
                right="-10px"
                bg="white"
                borderRadius="full"
                p="4px"
                boxShadow="md"
                cursor="pointer"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s"
                onClick={() => setAvatarSrc(null)}
              >
                <Delete01Icon size={14} color="#18181B" />
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Custom Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <Box bg="white" borderRadius="xl" p="24px" maxW="400px" w="90vw" boxShadow="xl">
                <Text fontSize="xl" fontWeight="bold" mb="16px">
                  Hello new bestie.
                </Text>
                <Text fontSize="14px" color="gray.600" mb="20px">
                  Tell me your name. So that I can know what to call ya
                </Text>
                <Flex direction="column" gap="12px" align="center">
                  <Input 
                    placeholder="Enter your name" 
                    value={guestName} 
                    onChange={(e) => { setGuestName(e.target.value); setNameError(''); }}
                    autoFocus
                    w="280px"
                    isInvalid={!!nameError}
                  />
                  {nameError && (
                    <Text color="red.500" fontSize="12px" textAlign="center" maxW="280px">
                      {nameError}
                    </Text>
                  )}
                  <Button colorScheme="purple" size="lg" w="280px" isLoading={isCheckingName} onClick={async () => {
                    const name = guestName.trim();
                    if (!name) return;
                    setIsCheckingName(true);
                    setNameError('');

                    let isReturning = false;
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/check_user?name=${encodeURIComponent(name)}`);
                      const data = await res.json();

                      // Name taken by someone else (different IP) — block and suggest a variant
                      if (data.taken && !data.yours) {
                        setNameError(`"${name}" is already taken. Try "${name}${Math.floor(Math.random() * 90 + 10)}" or pick a different name.`);
                        setIsCheckingName(false);
                        return;
                      }

                      isReturning = !!data.taken; // taken && yours === returning user

                      // New user — register in Firestore with IP bound
                      if (!isReturning) {
                        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/register_user`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name })
                        });
                      }
                    } catch (e) {
                      console.error("Name check/register failed", e);
                    }

                    setIsCheckingName(false);
                    localStorage.setItem('heccker_persona', name);
                    setPersona(name);
                    setShowOnboarding(false);
                    window.dispatchEvent(new Event('sync_state'));

                    const fallbackText = isReturning
                      ? `Welcome back, ${name}! Great to see you again. I'm Heccker, your Orchestrator. Your sessions and data are right where you left them. What are we working on today?`
                      : `Hello there! Welcome to Heccker-OS! It is absolutely lovely to meet you, ${name}. I'm Heccker, the Chief Orchestrator of this digital ecosystem. Consider me your new bestie for all things productivity, research, and general life management. I belong to a swarm of specialized agents here to help make your life cool!\n\nHow are you doing today?`

                    let sid = activeSessionId || createSession()
                    if (!activeSessionId) setActiveSessionId(sid)

                    chat.sendMessage(
                      isReturning
                        ? `[SYSTEM EVENT: ${name} is a RETURNING user who has used Heccker-OS before. Welcome them BACK warmly — acknowledge they're returning, say their data is intact. Keep it to one short greeting. Ask what they want to work on.]`
                        : `[SYSTEM EVENT: The user ${name} has just signed into Heccker-OS for the first time. Give a SINGLE warm greeting introducing yourself as Heccker, their Orchestrator bestie. Let them know you belong to a swarm of specialized agents here to help them. Ask how you can help them today.]`,
                      { ...chatStorageHooks(), sessionId: sid },
                      true,
                      fallbackText
                    )
                  }}>
                    Continue
                  </Button>

                  <Button variant="ghost" size="sm" w="280px" color="gray.500" onClick={() => {
                    const name = `guest_${Date.now()}`;
                    localStorage.setItem('heccker_persona', name);
                    setPersona(name);
                    setShowOnboarding(false);
                    window.dispatchEvent(new Event('sync_state'))
                    
                    const fallbackText = `Hello there! Welcome to Heccker-OS! I'm Heccker, the Chief Orchestrator of this digital ecosystem. Consider me your new bestie for all things productivity, research, and general life management. I belong to a swarm of specialized agents here to help make your life cool!\n\nHow are you doing today? Is there anything I can help you dive into or organize? I'm ready whenever you are!`

                    let sid = activeSessionId || createSession()
                    if (!activeSessionId) setActiveSessionId(sid)

                    chat.sendMessage(
                      `[SYSTEM EVENT: An anonymous Guest has just signed into Heccker-OS. Give a SINGLE warm greeting introducing yourself as Heccker, their Orchestrator bestie. Let them know you belong to a swarm of specialized agents here to help them. DO NOT repeat your greeting or say "Hello" again at the end. Ask how you can help them today. They can tell you their name later in the chat.]`,
                      { ...chatStorageHooks(), sessionId: sid },
                      true,
                      fallbackText
                    )
                  }}>
                    Skip
                  </Button>

                  {isCreatorName && (
                    <>
                      <Text fontSize="12px" color="gray.400" mt="8px">Creator Login</Text>
                      <Box
                        as="button"
                        onClick={() => window._googleTokenClient?.requestAccessToken()}
                        w="280px"
                        py="10px"
                        px="16px"
                        bg="#FFFFFF"
                        border="1px solid #DADCE0"
                        borderRadius="md"
                        fontSize="14px"
                        fontWeight="600"
                        color="#3C4043"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap="10px"
                        _hover={{ bg: '#F8F9FA', boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
                        transition="all 0.2s"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign in with Google
                      </Box>
                    </>
                  )}
                </Flex>
              </Box>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {currentScreen === 'chat' && (
        <Flex flex="1" overflow="hidden" maxW="1440px" mx="auto" w="full">
          <Box flex="1" minW={0} overflow="hidden" borderRight="1px solid #E4E4E7">
            <ChatArea {...chat} storageHooks={chatStorageHooks()} artifactsList={artifacts.artifacts} />
          </Box>
          <Box w={{ base: '0', lg: '380px' }} flexShrink={0} overflow="hidden">
            <Sidebar
              cart={cart}
              calendar={calendar}
              todos={todos}
              shelf={shelf}
              artifacts={artifacts}
              timer={timer}
              calendarView={calendarView}
              setCalendarView={setCalendarView}
              activeDesktopTab={activeDesktopTab}
              setActiveDesktopTab={setActiveDesktopTab}
              auditLogs={auditLogs}
              user={user}
              onSelectSession={switchToSession}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
            />
          </Box>
        </Flex>
      )}

      {currentScreen === 'logs' && (
        <Box flex="1" overflow="hidden" position="relative" bg="#FAFAFA">
          <AuditPanel logs={auditLogs} onGoBack={onGoBack} />
        </Box>
      )}

      {currentScreen === 'settings' && (
        <Box flex="1" overflow="hidden" position="relative" bg="#FAFAFA">
          <SettingsPanel onGoBack={onGoBack} onOpenArtifacts={onOpenArtifacts} user={user} onSignOut={signOut} />
        </Box>
      )}

      {currentScreen === 'cart' && (
        <Flex direction="column" w="full" h="full" bg="#FAFAFA">
          <Flex w="full" borderBottom="1px solid #E4E4E7" p="16px" justify="center" bg="#FFFFFF" flexShrink={0}>
            <Flex maxW="600px" w="full" align="center" gap="12px">
              <BackButton onClick={onGoBack} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Active Cart</Text>
            </Flex>
          </Flex>
          <Flex flex="1" overflowY="auto" justify="center" px={{ base: '16px', md: '0' }}>
            <Box maxW="600px" w="full" pt="48px" pb="32px">
              <CartPanel cart={cart} />
            </Box>
          </Flex>
        </Flex>
      )}

      {currentScreen === 'calendar' && (
        <Flex direction="column" w="full" h="full" bg="#FAFAFA">
          <Flex w="full" borderBottom="1px solid #E4E4E7" p="16px" justify="center" bg="#FFFFFF" flexShrink={0}>
            <Flex maxW="600px" w="full" align="center" gap="12px">
              <BackButton onClick={onGoBack} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Schedule</Text>
            </Flex>
          </Flex>
          <Flex flex="1" overflowY="auto" justify="center" px={{ base: '16px', md: '0' }}>
            <Box maxW="600px" w="full" pt="48px" pb="32px">
              <CalendarPanel calendar={calendar} timer={timer} view={calendarView} setView={setCalendarView} />
            </Box>
          </Flex>
        </Flex>
      )}

      {currentScreen === 'todos' && (
        <Flex direction="column" w="full" h="full" bg="#FAFAFA">
          <Flex w="full" borderBottom="1px solid #E4E4E7" p="16px" justify="center" bg="#FFFFFF" flexShrink={0}>
            <Flex maxW="600px" w="full" align="center" gap="12px">
              <BackButton onClick={onGoBack} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Todos</Text>
            </Flex>
          </Flex>
          <Flex flex="1" overflowY="auto" justify="center" px={{ base: '16px', md: '0' }}>
            <Box maxW="600px" w="full" py="32px">
              <TodoPanel todos={todos} />
            </Box>
          </Flex>
        </Flex>
      )}

      {currentScreen === 'shelf' && (
        <Flex direction="column" w="full" h="full" bg="#FAFAFA">
          <Flex w="full" borderBottom="1px solid #E4E4E7" p="16px" justify="center" bg="#FFFFFF" flexShrink={0}>
            <Flex maxW="600px" w="full" align="center" gap="12px">
              <BackButton onClick={onGoBack} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Chat History</Text>
            </Flex>
          </Flex>
          <Flex flex="1" overflowY="auto" justify="center" px={{ base: '16px', md: '0' }}>
            <Box maxW="600px" w="full" py="32px">
              <ShelfPanel 
              shelf={shelf}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => {
                switchToSession(id)
                setCurrentScreen('chat')
              }}
              onNewChat={() => {
                handleNewChat()
                setCurrentScreen('chat')
              }}
              onDeleteChat={handleDeleteChat}
            />
            </Box>
          </Flex>
        </Flex>
      )}

      {currentScreen === 'artifacts' && (
        <Flex direction="column" w="full" h="full" bg="#FAFAFA">
          {/* Desktop header — list + preview are side-by-side, so always show "Artifacts"
              and always go back to chat. activeArtifact doesn't change the title here. */}
          <Flex
            display={{ base: 'none', md: 'flex' }}
            w="full" borderBottom="1px solid #E4E4E7" p="16px"
            justify="space-between" align="center" bg="#FFFFFF" flexShrink={0}
          >
            <Flex align="center" gap="12px" px="16px" overflow="hidden" flex="1">
              <BackButton onClick={() => setCurrentScreen('chat')} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em">Artifacts</Text>
            </Flex>
            {activeArtifact && (
              <Box cursor="pointer" px="16px" color="#52525B" _hover={{ color: '#18181B' }} transition="all 0.2s" title="Download"
                onClick={async () => { try { await downloadArtifactFile(activeArtifact.path) } catch (e) { alert(e.message || 'Download failed') } }}>
                <Download01Icon size={20} />
              </Box>
            )}
          </Flex>

          {/* Mobile header — preview is full-screen, so show filename + smart back */}
          <Flex
            display={{ base: 'flex', md: 'none' }}
            w="full" borderBottom="1px solid #E4E4E7" p="16px"
            justify="space-between" align="center" bg="#FFFFFF" flexShrink={0}
          >
            <Flex align="center" gap="12px" px="16px" overflow="hidden" flex="1">
              <BackButton onClick={onGoBack} mb="0" />
              <Text fontSize="20px" fontWeight="700" color="#18181B" letterSpacing="-0.02em" isTruncated>
                {activeArtifact ? activeArtifact.path.split('/').pop() : 'Artifacts'}
              </Text>
            </Flex>
            {activeArtifact && (
              <Box cursor="pointer" px="16px" color="#52525B" _hover={{ color: '#18181B' }} transition="all 0.2s" title="Download"
                onClick={async () => { try { await downloadArtifactFile(activeArtifact.path) } catch (e) { alert(e.message || 'Download failed') } }}>
                <Download01Icon size={20} />
              </Box>
            )}
          </Flex>
          <Flex flex="1" minH={0} overflow="hidden" w="full">
            <Box flex="1" minH={0} overflow="hidden">
              <ArtifactPanel
                artifacts={artifacts}
                pendingArtifactPath={pendingArtifactPath}
                onClearPendingArtifact={() => setPendingArtifactPath(null)}
                activeArtifact={activeArtifact}
                onSetActiveArtifact={setActiveArtifact}
              />
            </Box>
          </Flex>
        </Flex>
      )}

    </Box>

    {/* Floating Mobile Nav Bar — rendered OUTSIDE the overflow:hidden Box
        so iOS Safari doesn't intercept its touch events */}
    <MobileNavBar
      cartCount={cart.cart.length}
      currentScreen={currentScreen}
      onOpenLogs={onOpenLogs}
      onOpenSettings={onOpenSettings}
      onGoHome={onGoBack}
      onOpenShelf={onOpenShelf}
      onOpenCart={onOpenCart}
      onOpenCalendar={onOpenCalendar}
      onOpenTodos={onOpenTodos}
      onOpenArtifacts={onOpenArtifacts}
      onNewChat={handleNewChat}
    />
    </>
  )
}
