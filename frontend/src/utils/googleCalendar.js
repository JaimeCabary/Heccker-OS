/** Fetch upcoming Google Calendar events and map to Heccker format. */
export async function fetchGoogleCalendarEvents(accessToken) {
  const now = new Date().toISOString()
  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&maxResults=30&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!calRes.ok) throw new Error(`Calendar API ${calRes.status}`)
  const calData = await calRes.json()
  return (calData.items || []).map(item => ({
    id: item.id,
    title: item.summary || 'Untitled Event',
    date_time: item.start?.dateTime || item.start?.date || '',
    link: item.htmlLink || '',
    meet_link: item.hangoutLink || ''
  }))
}

export async function syncGoogleCalendar(accessToken, addGoogleEvents) {
  const events = await fetchGoogleCalendarEvents(accessToken)
  if (events.length > 0 && addGoogleEvents) addGoogleEvents(events)
  return events
}

/** Return a valid access token from localStorage, or null if missing/expired. */
export function getValidAccessToken() {
  try {
    const user = JSON.parse(localStorage.getItem('heccker_user') || 'null')
    if (!user?.access_token) return null
    if (user.token_expiry && Date.now() >= user.token_expiry - 60_000) return null
    return user.access_token
  } catch {
    return null
  }
}
