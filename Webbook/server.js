const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

// Enable CORS if the webpage is hosted elsewhere
const cors = require('cors');
app.use(cors());

// POST endpoint to capture reservation
app.post('/capture-reservation', (req, res) => {
  const { surname, name, phone, property, checkin, checkout, dailyRate, discountCode } = req.body;

  // Execute the Playwright script with parameters
  exec(
    `node capture.js "${surname}" "${name}" "${phone}" "${property}" "${checkin}" "${checkout}" "${dailyRate}" "${discountCode}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${stderr}`);
        return res.status(500).json({ error: 'Failed to process reservation' });
      }
      const confirmationNumber = stdout.trim();
      res.json({ confirmationNumber });
    }
  );
});

// Start the server
const PORT = 3234;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});