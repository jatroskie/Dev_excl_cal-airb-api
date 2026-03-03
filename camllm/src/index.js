const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
require('dotenv').config();
const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const axios = require('axios');
const { AIHandler } = require('./ai');
const { WhatsAppHandler } = require('./whatsapp');


// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'cal-airb-api.firebasestorage.app'
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

// DEBUG LOGGING
function logDebug(msg) {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  try { fs.appendFileSync('ai.log', entry); } catch (e) { }
}

// Configuration & State
const activeMonitors = new Map();
let globalConfig = {
  aiKey: process.env.GEMINI_API_KEY,
  whatsapp: {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    recipient: process.env.WHATSAPP_RECIPIENT_PHONE
  },
  webhook: {
    enabled: true, // Re-enabling for Web Dashboard
    url: 'https://vacprop.com/api/camllm'
  }
};

const ai = new AIHandler(globalConfig.aiKey);
const whatsapp = new WhatsAppHandler(globalConfig.whatsapp);


// RTSP Capture Helper (Replaces HTTP Snapshot)
const sharp = require('sharp');

// RTSP Capture Helper (Replaces HTTP Snapshot)
// LOGIC: Always capture FULL frame. Crop locally if needed.
// HTTP Snapshot Helper
async function fetchSnapshot(config) {
  // Use HTTP API for snapshot
  const snapshotUrl = `http://${config.ip}/cgi-bin/snapshot.sh?res=high`;
  console.log(`   [${config.id}] Capturing frame from ${snapshotUrl}...`);

  const requestOptions = { responseType: 'arraybuffer', timeout: 10000 };
  if (config.user && config.user.trim() !== '') {
    requestOptions.auth = { username: config.user, password: config.pass };
  }

  const response = await axios.get(snapshotUrl, requestOptions);
  const fullBuffer = Buffer.from(response.data);

  if (fullBuffer.length < 1000) {
    throw new Error("Captured image is too small or invalid.");
  }

  // If crop is configured, use Sharp to extract region
  if (config.crop && config.crop.includes(":")) {
    try {
      const parts = config.crop.split(":");
      const w = parseInt(parts[0]);
      const h = parseInt(parts[1]);
      const x = parseInt(parts[2]);
      const y = parseInt(parts[3]);

      console.log(`   [${config.id}] Generating Crop for AI: ${w}x${h} at ${x},${y}`);
      const croppedBuffer = await sharp(fullBuffer)
        .extract({ left: x, top: y, width: w, height: h })
        .toBuffer();

      return { full: fullBuffer, cropped: croppedBuffer };
    } catch (e) {
      console.error(`   [${config.id}] Crop Error (Sharp): ${e.message}. Using Full.`);
      return { full: fullBuffer, cropped: fullBuffer };
    }
  }

  // No crop? AI gets full buffer
  return { full: fullBuffer, cropped: fullBuffer };
}

// Helper: Upload Snapshot
async function uploadSnapshot(buffer, date, cameraId) {
  const filename = `camera_snapshots/${date.toISOString().split('T')[0]}/${cameraId}/${date.getTime()}.jpg`;
  const file = bucket.file(filename);
  await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
  return file.publicUrl();
}

// Helper: Analyze
async function analyzeImage(buffer, prompt) {
  return await ai.describeImage(buffer, "image/jpeg", prompt);
}

// Individual Camera Loop
// PURE CLIENT MODE (Using Standard Mosquitto Broker)
const mqtt = require('mqtt');
const mqttClient = mqtt.connect('mqtt://localhost:1883', {
  // If Mosquitto requires auth, add username/password here
  // username: 'jatroskie', password: '...'
});

mqttClient.on('connect', () => {
  console.log(`[MQTT Client] Connected to Mosquitto Broker!`);

  // Subscribe to camera motion events
  mqttClient.subscribe('yicam/#', (err) => {
    if (!err) console.log(`[MQTT Client] Subscribed to 'yicam/#'`);
  });

  // FORCE ENABLE MOTION DETECTION (Arming the Camera)
  // Common topics for Yi-Hack
  console.log("[MQTT Client] Sending ARM commands to camera...");
  mqttClient.publish('yicam/cmnd/motion_detection', 'on');
  mqttClient.publish('yicam/cmnd/mqtt_motion_detection', 'on');
  mqttClient.publish('yicam/cmnd/status', 'status'); // Request status
});

