const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    const topic = 'yicam/motion_detection';
    const message = 'motion_start';

    console.log(`Publishing to ${topic}: ${message}`);
    client.publish(topic, message, {}, (err) => {
        if (err) console.error('Publish error:', err);
        else console.log('Message published.');

        setTimeout(() => {
            client.end();
            console.log('Done.');
        }, 1000);
    });
});
