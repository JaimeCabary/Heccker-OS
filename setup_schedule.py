import datetime
import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar.events']

def main():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if not os.path.exists('credentials.json'):
            print("Error: Missing credentials.json")
            return
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    service = build('calendar', 'v3', credentials=creds)

    # Date to start recurrence (tomorrow, to avoid overlap if time already passed)
    # Actually, we can just start today.
    today_str = "2026-07-07"
    time_zone = "Europe/London" # +01:00

    schedules = [
        {"title": "🍳 Breakfast & Morning Medication", "start": "08:30:00", "end": "09:00:00"},
        {"title": "🥗 Lunch Break & Stretch", "start": "13:00:00", "end": "14:00:00"},
        {"title": "🍽️ Dinner & Evening Medication", "start": "19:00:00", "end": "20:00:00"},
        {"title": "🛑 HARD STOP & Screens Off", "start": "21:00:00", "end": "21:30:00"},
    ]

    for item in schedules:
        event = {
            'summary': item['title'],
            'start': {
                'dateTime': f"{today_str}T{item['start']}",
                'timeZone': time_zone,
            },
            'end': {
                'dateTime': f"{today_str}T{item['end']}",
                'timeZone': time_zone,
            },
            'recurrence': [
                'RRULE:FREQ=DAILY'
            ],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 15},
                    {'method': 'popup', 'minutes': 5},
                ],
            },
        }
        
        print(f"Adding event...")
        result = service.events().insert(calendarId='primary', body=event).execute()
        print(f"Added! Link: {result.get('htmlLink')}")

if __name__ == '__main__':
    main()
