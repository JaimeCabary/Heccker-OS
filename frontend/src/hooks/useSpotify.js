// hooks/useSpotify.js
// Full Spotify PKCE OAuth + Web Playback SDK integration

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''
const REDIRECT_URI = window.location.origin
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// ── PKCE helpers ─────────────────────────────────────────────────────────────
function generateCodeVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => chars[b % chars.length]).join('')
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function startSpotifyLogin() {
  if (!CLIENT_ID) { alert('Spotify Client ID not configured.'); return }
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  localStorage.setItem('spotify_code_verifier', verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

export async function handleSpotifyCallback(code) {
  const verifier = localStorage.getItem('spotify_code_verifier')
  if (!verifier) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  const data = await res.json()
  if (data.access_token) {
    const expiry = Date.now() + data.expires_in * 1000
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_refresh_token', data.refresh_token || '')
    localStorage.setItem('spotify_token_expiry', String(expiry))
    localStorage.removeItem('spotify_code_verifier')
    return data.access_token
  }
  return null
}

export async function getSpotifyToken() {
  const token = localStorage.getItem('spotify_access_token')
  const expiry = Number(localStorage.getItem('spotify_token_expiry') || 0)
  if (token && Date.now() < expiry - 60000) return token
  // Refresh
  const refreshToken = localStorage.getItem('spotify_refresh_token')
  if (!refreshToken) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const data = await res.json()
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_token_expiry', String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token)
    return data.access_token
  }
  localStorage.removeItem('spotify_access_token')
  return null
}

export function isSpotifyConnected() {
  return !!localStorage.getItem('spotify_access_token')
}

export function disconnectSpotify() {
  localStorage.removeItem('spotify_access_token')
  localStorage.removeItem('spotify_refresh_token')
  localStorage.removeItem('spotify_token_expiry')
  localStorage.removeItem('spotify_code_verifier')
  window.dispatchEvent(new Event('spotify_state_change'))
}

// ── Spotify API helpers ───────────────────────────────────────────────────────
export async function searchSpotifyTrack(query) {
  const token = await getSpotifyToken()
  if (!token) return null
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  const track = data?.tracks?.items?.[0]
  if (!track) return null
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    image: track.album.images?.[0]?.url,
    type: 'track',
  }
}

export async function playSpotifyTrack(uri, deviceId) {
  const token = await getSpotifyToken()
  if (!token || !deviceId) return false
  await fetch(
    `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    }
  )
  return true
}

// ── Web Playback SDK loader ───────────────────────────────────────────────────
let playerInstance = null
let playerDeviceId = null

export function getSpotifyPlayer() { return playerInstance }
export function getSpotifyDeviceId() { return playerDeviceId }

export async function initSpotifyPlayer(onReady, onStateChange) {
  const token = await getSpotifyToken()
  if (!token) return

  if (playerInstance) { onReady?.(playerDeviceId); return }

  if (!window.Spotify) {
    await new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      window.onSpotifyWebPlaybackSDKReady = resolve
      document.head.appendChild(script)
    })
  }

  const player = new window.Spotify.Player({
    name: 'Heccker OS',
    getOAuthToken: async (cb) => { cb(await getSpotifyToken()) },
    volume: 0.7,
  })

  player.addListener('ready', ({ device_id }) => {
    playerDeviceId = device_id
    localStorage.setItem('spotify_device_id', device_id)
    onReady?.(device_id)
    window.dispatchEvent(new CustomEvent('spotify_ready', { detail: device_id }))
  })

  player.addListener('player_state_changed', (state) => {
    onStateChange?.(state)
    window.dispatchEvent(new CustomEvent('spotify_state', { detail: state }))
  })

  player.addListener('not_ready', () => { playerDeviceId = null })
  player.addListener('initialization_error', ({ message }) => console.error('Spotify init error:', message))
  player.addListener('authentication_error', ({ message }) => console.error('Spotify auth error:', message))
  player.addListener('account_error', ({ message }) => console.error('Spotify account error (need Premium):', message))

  await player.connect()
  playerInstance = player
}
