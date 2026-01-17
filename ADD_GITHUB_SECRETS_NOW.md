# 🔐 ADD GITHUB SECRETS - COPY & PASTE GUIDE

## ⚡ Quick Setup (5 Minutes)

Follow these exact steps to enable auto-deployment.

---

## 📋 PART 1: Get Firebase Service Account (2 minutes)

### Step 1: Open Service Accounts Page
Click this link: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk

### Step 2: Generate Key
1. Click the **"Generate new private key"** button
2. Click **"Generate key"** in the confirmation popup
3. A JSON file will download (e.g., `eduvatekids-store-firebase-adminsdk-xxxxx.json`)
4. **Save this file** - you'll need it in a moment

⚠️ **IMPORTANT:** This file contains sensitive credentials. Never share it or commit it to git!

---

## 📋 PART 2: Add All 8 GitHub Secrets (3 minutes)

### Open GitHub Secrets Page
Click this link: https://github.com/ismailukman/EduvateKids/settings/secrets/actions

### Now Add Each Secret Below:

---

### ✅ SECRET 1 of 8

**Click:** "New repository secret"

**Name (copy this exactly):**
```
NEXT_PUBLIC_FIREBASE_API_KEY
```

**Value (copy this exactly):**
```
AIzaSyB0Bv529O2KODbqZX75j-Gl7GoPHJ5A6po
```

**Click:** "Add secret"

---

### ✅ SECRET 2 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
```

**Value:**
```
eduvatekids-store.firebaseapp.com
```

**Click:** "Add secret"

---

### ✅ SECRET 3 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

**Value:**
```
eduvatekids-store
```

**Click:** "Add secret"

---

### ✅ SECRET 4 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
```

**Value:**
```
eduvatekids-store.firebasestorage.app
```

**Click:** "Add secret"

---

### ✅ SECRET 5 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
```

**Value:**
```
199688038921
```

**Click:** "Add secret"

---

### ✅ SECRET 6 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_APP_ID
```

**Value:**
```
1:199688038921:web:d3c8284655bfa094d426d8
```

**Click:** "Add secret"

---

### ✅ SECRET 7 of 8

**Click:** "New repository secret"

**Name:**
```
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

**Value:**
```
G-2DW5M7K8GR
```

**Click:** "Add secret"

---

### ✅ SECRET 8 of 8 (MOST IMPORTANT!)

**Click:** "New repository secret"

**Name:**
```
FIREBASE_SERVICE_ACCOUNT
```

**Value:**
1. Open the JSON file you downloaded in Step 2 of Part 1
2. Select ALL the text in the file (Ctrl+A)
3. Copy it (Ctrl+C)
4. Paste it in the "Value" field (Ctrl+V)

**The JSON should look something like this:**
```json
{
  "type": "service_account",
  "project_id": "eduvatekids-store",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...@eduvatekids-store.iam.gserviceaccount.com",
  ...
}
```

**Click:** "Add secret"

---

## ✅ Verify All Secrets Are Added

You should now see **8 secrets** on the GitHub Secrets page:

- ✅ FIREBASE_SERVICE_ACCOUNT
- ✅ NEXT_PUBLIC_FIREBASE_API_KEY
- ✅ NEXT_PUBLIC_FIREBASE_APP_ID
- ✅ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- ✅ NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
- ✅ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- ✅ NEXT_PUBLIC_FIREBASE_PROJECT_ID
- ✅ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

---

## 🚀 PART 3: Test Auto-Deployment (1 minute)

### Open Command Prompt in your app folder and run:

```bash
# Make a test change
echo # Test auto-deployment >> README.md

# Commit the change
git add .
git commit -m "Test auto-deployment"

# Push to GitHub
git push origin master
```

### Watch the Magic Happen! ✨

1. **Open GitHub Actions:** https://github.com/ismailukman/EduvateKids/actions
2. You should see a new workflow running
3. Click on it to watch the build and deployment process
4. Wait 2-3 minutes for it to complete
5. Your site will automatically update at: https://eduvatekids-store.web.app

---

## 🎉 DONE!

### From now on, every time you push to GitHub:
1. ✅ GitHub Actions automatically builds your app
2. ✅ Runs tests and checks
3. ✅ Deploys to Firebase Hosting
4. ✅ Your live site updates automatically!

---

## 🔗 Quick Links

- **Live Site:** https://eduvatekids-store.web.app
- **GitHub Actions:** https://github.com/ismailukman/EduvateKids/actions
- **GitHub Secrets:** https://github.com/ismailukman/EduvateKids/settings/secrets/actions
- **Firebase Console:** https://console.firebase.google.com/u/0/project/eduvatekids-store
- **Local Dev:** http://localhost:8050

---

## 🆘 Troubleshooting

### Workflow Fails?
1. Check all 8 secrets are added correctly
2. Verify the service account JSON is complete
3. Look at the error in GitHub Actions logs

### Still Not Working?
1. Delete the FIREBASE_SERVICE_ACCOUNT secret
2. Generate a new service account key from Firebase
3. Add it again as a new secret

### Need Help?
Check the GitHub Actions logs for detailed error messages:
https://github.com/ismailukman/EduvateKids/actions

---

**Setup Time:** ~5 minutes
**Completed:** Almost there! Just add the secrets above.
