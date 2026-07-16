import os
import json

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

_db = None
_firebase_initialized = False

def init_firebase():
    global _db, _firebase_initialized
    if _firebase_initialized:
        return _db
    
    _firebase_initialized = True
    if not FIREBASE_AVAILABLE:
        print("firebase-admin not installed. Using local JSON fallback.")
        return None
        
    try:
        cred_path = os.environ.get("FIREBASE_KEY_PATH", "firebase-credentials.json")
        if os.path.exists(cred_path):
            if not firebase_admin._apps:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            _db = firestore.client()
            print("Firebase Firestore initialized successfully.")
        else:
            print(f"Firebase credentials not found at {cred_path}. Using local JSON fallback.")
    except Exception as e:
        print(f"Firebase initialization failed: {e}. Using local JSON fallback.")
        _db = None
    return _db

def save_json(collection: str, doc_id: str, data, local_filename: str):
    """Saves data to Firestore and local JSON."""
    db = init_firebase()
    if db:
        try:
            # Firestore requires a dict at the root level
            doc_data = {"data": data} if isinstance(data, list) else data
            db.collection(collection).document(doc_id).set(doc_data)
        except Exception as e:
            print(f"Firebase save error for {collection}: {e}")
            
    # Always save locally
    if local_filename:
        try:
            with open(local_filename, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Local save error for {local_filename}: {e}")

def load_json(collection: str, doc_id: str, local_filename: str, default=None):
    """Loads data from Firestore, falling back to local JSON."""
    db = init_firebase()
    if db:
        try:
            doc = db.collection(collection).document(doc_id).get()
            if doc.exists:
                doc_data = doc.to_dict()
                return doc_data.get("data", doc_data) if "data" in doc_data and len(doc_data) == 1 else doc_data
        except Exception as e:
            print(f"Firebase load error for {collection}: {e}")

    # Fallback to local JSON
    if local_filename and os.path.exists(local_filename):
        try:
            with open(local_filename, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Local load error for {local_filename}: {e}")
            
    return default if default is not None else []

def save_text(collection: str, doc_id: str, text: str, local_filename: str):
    """Saves raw text (e.g. markdown) to Firestore and local file."""
    db = init_firebase()
    if db:
        try:
            db.collection(collection).document(doc_id).set({"content": text})
        except Exception as e:
            print(f"Firebase save error for {collection}: {e}")
            
    if local_filename:
        try:
            with open(local_filename, "w", encoding="utf-8") as f:
                f.write(text)
        except Exception as e:
            print(f"Local save error for {local_filename}: {e}")

def load_text(collection: str, doc_id: str, local_filename: str, default=""):
    """Loads text from Firestore, falling back to local file."""
    db = init_firebase()
    if db:
        try:
            doc = db.collection(collection).document(doc_id).get()
            if doc.exists:
                return doc.to_dict().get("content", default)
        except Exception as e:
            print(f"Firebase load error for {collection}: {e}")

    if local_filename and os.path.exists(local_filename):
        try:
            with open(local_filename, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"Local load error for {local_filename}: {e}")
            
    return default
