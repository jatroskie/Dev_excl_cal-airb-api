require('dotenv').config();
const { AIHandler } = require('./src/ai.js');
const axios = require('axios');

const config = {
    ip: process.env.CAMERA_IP,
    user: process.env.CAMERA_USER,
    pass: process.env.CAMERA_PASS,
    geminiKey: process.env.GEMINI_API_KEY
};

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to fetch using system curl
function fetchSnapshotCurl(url, user, pass) {
    return new Promise((resolve, reject) => {
        // -s = silent, --fail = fail on errors
        const cmd = `curl -s --fail -u "${user}:${pass}" "${url}" --output snapshot.jpg`;
        console.log('Running:', cmd);

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Curl error: ${error.message}`);
                return reject(error);
            }
            try {
                const buffer = fs.readFileSync('snapshot.jpg');
                resolve(buffer);
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function testAI() {
    console.log('--- Testing AI Integration (via Curl) ---');

    // 1. Fetch Snapshot
    const url = `http://${config.ip}/cgi-bin/snapshot.sh?res=low`; // Try low res first for speed
    console.log(`Fetching snapshot from: ${url}`);

    let imageBuffer;
    try {
        imageBuffer = await fetchSnapshotCurl(url, config.user, config.pass);
        console.log(`Snapshot fetched (${imageBuffer.length} bytes).`);
    } catch (error) {
        console.error('Failed to fetch snapshot:', error.message);
        return;
    }

    // 2. Analyze with Gemini
    console.log('Sending to Gemini...');
    const ai = new AIHandler(config.geminiKey);
    const description = await ai.describeImage(imageBuffer);

    console.log('\n--- AI Description ---');
    console.log(description);
    console.log('----------------------\n');
}

testAI();
