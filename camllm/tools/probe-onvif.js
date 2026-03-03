const onvif = require('node-onvif');

console.log('--- ONVIF Deep Dive Probe ---');
console.log('Target: 192.168.0.113');
console.log('Trying with default credentials (admin/password)...');

// Create an OnvifDevice object
let device = new onvif.OnvifDevice({
  xaddr: 'http://192.168.0.113:80/onvif/device_service',
  user : 'admin', // DEFAULT - change if needed
  pass : 'password' // DEFAULT - change to correct password
});

// Initialize the OnvifDevice object
device.init().then((info) => {
  // Show the detailed information of the device.
  console.log(JSON.stringify(info, null, '  '));
  
  // Get the UDP Stream URL
  let url = device.getUdpStreamUrl();
  console.log('UDP Stream URL: ' + url);
  
}).catch((error) => {
  console.error('[!] Failed to initialize the device: ' + error.message);
  console.log('NOTE: If 401 Unauthorized, update the credentials in this script.');
});
