#!/usr/bin/env node

/**
 * Reset Blood Donor Database
 * Deletes all blood donor entries from the database
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function resetDonors() {
  console.log('\n🩸 Blood Donor Database Reset Tool\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Create database connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nurture_glow'
    });

    console.log('✅ Connected to database\n');

    // Get count of donors before deletion
    const [countResult] = await connection.query(
      "SELECT COUNT(*) as count FROM app_entities WHERE type = 'blood_donor'"
    );
    const donorCount = countResult[0].count;

    if (donorCount === 0) {
      console.log('ℹ️  No blood donors found in database');
      console.log('✨ Database is already clean!\n');
      await connection.end();
      return;
    }

    console.log(`📊 Found ${donorCount} blood donor(s) in database\n`);

    // Delete all blood donors
    const [result] = await connection.query(
      "DELETE FROM app_entities WHERE type = 'blood_donor'"
    );

    console.log(`✅ Successfully deleted ${result.affectedRows} blood donor(s)\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Blood donor database has been reset!');
    console.log('🎯 You can now add fresh data\n');

    await connection.end();
    console.log('✅ Database connection closed\n');

  } catch (error) {
    console.error('\n❌ Error resetting donors:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   • MySQL is running');
    console.error('   • Database credentials are correct in .env file');
    console.error('   • Database "nurture_glow" exists\n');
    process.exit(1);
  }
}

resetDonors();
