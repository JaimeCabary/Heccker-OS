import os
import datetime
from app.storage import load_json

def fetch_all_events(access_token=None, uid: str = "guest") -> list:
    """
    Fetches events from Heccker's local/Firebase storage and merges them with
    the user's real Google Calendar events (if an access_token is provided).
    """
    # 1. Load Heccker's native events (user-scoped path)
    heccker_events = load_json("heccker_state", f"{uid}_heccker_calendar", "", [])
    
    events_map = {}
    for ev in heccker_events:
        if "id" in ev and "date_time" in ev:
            events_map[ev["id"]] = ev

    # 2. Fetch live Google Calendar events if access_token provided (from frontend OAuth2)
    if access_token:
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            creds = Credentials(token=access_token)
            service = build('calendar', 'v3', credentials=creds)
            
            now = datetime.datetime.utcnow().isoformat() + 'Z'
            events_result = service.events().list(
                calendarId='primary', timeMin=now,
                maxResults=30, singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            for item in events_result.get('items', []):
                start = item['start'].get('dateTime', item['start'].get('date'))
                formatted_event = {
                    "id": item['id'],
                    "title": item.get('summary', 'Untitled Event'),
                    "date_time": start,
                    "link": item.get('htmlLink', ''),
                    "meet_link": item.get('hangoutLink', '')
                }
                events_map[formatted_event["id"]] = formatted_event
                
        except Exception as e:
            print(f"Failed to fetch Google Calendar events: {e}")

    # 3. Fall back to token.json if no access_token but WORKSPACE_CONNECT is set
    elif os.environ.get("WORKSPACE_CONNECT") == "True" and os.path.exists('token.json'):
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            SCOPES = ['https://www.googleapis.com/auth/calendar.events']
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
            
            if creds and creds.valid:
                service = build('calendar', 'v3', credentials=creds)
                now = datetime.datetime.utcnow().isoformat() + 'Z'
                events_result = service.events().list(
                    calendarId='primary', timeMin=now,
                    maxResults=20, singleEvents=True,
                    orderBy='startTime'
                ).execute()
                for item in events_result.get('items', []):
                    start = item['start'].get('dateTime', item['start'].get('date'))
                    formatted_event = {
                        "id": item['id'],
                        "title": item.get('summary', 'Untitled Event'),
                        "date_time": start,
                        "link": item.get('htmlLink', ''),
                        "meet_link": item.get('hangoutLink', '')
                    }
                    events_map[formatted_event["id"]] = formatted_event
        except Exception as e:
            print(f"Failed to fetch Google Calendar events silently: {e}")

    # 4. Sort chronologically
    merged_events = list(events_map.values())
    
    # Sort safely by date_time
    def parse_time(dt_str):
        try:
            # Handle ISO format strings (often ending in Z or with timezone offset)
            if 'T' not in dt_str: 
                # If it's just a date 'YYYY-MM-DD', append midnight
                dt_str += "T00:00:00"
            return datetime.datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except Exception:
            return datetime.datetime.max # Push malformed dates to end
            
    merged_events.sort(key=lambda x: parse_time(x.get("date_time", "")))
    
    return merged_events
