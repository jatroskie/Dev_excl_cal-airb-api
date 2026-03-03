const WebSocket = require('ws');

const url = 'ws://localhost:9999/yi-outdoor-1';
console.log('Testing connection to:', url, 'with protocol jsmpeg');

const ws = new WebSocket(url, 'jsmpeg');

ws.on('open', function open() {
    console.log('SUCCESS: Connected to local WebSocket server!');
    // Send a dummy stop signal or just close
    setTimeout(() => ws.close(), 1000);
});

ws.on('message', function incoming(data) {
    console.log('SUCCESS: Received data from server, size:', data.length, 'bytes');
});

ws.on('error', function error(err) {
    console.error('ERROR: Failed to connect or encountered error:', err.message);
});

ws.on('close', function close(code, reason) {
    console.log('CLOSED:', code, reason.toString());
});
