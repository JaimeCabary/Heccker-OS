// utils/launchApp.js
// Launches native apps via URL schemes on Android, iOS, and desktop.
// Falls back to the web URL if the scheme fails or the app isn't installed.

const APP_SCHEMES = {
  spotify:     { scheme: 'spotify:',                 web: 'https://open.spotify.com' },
  youtube:     { scheme: 'youtube://',               web: 'https://youtube.com' },
  maps:        { scheme: 'maps://',                  web: 'https://maps.google.com' },
  googlemaps:  { scheme: 'comgooglemaps://',         web: 'https://maps.google.com' },
  whatsapp:    { scheme: 'whatsapp://',              web: 'https://web.whatsapp.com' },
  instagram:   { scheme: 'instagram://',             web: 'https://instagram.com' },
  twitter:     { scheme: 'twitter://',               web: 'https://x.com' },
  x:           { scheme: 'twitter://',               web: 'https://x.com' },
  tiktok:      { scheme: 'tiktok://',               web: 'https://tiktok.com' },
  reddit:      { scheme: 'reddit://',               web: 'https://reddit.com' },
  notion:      { scheme: 'notion://',               web: 'https://notion.so' },
  slack:       { scheme: 'slack://',                web: 'https://slack.com' },
  discord:     { scheme: 'discord://',              web: 'https://discord.com/app' },
  zoom:        { scheme: 'zoommtg://',              web: 'https://zoom.us' },
  gmail:       { scheme: 'googlegmail://',          web: 'https://mail.google.com' },
  calendar:    { scheme: 'webcal://',               web: 'https://calendar.google.com' },
  netflix:     { scheme: 'nflx://',                web: 'https://netflix.com' },
  github:      { scheme: 'github://',              web: 'https://github.com' },
  figma:       { scheme: 'figma://',               web: 'https://figma.com' },
  vscode:      { scheme: 'vscode://',              web: 'https://vscode.dev' },
  telegram:    { scheme: 'tg://',                  web: 'https://web.telegram.org' },
  linkedin:    { scheme: 'linkedin://',            web: 'https://linkedin.com' },
  facetime:    { scheme: 'facetime://',            web: null },
  phone:       { scheme: 'tel:',                   web: null },
  sms:         { scheme: 'sms:',                   web: null },
  settings:    { scheme: 'ms-settings:',           web: null },
  files:       { scheme: 'files-app://',           web: null },
}

/**
 * Launch a native app by name or URL scheme.
 * Falls back to web URL after 800ms if scheme doesn't open the app.
 *
 * @param {string} appName - e.g. 'spotify', 'youtube', or a full URL
 * @returns {{ launched: boolean, method: string, url: string }}
 */
export function launchApp(appName) {
  const key = appName.toLowerCase().trim()

  // If it's already a URL, just open it
  if (key.startsWith('http://') || key.startsWith('https://')) {
    window.open(appName, '_blank', 'noopener')
    return { launched: true, method: 'web', url: appName }
  }

  // If it's already a scheme (e.g. 'spotify:search:...')
  if (key.includes('://') || key.endsWith(':')) {
    _tryScheme(appName, null)
    return { launched: true, method: 'scheme', url: appName }
  }

  const match = APP_SCHEMES[key]
  if (!match) {
    // Unknown app — try web search
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(appName)}`
    window.open(searchUrl, '_blank', 'noopener')
    return { launched: false, method: 'search_fallback', url: searchUrl }
  }

  _tryScheme(match.scheme, match.web)
  return { launched: true, method: 'scheme', url: match.scheme }
}

function _tryScheme(scheme, webFallback) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  document.body.appendChild(iframe)

  const start = Date.now()

  try {
    iframe.src = scheme
  } catch {
    // scheme failed immediately
  }

  if (webFallback) {
    setTimeout(() => {
      document.body.removeChild(iframe)
      // If page hasn't blurred (app didn't open), fall back to web
      if (Date.now() - start < 1500 && document.hasFocus()) {
        window.open(webFallback, '_blank', 'noopener')
      }
    }, 800)
  } else {
    setTimeout(() => {
      try { document.body.removeChild(iframe) } catch {}
    }, 1000)
  }
}

export function getAppDisplayName(appName) {
  const names = {
    spotify: 'Spotify', youtube: 'YouTube', maps: 'Google Maps',
    whatsapp: 'WhatsApp', instagram: 'Instagram', twitter: 'X (Twitter)',
    tiktok: 'TikTok', reddit: 'Reddit', notion: 'Notion', slack: 'Slack',
    discord: 'Discord', zoom: 'Zoom', gmail: 'Gmail', netflix: 'Netflix',
    github: 'GitHub', figma: 'Figma', vscode: 'VS Code', telegram: 'Telegram',
    linkedin: 'LinkedIn',
  }
  return names[appName.toLowerCase()] || appName
}
