const axios = require('axios');

class WhatsAppHandler {
    constructor(config) {
        this.token = config.token;
        this.phoneId = config.phoneId;
        this.recipient = config.recipient;
        this.baseUrl = `https://graph.facebook.com/v18.0/${this.phoneId}/messages`;
    }

    async sendText(message, recipientOverride = null, tokenOverride = null) {
        const token = tokenOverride || this.token;
        const recipient = recipientOverride || this.recipient;

        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    messaging_product: "whatsapp",
                    to: recipient,
                    type: "text",
                    text: { body: message }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('WhatsApp message sent:', response.data.messages[0].id);
            return response.data;
        } catch (error) {
            console.error('WhatsApp Send Failed:', error.response ? error.response.data : error.message);
            // Don't throw - we don't want to crash the monitor loop just because alerts failed
            // throw error; 
            return null;
        }
    }

    async sendImage(imageUrl, caption, recipientOverride = null, tokenOverride = null) {
        const token = tokenOverride || this.token;
        const recipient = recipientOverride || this.recipient;

        try {
            const response = await axios.post(
                this.baseUrl,
                {
                    messaging_product: "whatsapp",
                    to: recipient,
                    type: "image",
                    image: { link: imageUrl, caption: caption }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('WhatsApp Image sent:', response.data.messages[0].id);
            return response.data;
        } catch (error) {
            console.error('WhatsApp Image Send Failed:', error.response ? error.response.data : error.message);
            // Fallback to text if image fails
            return this.sendText(caption + "\n\n(Image failed to send)", recipient, token);
        }
    }
}

module.exports = { WhatsAppHandler };
