# Quick Start Guide - Firebase Auto-Deployment

## What's Already Done ✅
- ✅ Firebase SDK installed
- ✅ Firebase configuration files created
- ✅ GitHub Actions workflow configured
- ✅ Firestore security rules set up
- ✅ Next.js configured for static export
- ✅ Code pushed to GitHub

## What You Need to Do (5 Steps)

### Step 1: Get Firebase Web App Configuration
1. Open: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/general
2. Scroll to "Your apps" section
3. If you don't see a web app, click "Add app" (</> icon) and create one
4. Copy these values:
   - API Key
   - Auth Domain
   - Project ID
   - Storage Bucket
   - Messaging Sender ID
   - App ID

### Step 2: Enable Firestore Database
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/firestore
2. Click "Create Database"
3. Choose "Start in production mode"
4. Select a location (choose closest to your users)
5. Click "Enable"

### Step 3: Enable Firebase Authentication
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/authentication
2. Click "Get Started"
3. Enable "Email/Password" under Sign-in methods
4. (Optional) Enable other methods like Google Sign-In

### Step 4: Create Firebase Service Account
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Download the JSON file
4. **IMPORTANT**: Keep this file secure! Don't share it.

### Step 5: Add Secrets to GitHub
1. Go to: https://github.com/ismailukman/EduvateKids/settings/secrets/actions
2. Click "New repository secret" for each:

   **Secret 1:**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste entire contents of the JSON file from Step 4

   **Secret 2:**
   - Name: `NEXT_PUBLIC_FIREBASE_API_KEY`
   - Value: Your API Key from Step 1

   **Secret 3:**
   - Name: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - Value: `eduvatekids-store.firebaseapp.com`

   **Secret 4:**
   - Name: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - Value: `eduvatekids-store`

   **Secret 5:**
   - Name: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - Value: Your Storage Bucket from Step 1 (usually: `eduvatekids-store.firebasestorage.app`)

   **Secret 6:**
   - Name: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - Value: Your Messaging Sender ID from Step 1

   **Secret 7:**
   - Name: `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Value: Your App ID from Step 1

## Step 6: Create .env.local for Local Development
Create a file named `.env.local` in the app directory with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eduvatekids-store.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eduvatekids-store
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

## Step 7: Deploy Firestore Rules
Open terminal in the app directory and run:
```bash
firebase login
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## That's It! 🎉

### How Auto-Deployment Works:
1. Make any code changes
2. Commit: `git add . && git commit -m "your message"`
3. Push: `git push origin master`
4. GitHub Actions automatically builds and deploys to Firebase!

### Check Deployment Status:
- GitHub Actions: https://github.com/ismailukman/EduvateKids/actions
- Firebase Hosting: https://console.firebase.google.com/u/0/project/eduvatekids-store/hosting

### Your Live Site Will Be At:
- https://eduvatekids-store.web.app
- https://eduvatekids-store.firebaseapp.com

## Troubleshooting

**Build fails?**
- Check GitHub Actions logs
- Verify all secrets are correctly set

**Can't access Firestore?**
- Check Firestore rules in Firebase Console
- Make sure authentication is enabled

**Need help?**
- Check Firebase Console for errors
- Review GitHub Actions workflow logs
