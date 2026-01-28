import { readFileSync } from 'fs';
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nurture_glow',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10
});

console.log(`🔌 Connecting to database: ${process.env.DB_NAME} as ${process.env.DB_USER}`);

async function setupSystemAdminTables() {
  try {
    console.log('🔄 Reading SQL file...');
    const sql = readFileSync('./system_admin_schema.sql', 'utf8');
    
    // Split into individual statements (removing comments and empty lines)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📄 Found ${statements.length} SQL statements`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment blocks
      if (statement.includes('/*') || statement.includes('*/')) {
        continue;
      }

      try {
        await pool.query(statement);
        successCount++;
        
        // Log table creation
        if (statement.toUpperCase().includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
          if (match) {
            console.log(`✅ Created table: ${match[1]}`);
          }
        }
        // Log view creation
        else if (statement.toUpperCase().includes('CREATE OR REPLACE VIEW')) {
          const match = statement.match(/CREATE OR REPLACE VIEW\s+(\w+)/i);
          if (match) {
            console.log(`✅ Created view: ${match[1]}`);
          }
        }
      } catch (err) {
        // Ignore "already exists" errors
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
          console.log(`ℹ️  Table/View already exists, skipping...`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, err.message);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Setup complete!`);
    console.log(`   Successful statements: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('='.repeat(60));

    // Verify tables
    console.log('\n🔍 Verifying tables...');
    const dbName = process.env.DB_NAME || 'neonest';
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('system_backups', 'system_metrics', 'security_events', 'admin_actions')
    `, [dbName]);

    if (tables.length > 0) {
      console.log('✅ System Admin tables verified:');
      tables.forEach(t => console.log(`   - ${t.TABLE_NAME}`));
    } else {
      console.log('⚠️  Warning: System Admin tables not found!');
    }

    // Check views
    const [views] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.VIEWS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'v_system_admin_dashboard'
    `, [dbName]);

    if (views.length > 0) {
      console.log('✅ Dashboard view verified:');
      views.forEach(v => console.log(`   - ${v.TABLE_NAME}`));
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    await pool.end();
    process.exit(1);
  }
}

setupSystemAdminTables();
