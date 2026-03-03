const mqtt = require('mqtt');

// Connect to local broker
console.log("Connecting to MQTT broker at mqtt://localhost:1883...");
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected! Subscribing to ALL topics (#)...');
    client.subscribe('#', (err) => {
        if (!err) {
            console.log('Subscribed to everything. Waiting for messages...');
            console.log('--- PLEASE WALK IN FRONT OF THE CAMERA NOW ---');
        } else {
            console.error('Subscription error:', err);
        }
    });
});

client.on('message', (topic, message) => {
    // Convert buffer to string
    const msgStr = message.toString();
    const isImage = topic.includes('image') || msgStr.length > 500;

    // Log topic and payload (truncated if image)
    if (isImage) {
        console.log(`[${new Date().toLocaleTimeString()}] Topic: ${topic} | Payload: [IMAGE/BINARY DATA (${message.length} bytes)]`);
    } else {
        console.log(`[${new Date().toLocaleTimeString()}] Topic: ${topic} | Payload: ${msgStr}`);
    }
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