mqttClient.on('message', (topic, message, packet) => {
  // message is Buffer
  const msgStr = message.toString();

  // RAW LOGGING (Safeguarded)
  try {
    const isImage = topic.includes('image') || msgStr.length > 500;
    const isRetained = packet.retain;
    const logContent = isImage ? '[BINARY IMAGE DATA - TRUNCATED]' : msgStr;
    const rawLog = `[${new Date().toISOString()}] ${isRetained ? '[RETAINED] ' : ''}${topic}: ${logContent}\n`;
    fs.appendFileSync('mqtt_raw.log', rawLog);

    // Console log safely
    console.log(`[MQTT Recv] ${isRetained ? '[RETAINED] ' : ''}${topic}: ${logContent.substring(0, 100)}${logContent.length > 100 ? '...' : ''}`);
  } catch (e) { }

  // Check for motion topics OR messages (but IGNORE motion_files and cmnd)
  // strict check: payload must contain 'motion_start' OR topic must end in 'motion' (but not cmnd)
  const isMotionTopic = topic.includes('motion') && !topic.includes('cmnd') && !topic.includes('files');
  const isMotionPayload = msgStr.includes('motion_start');

  if (isMotionTopic || isMotionPayload) {
    console.log(`[MQTT] 🚨 MOTION DETECTED via Mosquitto!`);

    // Trigger generic handler or parse camera ID from topic?
    // If topic is 'yicam/motion_start', we don't know WHICH camera if multiple sharing prefix.
    // Usually topic is: yi-cam-ID/motion_start. 
    // User config showed prefix 'yicam'.
    // Let's iterate all ACTIVE monitors and trigger them?
    // Or check if message payload has ID?
    // For single camera setup, trigger ALL active.

    activeMonitors.forEach((state, id) => {
      console.log(`[${id}] Triggered by MQTT! Capturing...`);
      monitorCamera(state.config, true);
    });
  }
});

mqttClient.on('error', (err) => {
  console.error(`[MQTT Client Error] ${err.message}`);
});

