const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function injectTQA() {
    const hotelId = 'TQA';
    console.log(`Injecting Rules for ${hotelId} (The Quarter)...`);

    const kbRef = db.collection('hotels').doc(hotelId).collection('knowledge_base');
    const hotelRef = db.collection('hotels').doc(hotelId);

    // Transcribed Text
    const wifiInfo = "Network: TQ415\nPassword: wifi2023b";

    const laundryRules = "LAUNDRY ON BALCONIES: Owners or occupiers shall not be entitled to hang their laundry on balconies or on any part of the building or the common property so as to be visible from outside the buildings or from any other sections. This includes objects such as buckets, spades and refuse bags.";

    const refuseRules = "REFUSE REMOVAL: Refuse needs to be taken down to the refuse room in P3. No refuse to be left in front of your door or in the fire escapes.";

    const noiseRules = "VISITORS, SOCIAL GATHERINGS, BEHAVIOUR AND NOISE: No visitors allowed for short term rentals. Owners are responsible for the correct and decent behaviour of all their occupants. Should the occupants behave in such a manner which is not acceptable by civilized standards, the occupants will be asked to vacate the apartment. Please respect the quiet times between 22H00 and 08H00.";

    const parkingRules = "PARKING: Please only park in allocated parking bays. Parking in an unauthorized parking bay will result in a penalty charge.";

    const smokingRules = "SMOKING POLICY: Smoking of marijuana is strictly forbidden in all the apartments OR on the balconies by residents. They will be asked to leave the building. Smoking of cigarettes is not allowed for short term rentals.";

    // 1. Update Legacy 'hotels' collection
    const fullRulesText = [
        wifiInfo,
        laundryRules,
        refuseRules,
        noiseRules,
        parkingRules,
        smokingRules
    ].join("\n\n");

    await hotelRef.set({
        houseRules: fullRulesText,
        wifi: { ssid: "TQ415", pass: "wifi2023b" }
    }, { merge: true });
    console.log(" - Updated hotels/TQA legacy fields (houseRules, wifi)");


    // 2. Update Knowledge Base (Agent)

    // Wifi
    await kbRef.doc('wifi').set({
        category: 'amenity',
        content: wifiInfo,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Laundry
    await kbRef.doc('rules_laundry').set({
        category: 'policy',
        content: laundryRules,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Refuse
    await kbRef.doc('rules_refuse').set({
        category: 'logistics',
        content: refuseRules,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Noise / Visitors
    await kbRef.doc('rules_noise_visitors').set({
        category: 'policy',
        content: noiseRules,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Parking
    await kbRef.doc('rules_parking').set({
        category: 'logistics',
        content: parkingRules,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Smoking
    await kbRef.doc('rules_smoking').set({
        category: 'policy',
        content: smokingRules,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(" - Updated Knowledge Base with categorized rules.");
    console.log("Injection Complete.");
}

injectTQA();
