const fetch = require('node-fetch');
require('dotenv').config();

const config = {
    ip: process.env.CAMERA_IP,
    user: process.env.CAMERA_USER,
    pass: process.env.CAMERA_PASS
};

async function run() {
    const url = `http://${config.ip}/cgi-bin/snapshot.sh?res=high`;
    console.log(`Fetching: ${url}`);

    // Basic Auth Header
    const auth = Buffer.from(`${config.user}:${config.pass}`).toString('base64');

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`
            },
            timeout: 10000
        });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        const buffer = await response.buffer();
        console.log(`Success! Got ${buffer.length} bytes.`);
    } catch (error) {
        console.error('Fetch Failed:', error);
    }
}

run();
