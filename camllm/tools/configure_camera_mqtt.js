const mqtt = require('mqtt');

// Connect to local broker
const client = mqtt.connect('mqtt://localhost:1883');
const TARGET_IP = '192.168.0.173'; // Your PC's IP

client.on('connect', () => {
    console.log('Connected! Sending configuration commands to camera...');

    // 1. Force Motion Detection ON
    client.publish('yicam/cmnd/motion_detection', 'on');
    client.publish('yicam/cmnd/mqtt_motion_detection', 'on');

    // 2. Set MQTT Server IP (If Yi-Hack supports this via MQTT)
    // NOTE: Yi-Hack usually requires web UI config for MQTT Broker IP.
    // However, we can try to "poke" it or at least log that we can't do it remotely easily.

    // 3. Request Config/Status to see what it knows
    client.publish('yicam/cmnd/get_config', 'all');
    client.publish('yicam/cmnd/status', 'status');

    console.log('Commands sent. Listening for response...');
});

client.on('message', (topic, message) => {
    console.log(`[${topic}] ${message.toString()}`);
});

setTimeout(() => {
    console.log('Done.');
    client.end();
}, 5000);
