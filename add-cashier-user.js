// Quick script to add a cashier user to Firestore
// This adds the user role document for an existing Firebase Auth user

const admin = require('firebase-admin');

// Initialize with project ID from environment
admin.initializeApp({
  projectId: 'eduvatekids-store'
});

const db = admin.firestore();
const auth = admin.auth();

async function createCashierUser() {
  const email = 'cashier@eduvatekids.com';
  const password = 'Cashier2026!';
  const displayName = 'Cashier User';

  try {
    console.log('\n🔧 Creating cashier user...\n');

    // First, try to create the Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: true
      });
      console.log('✅ Created Firebase Auth user:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('ℹ️  User already exists in Firebase Auth, fetching...');
        userRecord = await auth.getUserByEmail(email);
        console.log('✅ Found existing user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Create or update Firestore user document with cashier role
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: displayName,
      role: 'cashier',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('✅ Created/Updated Firestore user document with cashier role\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CASHIER USER CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', email);
    console.log('🔑 Password: ', password);
    console.log('👤 Role:     ', 'cashier');
    console.log('🆔 UID:      ', userRecord.uid);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✨ Cashier user is ready to use!');
    console.log('🎯 This user will ONLY have access to the POS page.\n');
    console.log('🌐 Login at: https://eduvatekids-store.web.app/auth/login\n');

  } catch (error) {
    console.error('❌ Error creating cashier:', error);
  }

  process.exit();
}

createCashierUser();
