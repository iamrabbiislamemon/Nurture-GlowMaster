/**
 * Interactive Email Setup for Nurture-Glow
 * This script helps you configure Gmail to send REAL emails
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📧  NURTURE GLOW - EMAIL CONFIGURATION SETUP');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nThis wizard will help you configure Gmail to send REAL emails.\n');

async function setup() {
  console.log('📌 STEP 1: Enable 2-Step Verification');
  console.log('   1. Go to: https://myaccount.google.com/security');
  console.log('   2. Enable "2-Step Verification"\n');
  
  const step1 = await question('Have you enabled 2-Step Verification? (yes/no): ');
  if (step1.toLowerCase() !== 'yes' && step1.toLowerCase() !== 'y') {
    console.log('\n⚠️  Please enable 2-Step Verification first, then run this script again.');
    rl.close();
    return;
  }

  console.log('\n📌 STEP 2: Generate App Password');
  console.log('   1. Go to: https://myaccount.google.com/apppasswords');
  console.log('   2. Select "Mail" and "Other (Custom name)"');
  console.log('   3. Enter "Nurture Glow" as the name');
  console.log('   4. Click "Generate"');
  console.log('   5. Copy the 16-character password (remove spaces)\n');

  const email = await question('Enter your Gmail address: ');
  const appPassword = await question('Enter your App Password (16 chars, no spaces): ');

  // Validate inputs
  if (!email.includes('@gmail.com')) {
    console.log('\n❌ Please enter a valid Gmail address');
    rl.close();
    return;
  }

  if (appPassword.replace(/\s/g, '').length !== 16) {
    console.log('\n⚠️  Warning: App Password should be 16 characters');
  }

  // Read current .env
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (err) {
    console.log('\n⚠️  .env file not found, creating new one...');
  }

  // Update or add email configuration
  const cleanPassword = appPassword.replace(/\s/g, '');
  
  const updates = {
    'EMAIL_SERVICE': 'gmail',
    'EMAIL_USER': email,
    'EMAIL_PASSWORD': cleanPassword
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  // Write updated .env
  fs.writeFileSync(envPath, envContent);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EMAIL CONFIGURATION SAVED!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Configuration:');
  console.log(`   Email: ${email}`);
  console.log(`   Service: Gmail`);
  console.log(`   Password: ${'*'.repeat(cleanPassword.length)} (saved securely)`);
  console.log('\n🚀 Next Steps:');
  console.log('   1. Restart your backend server: npm start');
  console.log('   2. Test password reset - emails will now go to REAL inboxes!');
  console.log('   3. Check spam folder if you don\'t see the email initially\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  rl.close();
}

setup().catch(err => {
  console.error('Error:', err.message);
  rl.close();
});