// Updated Monitor Function (Event Driven)
async function monitorCamera(config, isEventTriggered = false) {
  const { id, prompt, active } = config;
  const state = activeMonitors.get(id);

  if (!active) return;

  // Debounce: If already processing, skip (unless it's a new event and previous is stale?)
  if (state.isProcessing) {
    console.log(`[${id}] Busy processing previous event.`);
    return;
  }

  // Enforce overall Cooldown BEFORE AI / Video Capture to prevent 429 Rate Limits
  const now = Date.now();
  const lastScanned = state.lastScanned || 0;
  const SCAN_COOLDOWN = Math.max((config.alert_frequency || 60) * 1000, 20000); // minimum 20s

  if (now - lastScanned <= SCAN_COOLDOWN) {
    console.log(`[${new Date().toLocaleTimeString()}] [${id}] Ignored event, AI cooling down (${Math.round((SCAN_COOLDOWN - (now - lastScanned)) / 1000)}s remaining)...`);
    return;
  }
  state.lastScanned = now;

  state.isProcessing = true;

  try {
    console.log(`[${new Date().toLocaleTimeString()}] [${id}] Processing Event...`);

    // 0. Start Recording (Parallel) - 10 seconds default
    const { videoPromise, cancel: cancelVideo } = recordVideo(config, 10);

    // 1. Capture
    const { full, cropped } = await fetchSnapshot(config);

    // 2. Analyze
    let description = "Error";
    try {
      // Debug save
      fs.writeFileSync('debug_crop_last.jpg', cropped);
      description = await analyzeImage(cropped, prompt);
    } catch (err) {
      console.error(`AI Error: ${err.message}`);
      description = "Motion Detected (AI Unavailable)";
    }

    console.log(`   [${id}] AI: "${description}"`);

    // 3. Act
    const isInteresting = description && !description.includes("CLEAR") && !description.includes("Error");
    const isWarning = description.includes("WARNING");
    let videoUrl = null;

    // Handle Video Decision
    if (isWarning) {
      console.log(`   [${id}] WARNING Detected! Waiting for video capture...`);
      try {
        const videoPath = await videoPromise;
        if (videoPath && fs.existsSync(videoPath)) {
          videoUrl = await uploadVideo(videoPath, new Date(), id);
          console.log('   > Video uploaded:', videoUrl);
        }
      } catch (e) { console.error("Video processing failed", e.message); }
    } else {
      cancelVideo(); // Kill and delete
    }

    if (config.save_all || isInteresting) {
      // Check Cooldown
      const now = Date.now();
      const lastAlert = state.lastAlert || 0;
      const COOLDOWN = (config.alert_frequency || 60) * 1000;

      const dateObj = new Date();
      let imageUrl = null;

      // Upload (Only if NOT clear)
      try {
        if (!description.includes("CLEAR")) {
          imageUrl = await uploadSnapshot(full, dateObj, id);
          console.log('   > Image uploaded:', imageUrl);
        } else {
          console.log('   > Skipped upload (CLEAR event)');
        }
      } catch (e) { console.error("Upload failed", e.message); }

      // Log to DB
      await db.collection('camera_events').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: description,
        device: id,
        imageUrl: imageUrl,
        videoUrl: videoUrl || null,
        created_at: dateObj.toISOString(),
        trigger: 'mqtt'
      });

      // --- WEBHOOK INTEGRATION ---
      // --- WEBHOOK INTEGRATION (Robust) ---
      if (globalConfig.webhook.enabled) {
        try {
          const webhookPayload = {
            id: id,
            timestamp: dateObj.toISOString(),
            description: description,
            description: description,
            imageUrl: imageUrl,
            videoUrl: videoUrl,
            camera_config: config
          };

          const webhookUrl = globalConfig.webhook.url;
          console.log(`   [Webhook] Sending to: ${webhookUrl}`);

          // Fire and forget - don't await the result to block alerting
          axios.post(webhookUrl, webhookPayload, { timeout: 10000 })
            .then(res => {
              if (typeof res.data === 'string' && res.data.trim().startsWith('<')) {
                console.error(`   [Webhook] ⚠️  WARNING: Received HTML (Endpoint likely missing/wrong). Response starts with: ${res.data.substring(0, 50)}...`);
                console.error(`   [Webhook] ⚠️  Ensure backend has /api/camllm route and firebase.json directs to it.`);
              } else {
                console.log(`   [Webhook] ✅ Success: ${res.status} ${JSON.stringify(res.data)}`);
              }
            })
            .catch(err => {
              console.error(`   [Webhook] ❌ Failed: ${err.message}`);
              if (err.response) {
                console.error(`   [Webhook] Status: ${err.response.status}`);
                console.error(`   [Webhook] Data: ${JSON.stringify(err.response.data).substring(0, 100)}`);
              }
            });

        } catch (webhookErr) {
          console.error(`   [Webhook] Error construction: ${webhookErr.message}`);
        }
      } else {
        console.log(`   [Webhook] Skipped (Disabled in config)`);
      }
      // ---------------------------
      // ---------------------------

      // Alert
      if (now - lastAlert > COOLDOWN && !description.includes("CLEAR")) {
        console.log(`   [${id}] !!! ALERTING !!!`);
        const recipient = config.whatsapp_recipient || globalConfig.whatsapp.recipient;
        const currentToken = config.whatsapp_token || globalConfig.whatsapp.token;

        const alertMsg = `🚨 *${id} Motion*\n\n${description}\n\nTime: ${dateObj.toLocaleTimeString()}`;

        if (videoUrl) {
          // Priority Video Alert
          await whatsapp.sendText(`🚨 *WARNING: VIDEO CLIP* \n${alertMsg}\n\nEvidence: ${videoUrl}`, recipient, currentToken)
            .catch(e => console.error("Failed to send video link", e.message));
        } else if (config.send_image && imageUrl) {
          // await whatsapp.sendImage(imageUrl, alertMsg, recipient, currentToken)
          //   .then(() => fs.appendFileSync('whatsapp.log', `[${new Date().toISOString()}] SUCCESS: Image sent\n`))
          //   .catch(e => fs.appendFileSync('whatsapp.log', `[${new Date().toISOString()}] FAIL: ${e.message}\n`));
          console.log(`   [WhatsApp] DISABLED by user request.`);
        } else {
          await whatsapp.sendText(alertMsg, recipient, currentToken)
            .then(() => fs.appendFileSync('whatsapp.log', `[${new Date().toISOString()}] SUCCESS: Text sent\n`))
            .catch(e => fs.appendFileSync('whatsapp.log', `[${new Date().toISOString()}] FAIL: ${e.message}\n`));
          console.log(`   [WhatsApp] Sent alert to ${recipient}`);
        }
        state.lastAlert = now;
      }
    }

  } catch (e) {
    console.error(`[${id}] Error: ${e.message}`);
    try { fs.appendFileSync('error.log', `[${new Date().toISOString()}] General Error: ${e.message}\n`); } catch (ex) { }
  } finally {
    // ALWAYS reset processing flag
    state.isProcessing = false;
  }
}

