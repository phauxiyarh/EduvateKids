// Script to create a cashier user in Firestore
// This is a helper script to add users with cashier role
// Run with: node create-cashier.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function createCashier(email, password, displayName = null) {
  try {
    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName || email.split('@')[0]
    });

    console.log('✅ Created Firebase Auth user:', userRecord.uid);

    // Create Firestore user document with cashier role
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      displayName: displayName || email.split('@')[0],
      role: 'cashier',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Created Firestore user document with cashier role');
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Role: cashier');
    console.log('🆔 UID:', userRecord.uid);
    console.log('\n✨ Cashier user created successfully!');
    console.log('They can now login and will only see the POS page.\n');

  } catch (error) {
    console.error('❌ Error creating cashier:', error.message);
  }

  process.exit();
}

// Get email and password from command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('\n📝 Usage: node create-cashier.js <email> <password> [displayName]\n');
  console.log('Example: node create-cashier.js cashier@eduvatekids.com SecurePass123 "John Cashier"\n');
  process.exit(1);
}

const email = args[0];
const password = args[1];
const displayName = args[2] || null;

createCashier(email, password, displayName);
