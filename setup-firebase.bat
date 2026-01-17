@echo off
echo ================================
echo Firebase Initial Setup Script
echo ================================
echo.

echo This script will:
echo 1. Login to Firebase
echo 2. Deploy Firestore rules
echo 3. Deploy Firestore indexes
echo 4. Deploy to Firebase Hosting
echo.
pause

echo.
echo Step 1: Logging in to Firebase...
echo Please follow the browser instructions to login
echo.
call firebase login
if errorlevel 1 (
    echo Login failed! Please try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying Firestore security rules...
call firebase deploy --only firestore:rules
if errorlevel 1 (
    echo Failed to deploy Firestore rules!
    pause
    exit /b 1
)

echo.
echo Step 3: Deploying Firestore indexes...
call firebase deploy --only firestore:indexes
if errorlevel 1 (
    echo Failed to deploy Firestore indexes!
    pause
    exit /b 1
)

echo.
echo Step 4: Building Next.js app...
call npm run build
if errorlevel 1 (
    echo Build failed! Please fix errors.
    pause
    exit /b 1
)

echo.
echo Step 5: Deploying to Firebase Hosting...
call firebase deploy --only hosting
if errorlevel 1 (
    echo Deployment failed!
    pause
    exit /b 1
)

echo.
echo ================================
echo Setup Complete!
echo ================================
echo.
echo Your app is now live at:
echo https://eduvatekids-store.web.app
echo https://eduvatekids-store.firebaseapp.com
echo.
echo Next steps:
echo 1. Add GitHub secrets (see GITHUB_SECRETS.md)
echo 2. Push to GitHub to test auto-deployment
echo.
pause
