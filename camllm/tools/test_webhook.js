const axios = require('axios');

async function testWebhook() {
    const url = 'https://vacprop.com/api/camllm';
    console.log(`Testing Webhook: ${url}`);

    const payload = {
        id: 'yi-outdoor-1',
        timestamp: new Date().toISOString(),
        description: 'TEST EVENT - Checking Website Display',
        imageUrl: 'https://via.placeholder.com/640x360.png?text=Camera+Test',
        camera_config: { id: 'yi-outdoor-1' }
    };

    try {
        const res = await axios.post(url, payload);
        console.log(`Status: ${res.status}`);
        console.log(`Data: ${JSON.stringify(res.data)}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        if (err.response) {
            console.error(`Response: ${res.response.status}`);
            console.error(JSON.stringify(err.response.data));
        }
    }
}

testWebhook();
