const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client
        // Direct REST call cause SDK hides listModels sometimes
        console.log("Listing models...");
        // Actually the SDK doesn't expose listModels easily on the client instance, 
        // but the error message suggested calling ListModels.
        // Let's try a simple fetch to the API endpoint.

        const key = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

        // We can use the fetch we know works? Or just node fetch if available
        const fetch = require('node-fetch'); // We installed this earlier
        // If not available, we use curl

        const { exec } = require('child_process');
        exec(`curl "${url}"`, (err, stdout, stderr) => {
            if (err) console.error(err);
            console.log(stdout);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