// Helper: Record Video Clip (Parallel)
function recordVideo(config, duration = 10) {
  const streamPath = '/ch0_1.h264';
  let rtspUrl = '';
  if (!config.user || config.user.trim() === '') {
    rtspUrl = `rtsp://${config.ip}${streamPath}`;
  } else {
    const user = encodeURIComponent(config.user);
    const pass = encodeURIComponent(config.pass);
    rtspUrl = `rtsp://${user}:${pass}@${config.ip}${streamPath}`;
  }

  const dateObj = new Date();
  const filename = `video_${config.id}_${dateObj.getTime()}.mp4`;
  const filePath = require('path').resolve(filename);

  console.log(`   [${config.id}] Starting ${duration}s video recording...`);

  // ffmpeg: -t duration, -c copy (fast), -y (overwrite)
  const cmd = `"${ffmpeg}" -y -loglevel error -rtsp_transport tcp -i "${rtspUrl}" -t ${duration} -c copy "${filePath}"`;

  let processRef = null;

  const videoPromise = new Promise((resolve, reject) => {
    // Timeout slightly longer than duration to allow graceful exit
    processRef = exec(cmd, { timeout: (duration + 5) * 1000 }, (error, stdout, stderr) => {
      // If error is NOT null, it failed. 
      // Note: killing process manually might cause error code, but we handle cancel separately.
      if (error && !error.killed && error.signal !== 'SIGKILL') {
        console.error(`   [${config.id}] Video Record Error: ${stderr || error.message}`);
        resolve(null); // Resolve null on error so main flow continues
      } else {
        resolve(filePath);
      }
    });
  });

  const cancel = () => {
    if (processRef && processRef.exitCode === null) {
      console.log(`   [${config.id}] Discarding video...`);
      processRef.kill('SIGKILL');
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { }
    } else {
      // Process already finished, just delete file
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { }
    }
  };

  return { videoPromise, cancel };
}

// Helper: Upload Video
async function uploadVideo(filePath, date, cameraId) {
  if (!fs.existsSync(filePath)) return null;
  const filename = `camera_videos/${date.toISOString().split('T')[0]}/${cameraId}/${require('path').basename(filePath)}`;
  const file = bucket.file(filename);
  // Video metadata
  await file.save(fs.readFileSync(filePath), { metadata: { contentType: 'video/mp4' }, public: true });
  // Cleanup local
  fs.unlinkSync(filePath);
  return file.publicUrl();
}

// Special Function: Capture One-Off Setup Frame (No Crop)
async function captureSetupFrame(config) {
  console.log(`[${config.id}] Capturing SETUP frame (Full View)...`);
  try {
    const rawConfig = { ...config, crop: null };
    const result = await fetchSnapshot(rawConfig);
    const buffer = result.full;

    const dateObj = new Date();
    const filename = `setup_frames/${config.id}_${dateObj.getTime()}.jpg`;
    const file = bucket.file(filename);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
    const setupUrl = file.publicUrl();

    console.log(`   > Setup Frame Uploaded: ${setupUrl}`);

    await db.collection('cameras').doc(config.id).update({
      setupImageUrl: setupUrl,
      capture_setup_frame: false,
      last_setup_update: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (e) {
    console.error(`   ! Setup Frame Error: ${e.message}`);
    await db.collection('cameras').doc(config.id).update({
      capture_setup_frame: false
    });
  }
}


function startManager() {
  console.log("--- Yi Outdoor Monitor (EVENT DRIVEN / MQTT) ---");
  console.log("broker listening on 1883...");

  // Heartbeat to reassure user
  setInterval(() => {
    console.log(`[Heartbeat] Listening for Motion Events (${activeMonitors.size} active cameras)...`);
  }, 60000);

  db.collection('cameras').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const data = change.doc.data();
      const id = change.doc.id;
      const fullConfig = { ...data, id };

      if (change.type === 'added' || change.type === 'modified') {
        if (data.active) {
          console.log(`[Manager] loaded config for ${id}`);
          // Just update state map, don't start loop
          activeMonitors.set(id, {
            config: fullConfig,
            lastAlert: 0,
            isProcessing: false
          });

          // Check for Setup Frame Request (Still needs polling or trigger? Let's just run it once)
          if (data.capture_setup_frame) {
            captureSetupFrame(fullConfig);
          }

        } else {
          activeMonitors.delete(id);
        }
      }
      if (change.type === 'removed') {
        activeMonitors.delete(id);
      }
    });
  });
}

startManager();
