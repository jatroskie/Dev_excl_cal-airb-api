const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const BROKER_URL = 'mqtt://localhost:1883'; // We know this works locally now
const LOG_FILE = path.join(__dirname, '../mqtt_dump.log');

console.log(`--- MQTT SNIFFER STARTING ---`);
console.log(`Target Broker: ${BROKER_URL}`);
console.log(`Log File: ${LOG_FILE}`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
    console.log('✅ Connected to Broker');
    client.subscribe('#', (err) => {
        if (!err) {
            console.log('✅ Subscribed to ALL topics (#)');
            console.log('Waiting for traffic... (Press Ctrl+C to stop)');
        }
    });
});

client.on('message', (topic, message, packet) => {
    const msgStr = message.toString();
    const isRetained = packet.retain;
    const logEntry = `[${new Date().toISOString()}] ${isRetained ? '[RETAINED] ' : ''}T: ${topic} | M: ${msgStr.substring(0, 100)}\n`;

    if (topic.includes('image')) {
        const imgLog = `[${new Date().toISOString()}] ${isRetained ? '[RETAINED] ' : ''}T: ${topic} | M: [BINARY IMAGE DATA]\n`;
        try { fs.appendFileSync(LOG_FILE, imgLog); } catch (e) { }
    } else {
        try { fs.appendFileSync(LOG_FILE, logEntry); } catch (e) { }
    }

    console.log(logEntry.trim());
});

client.on('error', (err) => {
    console.error('❌ MQTT Error:', err);
});
