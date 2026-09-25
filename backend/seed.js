module.exports = [
      {
        id: 'kolaghat-rural',
        name: 'Kolaghat Rural Hospital',
        category: 'Government Trauma Care',
        lat: 22.4285,
        lng: 87.8715,
        address: 'Kolaghat Block Hospital Rd, Purba Medinipur, WB',
        phone: '+91 3228 255222',
        emergencyLine: '03228-255222',
        distanceKm: 1.2,
        icuBeds: 6,
        ventilators: 4,
        generalBeds: 45,
        rating: 4.6,
        bloodStock: { 'O-': 6, 'O+': 18, 'A+': 12, 'B+': 16, 'AB+': 8 },
        organs: [
          { organ: 'Cornea Tissue (Eye)', count: 2, status: 'Matching Ready' },
          { organ: 'Kidney Recipient List', count: 1, status: 'Donor Matching' }
        ],
        doctors: [
          { name: 'Dr. Debabrata Sen', spec: 'Trauma', designation: 'Emergency Surgery Lead', status: 'On Duty' },
          { name: 'Dr. Priyanka Maiti', spec: 'Cardiology', designation: 'Critical Care Cardiologist', status: 'On Duty' },
          { name: 'Dr. Subhash Bose', spec: 'Critical Care', designation: 'Chief Anesthetist', status: 'In ICU' }
        ]
      },
      {
        id: 'ktpp-medical',
        name: 'KTPP Medical Unit',
        category: 'Thermal Power Township Hospital',
        lat: 22.4168,
        lng: 87.8824,
        address: 'KTPP Township Campus, Mecheda Sector, WB',
        phone: '+91 3228 250100',
        emergencyLine: '03228-250100',
        distanceKm: 2.8,
        icuBeds: 4,
        ventilators: 2,
        generalBeds: 30,
        rating: 4.4,
        bloodStock: { 'O-': 3, 'O+': 12, 'A+': 9, 'B+': 11, 'AB+': 4 },
        organs: [
          { organ: 'Cornea Tissue (Eye)', count: 1, status: 'Harvesting Ready' }
        ],
        doctors: [
          { name: 'Dr. Anirban Ghosh', spec: 'Trauma', designation: 'Industrial Emergency Specialist', status: 'On Duty' },
          { name: 'Dr. Sharmila Das', spec: 'Critical Care', designation: 'General Medicine Lead', status: 'On Duty' }
        ]
      },
      {
        id: 'shusrusha-seva',
        name: 'Shusrusha Shishu Seva Niketan',
        category: 'Specialized Maternity & Pediatric Care',
        lat: 22.4350,
        lng: 87.8680,
        address: 'National Highway 6 Crossing, Kolaghat, WB',
        phone: '+91 98321 44550',
        emergencyLine: '+91 98321 44550',
        distanceKm: 1.8,
        icuBeds: 8, // NICU/PICU
        ventilators: 5,
        generalBeds: 40,
        rating: 4.7,
        bloodStock: { 'O-': 4, 'O+': 15, 'A+': 14, 'B+': 20, 'AB+': 7 },
        organs: [],
        doctors: [
          { name: 'Dr. Kakali Roy', spec: 'Pediatrics', designation: 'Senior Neonatologist', status: 'On Duty' },
          { name: 'Dr. Rajib Mukherjee', spec: 'Pediatrics', designation: 'Pediatric Surgeon', status: 'On Duty' }
        ]
      },
      {
        id: 'apollo-clinic',
        name: 'Apollo Hospital & Emergency Clinic',
        category: 'Multi-Specialty Private Clinic',
        lat: 22.4310,
        lng: 87.8760,
        address: 'Near Old Bus Stand, Kolaghat Main Road, WB',
        phone: '+91 3228 256888',
        emergencyLine: '03228-256888',
        distanceKm: 2.1,
        icuBeds: 5,
        ventilators: 3,
        generalBeds: 25,
        rating: 4.5,
        bloodStock: { 'O-': 2, 'O+': 10, 'A+': 8, 'B+': 14, 'AB+': 5 },
        organs: [
          { organ: 'Liver Registry Check', count: 1, status: 'Crossmatch Waitlist' }
        ],
        doctors: [
          { name: 'Dr. S. K. Bhattacharya', spec: 'Cardiology', designation: 'Interventional Cardiologist', status: 'On Duty' },
          { name: 'Dr. Tanmoy Samanta', spec: 'Trauma', designation: 'Orthopedic Trauma Surgeon', status: 'On Duty' }
        ]
      },
      {
        id: 'tamluk-hospital',
        name: 'Tamluk Super-Speciality Hospital',
        category: 'District Apex Referral Centre',
        lat: 22.2986,
        lng: 87.9285,
        address: 'Tamluk District Headquarter, Purba Medinipur, WB',
        phone: '+91 3228 266001',
        emergencyLine: '03228-266001',
        distanceKm: 14.5,
        icuBeds: 24,
        ventilators: 16,
        generalBeds: 180,
        rating: 4.8,
        bloodStock: { 'O-': 14, 'O+': 45, 'A+': 38, 'B+': 52, 'AB+': 22 },
        organs: [
          { organ: 'Kidney Matched Donors', count: 3, status: 'Green Corridor Ready' },
          { organ: 'Cornea Bank', count: 6, status: 'Immediate Allocation' }
        ],
        doctors: [
          { name: 'Dr. Manas Chakraborty', spec: 'Trauma', designation: 'Chief Trauma Director', status: 'In Surgery' },
          { name: 'Dr. Sujata Mukherjee', spec: 'Cardiology', designation: 'Cath Lab Director', status: 'On Duty' },
          { name: 'Dr. Arnab Nandi', spec: 'Critical Care', designation: 'ICU Head', status: 'On Duty' }
        ]
      }
    ];
