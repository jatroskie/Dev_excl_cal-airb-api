require('dotenv').config();
const { WhatsAppHandler } = require('./src/whatsapp.js');

const config = {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    recipient: process.env.WHATSAPP_RECIPIENT_PHONE
};

async function testWhatsApp() {
    console.log('--- Testing WhatsApp Integration ---');
    console.log(`Using Phone ID: ${config.phoneId}`);
    console.log(`Sending to: ${config.recipient}`);

    const whatsapp = new WhatsAppHandler(config);

    try {
        await whatsapp.sendText(`🔔 *Yi Camera Test*\nThis is a test message from your Yi Outdoor Camera monitor script.\n\nTime: ${new Date().toLocaleTimeString()}`);
        console.log('Success! Check your phone.');
    } catch (error) {
        // Error is logged in handler
    }
}

testWhatsApp();
