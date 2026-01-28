import { query } from './src/db.js';
import fs from 'fs';

async function createDashboardViews() {
  try {
    console.log('Creating dashboard views...');
    
    const sql = fs.readFileSync('./create_dashboard_views.sql', 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await query(statement);
          console.log('✓ View created successfully');
        } catch (err) {
          console.error('Error creating view:', err.message);
        }
      }
    }
    
    console.log('\n✓ All dashboard views created!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

createDashboardViews();
