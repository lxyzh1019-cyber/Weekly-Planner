# Weekly-Planner
Help kids to manage the time

## Firebase / Firestore sync setup

This app syncs planner state through **Cloud Firestore** (not Realtime Database).

### Required Firebase configuration
- Firebase project configured in `index.html` (`FIREBASE_CONFIG`).
- Firestore enabled in that Firebase project.
- App writes to:
  - collection: `weekly_planner`
  - document: `shared_state`

### Required Firestore rules (starter)
Use these rules to allow app sync while setting up:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /weekly_planner/{docId} {
      allow read, write: if true;
    }
  }
}
```

After confirming sync works, tighten rules to your intended security model.
