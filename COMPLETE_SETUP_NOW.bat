@echo off
color 0A
cls
echo ================================================================================
echo             EDUVATEKIDS - COMPLETE FIREBASE SETUP
echo ================================================================================
echo.
echo This script will complete ALL remaining setup steps automatically.
echo.
echo What this script does:
echo   1. Login to Firebase
echo   2. Deploy Firestore security rules
echo   3. Deploy Firestore indexes
echo   4. Build your Next.js application
echo   5. Deploy to Firebase Hosting
echo   6. Show you live URLs
echo.
echo IMPORTANT: Keep this window open and follow all prompts!
echo.
pause
cls

echo ================================================================================
echo STEP 1: Firebase Login
echo ================================================================================
echo.
echo A browser window will open for you to login to Firebase.
echo Please complete the login process in your browser.
echo.
pause

firebase login
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Firebase login failed!
    echo Please make sure you have internet connection and try again.
    echo.
    pause
    exit /b 1
)

color 0A
cls
echo ================================================================================
echo STEP 2: Deploying Firestore Security Rules
echo ================================================================================
echo.
echo Deploying security rules to protect your database...
echo.

firebase deploy --only firestore:rules --project eduvatekids-store
if errorlevel 1 (
    color 0E
    echo.
    echo [WARNING] Firestore rules deployment had issues.
    echo This might be because Firestore is not enabled yet.
    echo.
    echo Please enable Firestore:
    echo 1. Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/firestore
    echo 2. Click "Create Database"
    echo 3. Choose "Start in production mode"
    echo 4. Select a location
    echo 5. Click "Enable"
    echo.
    echo After enabling Firestore, run this script again.
    echo.
    pause
    color 0A
)

cls
echo ================================================================================
echo STEP 3: Deploying Firestore Indexes
echo ================================================================================
echo.
echo Deploying database indexes for optimal performance...
echo.

firebase deploy --only firestore:indexes --project eduvatekids-store
if errorlevel 1 (
    color 0E
    echo.
    echo [WARNING] Index deployment had issues, but continuing...
    echo.
    timeout /t 3 >nul
    color 0A
)

cls
echo ================================================================================
echo STEP 4: Building Next.js Application
echo ================================================================================
echo.
echo Building your application for production...
echo This may take a few minutes...
echo.

call npm run build
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Build failed!
    echo Please check the error messages above and fix any issues.
    echo.
    pause
    exit /b 1
)

color 0A
cls
echo ================================================================================
echo STEP 5: Deploying to Firebase Hosting
echo ================================================================================
echo.
echo Deploying your application to Firebase Hosting...
echo.

firebase deploy --only hosting --project eduvatekids-store
if errorlevel 1 (
    color 0C
    echo.
    echo [ERROR] Deployment to Firebase Hosting failed!
    echo Please check the error messages above.
    echo.
    pause
    exit /b 1
)

color 0A
cls
echo ================================================================================
echo              SUCCESS! Your App is Now LIVE!
echo ================================================================================
echo.
echo Your application has been successfully deployed to Firebase!
echo.
echo LIVE URLS:
echo   Primary:   https://eduvatekids-store.web.app
echo   Secondary: https://eduvatekids-store.firebaseapp.com
echo.
echo LOCAL DEVELOPMENT:
echo   URL: http://localhost:8050
echo   Command: npm run dev
echo.
echo FIREBASE CONSOLE:
echo   https://console.firebase.google.com/u/0/project/eduvatekids-store
echo.
echo ================================================================================
echo.
echo NEXT STEPS - IMPORTANT!
echo ================================================================================
echo.
echo To enable AUTOMATIC deployment on every Git push, you need to:
echo.
echo 1. Download Firebase Service Account JSON:
echo    - Go to: https://console.firebase.google.com/u/0/project/eduvatekids-store/settings/serviceaccounts/adminsdk
echo    - Click "Generate new private key"
echo    - Save the downloaded JSON file
echo.
echo 2. Add GitHub Secrets:
echo    - Go to: https://github.com/ismailukman/EduvateKids/settings/secrets/actions
echo    - Click "New repository secret" for each:
echo.
echo    SECRET 1: NEXT_PUBLIC_FIREBASE_API_KEY
echo    Value: AIzaSyB0Bv529O2KODbqZX75j-Gl7GoPHJ5A6po
echo.
echo    SECRET 2: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
echo    Value: eduvatekids-store.firebaseapp.com
echo.
echo    SECRET 3: NEXT_PUBLIC_FIREBASE_PROJECT_ID
echo    Value: eduvatekids-store
echo.
echo    SECRET 4: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
echo    Value: eduvatekids-store.firebasestorage.app
echo.
echo    SECRET 5: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
echo    Value: 199688038921
echo.
echo    SECRET 6: NEXT_PUBLIC_FIREBASE_APP_ID
echo    Value: 1:199688038921:web:d3c8284655bfa094d426d8
echo.
echo    SECRET 7: NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
echo    Value: G-2DW5M7K8GR
echo.
echo    SECRET 8: FIREBASE_SERVICE_ACCOUNT
echo    Value: [Paste the ENTIRE contents of the JSON file you downloaded]
echo.
echo 3. After adding secrets, test auto-deployment:
echo    git add .
echo    git commit -m "Test auto-deployment"
echo    git push origin master
echo.
echo    Watch deployment at: https://github.com/ismailukman/EduvateKids/actions
echo.
echo ================================================================================
echo.
echo Press any key to open your live site in the browser...
pause >nul

start https://eduvatekids-store.web.app

echo.
echo Opening Firebase Console...
timeout /t 2 >nul
start https://console.firebase.google.com/u/0/project/eduvatekids-store

echo.
echo Opening GitHub Secrets page...
timeout /t 2 >nul
start https://github.com/ismailukman/EduvateKids/settings/secrets/actions

echo.
echo All done! Check your browser windows.
echo.
pause
