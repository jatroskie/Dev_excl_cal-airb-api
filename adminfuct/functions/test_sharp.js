try {
    const sharp = require('sharp');
    console.log('Sharp is working:', sharp.versions);
} catch (e) {
    console.error('Sharp failed:', e.message);
    process.exit(1);
}
