const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected to broker');

    // Publish Fake Motion
    console.log('Publishing FAKE MOTION event: yicam/motion_start');
    client.publish('yicam/motion_start', 'fake_trigger_from_test_script');

    // Also send status request
    client.publish('yicam/cmnd/status', 'status');

    setTimeout(() => {
        client.end();
    }, 1000);
});
