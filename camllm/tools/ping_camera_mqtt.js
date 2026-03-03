const mqtt = require('mqtt');

const CLIENT_ID = 'mqtt-pinger-' + Math.random().toString(16).substr(2, 8);
const client = mqtt.connect('mqtt://localhost:1883', { clientId: CLIENT_ID });

console.log(`[${CLIENT_ID}] Connecting to broker...`);

client.on('connect', () => {
    console.log('Connected. Subscribing to yicam/# ...');
    client.subscribe('yicam/#', (err) => {
        if (err) return console.error('Sub error:', err);

        console.log('Sending STATUS command to camera...');
        // Publish status command
        client.publish('yicam/cmnd/status', 'status');
    });
});

client.on('message', (topic, message) => {
    console.log(`[REPLY] Topic: ${topic} | Msg: ${message.toString()}`);
    if (topic.includes('status') && !topic.includes('cmnd')) {
        console.log('SUCCESS: Camera replied!');
        process.exit(0);
    }
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('TIMEOUT: No reply from camera in 10s.');
    process.exit(1);
}, 10000);
