const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

class AIHandler {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }

    // Helper to convert buffer to GenerativePart (inline data)
    fileToGenerativePart(buffer, mimeType) {
        return {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType
            },
        };
    }

    async describeImage(imageBuffer, mimeType = "image/jpeg", customPrompt = null) {
        try {
            if (!imageBuffer || imageBuffer.length < 100) {
                console.error("AI Error: Image buffer is empty or too small.");
                return "Error: Invalid Image";
            }
            const prompt = customPrompt || "Describe what is happening in this security camera frame in one short sentence. Focus on people, vehicles, or animals and their actions. If nothing is happening, say 'No activity'.";
            const imagePart = this.fileToGenerativePart(imageBuffer, mimeType);

            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();
            return text.trim();
        } catch (error) {
            const errStr = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
            fs.writeFileSync('error.log', errStr);
            console.error("Error calling Gemini API. Details written to error.log");
            return "Error generating description.";
        }
    }
}

module.exports = { AIHandler };
