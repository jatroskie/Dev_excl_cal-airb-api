require('dotenv').config();
const axios = require('axios');

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const recipient = process.env.WHATSAPP_RECIPIENT_PHONE;

async function testWhatsapp() {
    console.log(`Testing WhatsApp to ${recipient}...`);
    console.log(`Using Phone ID: ${phoneId}`);

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
            name: 'hello_world',
            language: { code: 'en_US' }
        }
    };

    try {
        const res = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('--- API RESPONSE ---');
        console.log(JSON.stringify(res.data, null, 2));
        console.log('--------------------');
    } catch (err) {
        console.error('--- API ERROR ---');
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    }
}

testWhatsapp();
