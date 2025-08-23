# Firebase Configuration Setup

## Issues
You're experiencing two Firebase configuration issues:
1. `CONFIGURATION_NOT_FOUND` - Firebase Authentication is not enabled
2. `Missing or insufficient permissions` - Firestore security rules need configuration

## Solution

### Step 1: Enable Firebase Authentication

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `crowd-monitoring-e1f70`
3. **Navigate to Authentication**
4. **Click "Get started"** if you haven't set up Authentication yet
5. **Go to "Sign-in method" tab**
6. **Enable "Anonymous" authentication**:
   - Click on "Anonymous"
   - Toggle "Enable"
   - Click "Save"

### Step 2: Configure Firestore Security Rules

1. **Navigate to Firestore Database** → **Rules**
2. **Replace the existing rules** with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anonymous users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to create and read SOS alerts
    match /sos-alerts/{alertId} {
      allow read, write: if request.auth != null;
      allow create: if request.auth != null && 
                    request.auth.uid == resource.data.userId;
    }
    
    // Allow authenticated users to create notification logs
    match /notification-logs/{logId} {
      allow read, write: if request.auth != null && 
                          request.auth.uid == resource.data.userId;
    }
    
    // Allow authenticated users to read danger alerts
    match /danger-alerts/{alertId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

5. **Click "Publish"** to apply the rules

## What these rules do:
- Allow anonymous authenticated users to read/write their own user data
- Allow authenticated users to create and manage SOS alerts
- Allow authenticated users to create notification logs
- Allow authenticated users to read danger alerts

## Temporary Fallback
Until you set up the rules, the app will use localStorage as a fallback for storing data locally. This ensures the app continues to work while you configure Firebase.

## After Setup
Once the rules are published, refresh your app and try logging in again. The Firebase permission errors should be resolved.
