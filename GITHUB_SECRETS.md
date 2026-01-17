# GitHub Secrets Setup Guide

## Your Firebase Configuration Values

Based on your Firebase web app configuration, you need to add these exact secrets to GitHub:

### Required GitHub Secrets

Go to: **https://github.com/ismailukman/EduvateKids/settings/secrets/actions**

Click **"New repository secret"** for each of the following:

---

### Secret 1: NEXT_PUBLIC_FIREBASE_API_KEY
**Value:**
```
AIzaSyB0Bv529O2KODbqZX75j-Gl7GoPHJ5A6po
```

---

### Secret 2: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
**Value:**
```
eduvatekids-store.firebaseapp.com
```

---

### Secret 3: NEXT_PUBLIC_FIREBASE_PROJECT_ID
**Value:**
```
eduvatekids-store
```

---

### Secret 4: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
**Value:**
```
eduvatekids-store.firebasestorage.app
```

---

### Secret 5: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
**Value:**
```
199688038921
```

---

### Secret 6: NEXT_PUBLIC_FIREBASE_APP_ID
**Value:**
```
1:199688038921:web:d3c8284655bfa094d426d8
```

---

### Secret 7: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
**Value:**
```
G-2DW5M7K8GR
```

---

### Secret 8: FIREBASE_SERVICE_ACCOUNT

This one requires a JSON file from Firebase.

**Steps to get it:**

1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk

2. Click **"Generate new private key"**

3. Click **"Generate key"** in the popup

4. A JSON file will download (something like `eduvatekids-store-firebase-adminsdk-xxxxx.json`)

5. Open the JSON file in a text editor

6. **Copy the ENTIRE contents** of the file

7. Go to GitHub secrets and create a new secret:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Paste the entire JSON content

**IMPORTANT:** Keep this JSON file secure! Don't share it or commit it to git.

---

## How to Add Secrets

### Step-by-Step:

1. **Open GitHub Secrets Page:**
   - https://github.com/ismailukman/EduvateKids/settings/secrets/actions

2. **For Each Secret Above:**
   - Click **"New repository secret"**
   - Enter the **Name** (exactly as shown, case-sensitive)
   - Paste the **Value**
   - Click **"Add secret"**

3. **Verify All Secrets Are Added:**
   You should see 8 secrets total:
   - ✅ NEXT_PUBLIC_FIREBASE_API_KEY
   - ✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   - ✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID
   - ✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   - ✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   - ✅ NEXT_PUBLIC_FIREBASE_APP_ID
   - ✅ NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
   - ✅ FIREBASE_SERVICE_ACCOUNT

---

## Testing Auto-Deployment

After adding all secrets:

1. **Make a test change:**
   ```bash
   echo "# Test" >> README.md
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push origin master
   ```

3. **Watch the deployment:**
   - Go to: https://github.com/ismailukman/EduvateKids/actions
   - Click on the latest workflow run
   - Watch the build and deployment process

4. **Check your live site:**
   - https://eduvatekids-store.web.app
   - https://eduvatekids-store.firebaseapp.com

---

## Troubleshooting

### Build Fails in GitHub Actions

**Check:**
1. All 8 secrets are added correctly
2. No typos in secret names
3. No extra spaces in secret values
4. Service account JSON is complete and valid

**View Logs:**
- https://github.com/ismailukman/EduvateKids/actions
- Click on the failed workflow
- Expand the failing step to see error details

### Deployment Succeeds but Site Not Updating

**Check:**
1. Firebase Hosting is enabled
2. Correct project ID in firebase.json
3. Build completed successfully
4. Clear browser cache

### Still Having Issues?

1. **Re-run the workflow:**
   - Go to: https://github.com/ismailukman/EduvateKids/actions
   - Click on the failed workflow
   - Click "Re-run all jobs"

2. **Check Firebase Console:**
   - https://console.firebase.google.com/u/0/project/eduvatekids-store/hosting
   - View deployment history and logs

3. **Verify Service Account:**
   - Make sure the JSON is valid
   - Try generating a new service account key

---

## Security Notes

### ⚠️ IMPORTANT:

1. **Never commit these values to git**
   - They're in `.env.local` which is gitignored
   - GitHub Secrets are encrypted and secure

2. **Service Account JSON**
   - Keep it secure and private
   - Don't share it or commit it
   - Store it in a safe location

3. **Rotating Keys**
   - If compromised, regenerate service account
   - Update GitHub secret with new JSON
   - No code changes needed

---

## Quick Reference

### Your Project URLs:
- **GitHub Repo:** https://github.com/ismailukman/EduvateKids
- **GitHub Secrets:** https://github.com/ismailukman/EduvateKids/settings/secrets/actions
- **GitHub Actions:** https://github.com/ismailukman/EduvateKids/actions
- **Firebase Console:** https://console.firebase.google.com/u/0/project/eduvatekids-store
- **Service Accounts:** https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk
- **Live Site:** https://eduvatekids-store.web.app
- **Alt URL:** https://eduvatekids-store.firebaseapp.com

### Local Development:
- Development server: `npm run dev`
- Visit: http://localhost:8050
- Environment: `.env.local` file

---

**Next Step:** Run `setup-firebase.bat` to complete the initial deployment!
