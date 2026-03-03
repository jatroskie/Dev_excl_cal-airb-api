const onvif = require('node-onvif');

console.log('Starting ONVIF Discovery...');
onvif.startProbe().then((device_info_list) => {
    console.log(device_info_list.length + ' devices were found.');
    device_info_list.forEach((info) => {
        console.log('- ' + info.urn);
        console.log('  - name: ' + info.name);
        console.log('  - xaddrs: ' + info.xaddrs[0]);
    });
}).catch((error) => {
    console.error(error);
});
