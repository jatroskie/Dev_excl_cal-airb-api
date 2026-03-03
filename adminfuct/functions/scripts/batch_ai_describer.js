const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');

// --- CONFIG ---
const PROJECT_ID = 'cal-airb-api';
const LOCATION = 'us-central1';
const MODEL_NAME = 'gemini-2.0-flash-exp'; // User requested Gemini 2.0
const SERVICE_ACCOUNT_PATH = '../service-account-key.json'; // Adjust path relative to script

// --- INIT ---
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Initialize Vertex AI
const vertex_ai = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertex_ai.preview.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
        'maxOutputTokens': 2048,
        'temperature': 0.4,
        'topP': 0.8,
        'topK': 40
    }
});

async function main() {
    console.log("Starting Batch Description Generation for TQA Rooms...");

    // 1. Get all TQA rooms
    const snapshot = await db.collection('rooms').get();
    const rooms = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (doc.id.startsWith('TQA')) {
            rooms.push({ id: doc.id, ...data });
        }
    });

    console.log(`Found ${rooms.length} TQA rooms.`);

    for (const room of rooms) {
        console.log(`\nProcessing Room: ${room.id}...`);

        // Skip if no images
        if (!room.imageUrls || room.imageUrls.length === 0) {
            console.log("   Skipping: No images found.");
            continue;
        }

        // 2. Prepare Images for Prompt
        // Gemini allows up to 16 images usually. Let's pick a diverse set (Cover + others)
        let imagesToUse = room.imageUrls.slice(0, 10); // Take first 10
        // Clean URLs if needed? Vertex SDK usually wants GCS URI (gs://) or base64.
        // If we have public URLs, we might need to convert or download.
        // Actually, for Server-side Vertex AI with access to the bucket, 
        // passing gs:// URIs is best if we have them. 
        // Our URLs are public https://storage.googleapis.com/BUCKET/path.
        // We can convert to gs://BUCKET/path easily.

        const imageParts = imagesToUse.map(img => {
            const url = img.url;
            // Convert https://storage.googleapis.com/cal-airb-api.firebasestorage.app/rooms/TQA-0301/...
            // To gs://cal-airb-api.firebasestorage.app/rooms/TQA-0301/...
            const gsUri = url.replace('https://storage.googleapis.com/', 'gs://');
            return {
                fileData: {
                    fileUri: gsUri,
                    mimeType: 'image/jpeg' // Assumption, or get from ext
                }
            };
        });

        // 3. Construct Prompt
        const ALLOWED_AMENITIES = [
            "Air-conditioning", "Bed linens", "Coffee", "Cooking basics (Pots and pans, oil, salt and pepper)",
            "Dedicated workspace", "Dishes and silverware (Bowls, chopsticks, plates, cups, etc.)",
            "Essentials (Towels, bed sheets, soap, and toilet paper)", "Freezer", "Heating", "Iron",
            "Kitchen", "Luggage drop-off allowed", "Microwave", "Free parking on premises", "Paid parking on premises",
            "Refrigerator", "Shampoo", "Smoke alarm", "Toaster", "TV", "Wifi", "Hot water", "Wine glasses",
            "Pool", "Gym", "Elevator", "Balcony", "Patio"
        ];

        const prompt = `
            You are an expert real estate copywriter.
            Attached are photos of a holiday rental unit in "The Quarter", De Waterkant, Cape Town.
            
            Task:
            1. Analyze the photos to identify key features.
            2. Write a short, catchy title/tagline (max 50 chars) -> "description50"
            3. Write a compelling, luxurious description (approx 500 chars) -> "description500"
            4. Select applicable amenities ONLY from the allowed list below. Do not invent new ones.
            
            Allowed Amenities:
            ${JSON.stringify(ALLOWED_AMENITIES)}
            
            Return ONLY valid JSON format:
            {
                "description50": "...",
                "description500": "...",
                "amenities": ["Wifi", "Kitchen"]
            }
        `;

        const request = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    ...imageParts
                ]
            }]
        };

        try {
            console.log(`   Sending ${imageParts.length} images to AI...`);
            const result = await model.generateContent(request);
            const response = await result.response;
            const text = response.candidates[0].content.parts[0].text;

            // Clean markdown jsons
            const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(jsonText);

            // FORCE DEFAULT AMENITIES
            if (!aiData.amenities) aiData.amenities = [];
            if (!aiData.amenities.includes('Wifi')) aiData.amenities.push('Wifi');

            console.log("   AI Generated:");
            console.log(`      Title: ${aiData.description50}`);
            console.log(`      Desc:  ${aiData.description500.substring(0, 50)}...`);
            console.log(`      Amenities: ${aiData.amenities.length} found.`);

            // 4. Update Firestore
            await db.collection('rooms').doc(room.id).update({
                description50: aiData.description50,
                description500: aiData.description500,
                amenities: aiData.amenities, // Save the array
                aiGeneratedAt: new Date().toISOString()
            });
            console.log("   Firestore Updated.");

        } catch (e) {
            console.error(`   ERROR processing ${room.id}:`, e.message);
        }
    }
}

main().then(() => {
    console.log("Batch Job Complete.");
    process.exit(0);
}).catch(e => {
    console.error("Fatal Error:", e);
    process.exit(1);
});
