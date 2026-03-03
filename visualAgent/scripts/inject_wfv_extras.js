const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function injectExtras() {
    const hotelId = 'WFV';
    console.log(`Injecting Extras for ${hotelId}...`);

    const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');

    // 1. Swimming Pools
    const poolContent = `Guests have access to five swimming pools.
The first pool is located between the Bannockburn and Carradale blocks. Private with sun loungers and three water features cascading into the pool, the Carradale pool is a study in tranquillity.
The second swimming pool is located at the entrance of the Ellesmere and Faulconier blocks. Bordering the waters of the canal, the smaller pool is adjacent to the Canal.
The third swimming pool is located on the third level between the Juliette C and Kylemore A blocks, boasting breathtaking views of Table Mountain and Signal Hill.
The fourth swimming pool is located on the third level between the Kylemore C and Lawhill blocks. Overlooking the One & Only Resort and island with villas.
The fifth swimming pool is located on the roof of the Quarterdeck gym, with spectacular views of the marina yacht basin.`;

    await kbRef.doc('amenities_pools_detailed').set({
        category: 'amenity',
        content: poolContent,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(" - Wrote: amenities_pools_detailed");

    // 2. Gym
    const gymContent = `The Quarterdeck gym is centrally located. The facilities in the Quarterdeck gym include state-of-the-art gym equipment including two treadmills, bicycles, rowing machines and more. There can’t be a better way to exercise than sitting on the rowing machine on the terrace, facing the splendid beauty of the marina.
The lap pool above the gym is a favourite with guests and is beautifully located, offering stunning views of the marina.
Personal gym instructors are available by appointment and our concierge will gladly make this booking for you.
The gym is open from 06h00 to 20h00 seven days a week including public holidays.
For any queries about the gym please enquire at Waterfront Village Reception.`;

    await kbRef.doc('amenities_gym_detailed').set({
        category: 'amenity',
        content: gymContent,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(" - Wrote: amenities_gym_detailed");

    console.log("Injection Complete.");
}

injectExtras();
