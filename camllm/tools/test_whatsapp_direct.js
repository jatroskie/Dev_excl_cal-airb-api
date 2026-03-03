const { WhatsAppHandler } = require('../src/whatsapp');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function test() {
    // Fetch valid token from Firestore
    const doc = await db.collection('cameras').doc('yi-outdoor-1').get();
    if (!doc.exists) { console.error('No camera doc found'); return; }

    const data = doc.data();
    const token = data.whatsapp_token; // Assuming user put it here? 
    // Wait, the user said "updated the whatrsapp token in the app". 
    // Did they update 'whatsapp_token' field or 'token' field?
    // Let's check both or print what we find.

    // In src/index.js: const currentToken = config.whatsapp_token || globalConfig.whatsapp.token;

    const validToken = data.whatsapp_token || process.env.WHATSAPP_ACCESS_TOKEN;

    console.log(`Using token: ${validToken ? validToken.substring(0, 10) + '...' : 'None'}`);

    const config = {
        token: validToken,
        phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        recipient: '27828820100'
    };

    console.log(`Sending test text to ${config.recipient}...`);
    const handler = new WhatsAppHandler(config);

    // Explicitly using the updated token if user updated it in UpdateCameraConfig but NOT in .env
    // We should check where the token is actually being pulled from.
    // The main app loads it from process.env or the camera config.
    // Let's assume the user updated it in the 'UpdateCameraConfig' tool which writes to FIRESTORE.
    // But the app might be reading from .env for the default?
    // Wait, src/index.js: 
    // const currentToken = config.whatsapp_token || globalConfig.whatsapp.token;

    // If the user updated the "app", they might have meant the .env file? 
    // Or they used the tool? 
    // The previous tool usage `update_camera_config.js` did NOT update the whatsapp token in firestore.
    // It only updated credentials.

    // Wait, step 283 output shows:
    // WA config: { ... whatsapp_recipient: '27828820100', ... }
    // It does NOT show a 'whatsapp_token' in the firestore doc.
    // So it falls back to `globalConfig.whatsapp.token` which comes from `process.env`.

    // IF the user pushed a new token, they probably edited the .env file? 
    // Or did they expect me to update it? 

    // Let's try to read the .env file to see if it's there.

    try {
        console.log(`Sending test text to ${config.recipient}...`);
        const result = await handler.sendText('Test from camllm', config.recipient, config.token);
        console.log('WhatsApp Send Success:', JSON.stringify(result, null, 2));
    } catch (error) {
        if (error.response) {
            console.error('WhatsApp Send Failed (Response):', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('WhatsApp Send Failed (Error):', error.message);
        }

        // Try Template as fallback
        try {
            console.log(`Attempting Template fallback to ${config.recipient}...`);
            const result = await handler.sendTemplate('hello_world', 'en_US', config.recipient, config.token);
            console.log('WhatsApp Template Success:', JSON.stringify(result, null, 2));
        } catch (templateError) {
            if (templateError.response) {
                console.error('WhatsApp Template Failed (Response):', JSON.stringify(templateError.response.data, null, 2));
            } else {
                console.error('WhatsApp Template Failed (Error):', templateError.message);
            }
        }
    }
}

test();
