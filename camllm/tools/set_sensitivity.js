const mqtt = require('mqtt');

// Connect to local broker (0.0.0.0 fix is active, so localhost works for us)
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected to MQTT Broker.');

    const topicSensitivity = 'yicam/cmnd/sensitivity';
    const topicMotion = 'yicam/cmnd/motion_detection';

    console.log(`Setting Sensitivity to HIGH...`);

    // Try multiple known topics for Yi-Hack
    client.publish('yicam/cmnd/sensitivity', 'high');
    client.publish('yicam/cmnd/set_sensitivity', 'high');
    client.publish('yicam/cmnd/motion_sensitivity', 'high');

    // Ensure Motion Detection is ON
    client.publish('yicam/cmnd/motion_detection', 'on');

    console.log('Commands sent. Disconnecting in 2s...');
    setTimeout(() => {
        client.end();
        process.exit(0);
    }, 2000);
});
