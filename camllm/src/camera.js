const onvif = require('node-onvif');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class Camera {
    constructor(config) {
        this.ip = config.ip;
        this.user = config.user;
        this.pass = config.pass;
        this.device = null;
    }

    async init() {
        console.log(`Connecting to camera at ${this.ip}...`);

        this.device = new onvif.OnvifDevice({
            xaddr: `http://${this.ip}/onvif/device_service`,
            user: this.user,
            pass: this.pass
        });

        return new Promise((resolve, reject) => {
            this.device.init((err) => {
                if (err) {
                    console.error('ONVIF Init Error:', JSON.stringify(err, null, 2));
                    return reject(err);
                }
                console.log('ONVIF Device initialized.');
                console.log('Device Information:', JSON.stringify(this.device.getInformation(), null, 2));
                resolve();
            });
        });
    }
}

module.exports = { Camera };
