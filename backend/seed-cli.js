import { seedDatabase } from './src/seed.js';

(async () => {
  try {
    await seedDatabase();
    console.log('✓ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  }
})();
