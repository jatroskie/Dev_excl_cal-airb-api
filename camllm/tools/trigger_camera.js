const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected to MQTT. Sending Status Request...');
    client.subscribe('yicam/#', (err) => {
        if (err) console.error(err);

        // Publish a request that forces a reply
        // 'status' command usually makes the camera reply with its status
        client.publish('yicam/cmnd/status', 'status');
        // Also try a config get
        client.publish('yicam/cmnd/get_config', 'all');
    });
});

client.on('message', (topic, message) => {
    console.log(`[REPLY] ${topic}: ${message.toString()}`);
    // If we get a real status reply, we know it's alive
});

setTimeout(() => {
    console.log('Timeout. Exiting.');
    process.exit(0);
}, 10000);
