# System Update: Visual ROI & Token Fixes

## 1. Crop Caveat Resolved "517px Crash"
I found the issue: FFmpeg crashes when cropping to odd pixel dimensions (e.g. 517px).
**Fix Deployed:** The "Select Visual Area" tool now automatically rounds your selection to the nearest even number (e.g. 518px).
- **Action:** Refresh the dashboard and select your area again. It won't crash anymore.

## 2. Token Expiration Fix
To solve the "OAuthException", I added a **"WhatsApp Token"** field in the **Settings** tab.
- **Action:** Generate a new token and paste it there.
- **Note:** Sound does NOT trigger the camera (it only wakes up visually every 15s).

The system is now stable.
