@echo off
echo ================================
echo Firebase Deployment Script
echo ================================
echo.

echo Step 1: Building Next.js app...
call npm run build
if errorlevel 1 (
    echo Build failed! Please fix errors and try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying to Firebase...
call firebase deploy
if errorlevel 1 (
    echo Deployment failed! Make sure you're logged in with: firebase login
    pause
    exit /b 1
)

echo.
echo ================================
echo Deployment Complete!
echo ================================
echo Your app is now live at:
echo https://eduvatekids-store.web.app
echo https://eduvatekids-store.firebaseapp.com
echo.
pause
