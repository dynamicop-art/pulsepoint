// db.js
const fs = require('fs');

const prefixes = [
  'City', 'Metro', 'Apex', 'Global', 'St. Jude', 'Care', 'Lifeline', 'Prime',
  'Sunrise', 'Hope', 'Trinity', 'Universal', 'Apollo', 'Fortis', 'Mercy', 'Heritage'
];

const types = [
  'General Hospital', 'Multispecialty Clinic', 'Super Speciality Hospital',
  'Medical Center', 'Institute of Medical Sciences', 'Healthcare & Research Institute'
];

const cities = [
  { city: 'Mumbai', state: 'Maharashtra', zipBase: 400001 },
  { city: 'Delhi', state: 'Delhi', zipBase: 110001 },
  { city: 'Bengaluru', state: 'Karnataka', zipBase: 560001 },
  { city: 'Kolkata', state: 'West Bengal', zipBase: 700001 },
  { city: 'Chennai', state: 'Tamil Nadu', zipBase: 600001 },
  { city: 'Hyderabad', state: 'Telangana', zipBase: 500001 },
  { city: 'Pune', state: 'Maharashtra', zipBase: 411001 },
  { city: 'Ahmedabad', state: 'Gujarat', zipBase: 380001 }
];

const departmentsPool = [
  'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
  'Oncology', 'Emergency Care', 'Gastroenterology', 'Dermatology'
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubset(arr, min = 2, max = 5) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateHospitals(count = 1500) {
  const hospitals = [];

  for (let i = 1; i <= count; i++) {
    const loc = getRandomElement(cities);
    const prefix = getRandomElement(prefixes);
    const type = getRandomElement(types);
    const hospitalName = `${prefix} ${type} - Unit ${i}`;
    
    hospitals.push({
      id: `HOSP-${10000 + i}`,
      name: hospitalName,
      type: type,
      totalBeds: Math.floor(Math.random() * (800 - 50 + 1)) + 50,
      availableBeds: Math.floor(Math.random() * 45),
      icuBeds: Math.floor(Math.random() * (80 - 10 + 1)) + 10,
      rating: parseFloat((Math.random() * (5.0 - 3.2) + 3.2).toFixed(1)),
      departments: getRandomSubset(departmentsPool),
      contact: {
        phone: `+91 ${Math.floor(6000000000 + Math.random() * 3999999999)}`,
        email: `contact@${prefix.toLowerCase().replace(/[^a-z]/g, '')}${i}.org`
      },
      address: {
        street: `Plot ${Math.floor(Math.random() * 900) + 1}, Sector ${Math.floor(Math.random() * 40) + 1}`,
        city: loc.city,
        state: loc.state,
        pincode: loc.zipBase + Math.floor(Math.random() * 50)
      },
      emergencyAvailable: Math.random() > 0.15
    });
  }

  return hospitals;
}

const hospitalsData = generateHospitals(1500);

// Export for direct use in Node/Express or JSON-Server
module.exports = () => ({
  hospitals: hospitalsData
});