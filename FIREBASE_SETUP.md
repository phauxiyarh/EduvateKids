# Firebase Setup Instructions

## Prerequisites
- Firebase project created at: https://console.firebase.google.com/u/0/project/eduvatekids-store/overview
- GitHub repository: https://github.com/ismailukman/EduvateKids

## Configuration Steps

### 1. Get Firebase Configuration
1. Go to Firebase Console: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/general
2. Scroll down to "Your apps" section
3. Click on "Web app" (</> icon) if you haven't added one yet
4. Copy the Firebase configuration values

### 2. Set up Local Environment Variables
Create a `.env.local` file in the app directory with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=eduvatekids-store.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=eduvatekids-store
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=eduvatekids-store.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Enable Firestore Database
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/firestore
2. Click "Create Database"
3. Select "Start in production mode"
4. Choose your preferred location
5. Click "Enable"

### 4. Enable Firebase Authentication
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/authentication
2. Click "Get Started"
3. Enable your preferred sign-in methods (Email/Password, Google, etc.)

### 5. Set up Firebase Service Account for GitHub Actions
1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Download the JSON file (keep it secure!)
4. Go to your GitHub repository: https://github.com/ismailukman/EduvateKids/settings/secrets/actions
5. Click "New repository secret"
6. Name: `FIREBASE_SERVICE_ACCOUNT`
7. Value: Paste the entire contents of the downloaded JSON file
8. Click "Add secret"

### 6. Add Firebase Configuration to GitHub Secrets
Add these secrets to your GitHub repository:
1. Go to: https://github.com/ismailukman/EduvateKids/settings/secrets/actions
2. Add each of these secrets:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

### 7. Deploy Firestore Rules and Indexes
Run these commands from the app directory:
```bash
firebase login
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 8. Manual First Deploy (Optional)
```bash
npm run build
firebase deploy --only hosting
```

## Automatic Deployment
Once set up, every push to the `master` branch will automatically:
1. Build the Next.js application
2. Deploy to Firebase Hosting
3. Update Firestore rules and indexes

## Testing Locally
```bash
npm run dev
```
Visit: http://localhost:8050

## Project Structure
- `lib/firebase.ts` - Firebase configuration and initialization
- `firebase.json` - Firebase hosting configuration
- `firestore.rules` - Firestore security rules
- `firestore.indexes.json` - Firestore indexes
- `.github/workflows/firebase-deploy.yml` - GitHub Actions workflow

## Important Notes
- Never commit `.env.local` to git (it's in .gitignore)
- Keep your Firebase service account JSON secure
- Update Firestore rules based on your security requirements
