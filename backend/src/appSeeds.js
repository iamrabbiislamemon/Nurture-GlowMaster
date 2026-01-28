export const SEED_DOCTORS = [
  {
    id: 'd1',
    name: 'Dr. Arifa Begum',
    specialty: 'Gynaecologist',
    hospital: 'Dhaka Medical',
    location: 'Dhaka',
    fee: 1000,
    image: 'https://picsum.photos/seed/doc1/200',
    availableSlots: ['09:00 AM', '10:30 AM', '04:00 PM'],
    type: 'Both'
  },
  {
    id: 'd2',
    name: 'Dr. Mahbub Rahman',
    specialty: 'Pediatrician',
    hospital: 'Square Hospital',
    location: 'Dhaka',
    fee: 1200,
    image: 'https://picsum.photos/seed/doc2/200',
    availableSlots: ['11:00 AM', '01:00 PM', '05:30 PM'],
    type: 'Offline'
  },
  {
    id: 'd3',
    name: 'Dr. Nusrat Jahan',
    specialty: 'Nutritionist',
    hospital: 'Labaid Hospital',
    location: 'Dhaka',
    fee: 800,
    image: 'https://picsum.photos/seed/doc3/200',
    availableSlots: ['08:00 AM', '12:00 PM', '06:00 PM'],
    type: 'Online'
  }
];

export const SEED_HOSPITALS = [
  {
    id: 'h1',
    name: 'Dhaka Medical College',
    location: 'Ramna, Dhaka',
    contact: '+88029669340',
    type: 'Public',
    beds: 'Limited',
    lat: 23.7258,
    lng: 90.3976
  },
  {
    id: 'h2',
    name: 'Square Hospital',
    location: 'Panthapath, Dhaka',
    contact: '+88028144400',
    type: 'Private',
    beds: 'Available',
    lat: 23.7507,
    lng: 90.3879
  },
  {
    id: 'h3',
    name: 'Evercare Hospital',
    location: 'Bashundhara, Dhaka',
    contact: '+88028401661',
    type: 'Private',
    beds: 'Available',
    lat: 23.8124,
    lng: 90.4326
  },
  {
    id: 'h4',
    name: 'United Hospital',
    location: 'Gulshan, Dhaka',
    contact: '+88029853333',
    type: 'Private',
    beds: 'Limited',
    lat: 23.8014,
    lng: 90.4184
  }
];

export const SEED_MEDICINES = [
  {
    id: 'm1',
    name: 'Prenatal Vitamins',
    price: 450,
    image: 'https://picsum.photos/seed/vit/200',
    category: 'Supplements'
  },
  {
    id: 'm2',
    name: 'Folic Acid',
    price: 120,
    image: 'https://picsum.photos/seed/folic/200',
    category: 'Supplements'
  },
  {
    id: 'm3',
    name: 'Baby Lotion',
    price: 320,
    image: 'https://picsum.photos/seed/lotion/200',
    category: 'Baby Care'
  }
];

export const SEED_DONORS = [
  {
    id: 'bd1',
    name: 'Tanvir Ahmed',
    bloodGroup: 'O+',
    location: 'Banani, Dhaka',
    phone: '+8801711223344',
    verified: true
  },
  {
    id: 'bd2',
    name: 'Nabila Karim',
    bloodGroup: 'B+',
    location: 'Dhanmondi, Dhaka',
    phone: '+8801811223344',
    verified: true
  },
  {
    id: 'bd3',
    name: 'Sajid Islam',
    bloodGroup: 'A-',
    location: 'Gulshan, Dhaka',
    phone: '+8801911223344',
    verified: false
  }
];
