require('dotenv').config();
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const recipient = process.env.WHATSAPP_RECIPIENT_PHONE;

async function testWhatsappText() {
    console.log(`Testing WhatsApp TEXT to ${recipient}...`);

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: "Test Message from CamLLM Debugger" }
    };

    try {
        const res = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('--- API RESPONSE (TEXT) ---');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('--- API ERROR (TEXT) ---');
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    }
}

testWhatsappText();
