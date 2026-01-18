import { v4 as uuidv4 } from 'uuid';
import { query } from './db.js';

export async function seedDatabase() {
  await query(
    "INSERT INTO roles (role_name) VALUES ('USER'), ('DOCTOR'), ('ADMIN') ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)"
  );
  await query(
    "INSERT INTO doctor_specialties (name) VALUES ('Gynecologist'), ('Pediatrician'), ('Nutritionist'), ('Psychologist') ON DUPLICATE KEY UPDATE name = VALUES(name)"
  );
  await query(
    "INSERT INTO product_categories (name) VALUES ('Mother Care'), ('Baby Care'), ('Nutrition'), ('Medical Devices') ON DUPLICATE KEY UPDATE name = VALUES(name)"
  );

  const hospitals = [
    { name: 'Dhaka Medical College', address: 'Ramna, Dhaka', hotline_phone: '+8802-9669340', lat: 23.7258, lng: 90.3976 },
    { name: 'Square Hospital', address: 'Panthapath, Dhaka', hotline_phone: '+8802-8144400', lat: 23.7507, lng: 90.3879 },
    { name: 'Evercare Hospital', address: 'Bashundhara, Dhaka', hotline_phone: '+8802-8401661', lat: 23.8124, lng: 90.4326 }
  ];

  for (const hospital of hospitals) {
    const exists = await query('SELECT id FROM hospitals WHERE name = ? LIMIT 1', [hospital.name]);
    if (!exists.length) {
      await query(
        'INSERT INTO hospitals (id, name, address, hotline_phone, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), hospital.name, hospital.address, hospital.hotline_phone, hospital.lat, hospital.lng]
      );
    }
  }

  const doctorSpecialties = await query('SELECT id, name FROM doctor_specialties');
  const specialtyMap = new Map(doctorSpecialties.map(row => [row.name, row.id]));

  const doctors = [
    { full_name: 'Dr. Arifa Begum', specialty: 'Gynecologist', phone: '+8801711223344', email: 'arifa@example.com', fee_amount: 1000 },
    { full_name: 'Dr. Mahbub Rahman', specialty: 'Pediatrician', phone: '+8801811223344', email: 'mahbub@example.com', fee_amount: 1200 },
    { full_name: 'Dr. Nusrat Jahan', specialty: 'Nutritionist', phone: '+8801911223344', email: 'nusrat@example.com', fee_amount: 800 }
  ];

  for (const doctor of doctors) {
    const exists = await query('SELECT id FROM doctors WHERE full_name = ? LIMIT 1', [doctor.full_name]);
    if (!exists.length) {
      await query(
        'INSERT INTO doctors (id, full_name, specialty_id, verified, fee_amount, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), doctor.full_name, specialtyMap.get(doctor.specialty), true, doctor.fee_amount, doctor.phone, doctor.email]
      );
    }
  }

  const vendors = await query('SELECT id FROM vendors WHERE name = ? LIMIT 1', ['Nurture Glow Official']);
  let vendorId = vendors[0]?.id;
  if (!vendorId) {
    vendorId = uuidv4();
    await query(
      'INSERT INTO vendors (id, name, phone, verified) VALUES (?, ?, ?, ?)',
      [vendorId, 'Nurture Glow Official', '+8801700000000', true]
    );
  }

  const categories = await query('SELECT id, name FROM product_categories');
  const categoryMap = new Map(categories.map(row => [row.name, row.id]));

  const products = [
    { name: 'Prenatal Vitamins', category: 'Mother Care', price: 450, stock_qty: 50, image_url: 'https://picsum.photos/seed/vit/200' },
    { name: 'Folic Acid', category: 'Mother Care', price: 120, stock_qty: 100, image_url: 'https://picsum.photos/seed/folic/200' },
    { name: 'Baby Lotion', category: 'Baby Care', price: 320, stock_qty: 80, image_url: 'https://picsum.photos/seed/lotion/200' }
  ];

  for (const product of products) {
    const exists = await query('SELECT id FROM products WHERE name = ? LIMIT 1', [product.name]);
    if (!exists.length) {
      await query(
        'INSERT INTO products (id, vendor_id, category_id, name, price, stock_qty, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), vendorId, categoryMap.get(product.category), product.name, product.price, product.stock_qty, 'active', product.image_url]
      );
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('Seed complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
