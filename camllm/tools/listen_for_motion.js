const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

console.log('[MOTION LISTENER] Waiting for camera events...');

client.on('connect', () => {
    client.subscribe('yicam/#');
});

client.on('message', (topic, message) => {
    const msg = message.toString();
    // Filter out the "command" echoes which are just settings
    if (topic.includes('cmnd')) return;

    console.log(`[EVENT] ${new Date().toLocaleTimeString()} | ${topic}: ${msg}`);

    if (msg.includes('motion_start') || topic.includes('motion_detection')) {
        console.log('>>> 🚨 MOTION DETECTED! SYSTEM SHOULD TRIGGER NOW 🚨 <<<');
    }
});
