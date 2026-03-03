require('dotenv').config();
const axios = require('axios');
const onvif = require('node-onvif');

const config = {
    ip: process.env.CAMERA_IP,
    user: process.env.CAMERA_USER,
    pass: process.env.CAMERA_PASS
};

console.log(`Config: IP=${config.ip}, User=${config.user}, Pass=***`);

async function testSnapshot() {
    console.log('--- Testing Snapshot ---');
    // Use Basic Auth in URL to bypass axios auth issues if any, or standard auth header
    const url = `http://${config.ip}/cgi-bin/snapshot.sh?res=high`;
    console.log(`Fetching: ${url}`);
    try {
        const response = await axios.get(url, {
            auth: { username: config.user, password: config.pass },
            responseType: 'arraybuffer',
            timeout: 5000
        });
        console.log(`Success! Got ${response.data.length} bytes.`);
    } catch (error) {
        console.error('Snapshot Failed:', error.message);
        if (error.response) console.error('Status:', error.response.status, error.response.statusText);
    }
}

async function testOnvif() {
    console.log('--- Testing ONVIF (Port 80 Direct) ---');
    // Yi-hack often uses port 80 for ONVIF service
    const device = new onvif.OnvifDevice({
        xaddr: `http://${config.ip}:80/onvif/device_service`,
        user: config.user,
        pass: config.pass
    });

    return new Promise((resolve) => {
        device.init((err) => {
            if (err) {
                console.error('ONVIF Init Failed:', err.message);
                if (err.code) console.error('Code:', err.code);
                // Print full error structure if seemingly generic
                console.error('Full Error:', JSON.stringify(err, null, 2));
                resolve(false);
            } else {
                console.log('ONVIF Connected!');
                console.log('Name:', device.getInformation().name);
                resolve(true);
            }
        });
    });
}

async function run() {
    await testSnapshot();
    await testOnvif();
}

run();
