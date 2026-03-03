FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Expose the port
EXPOSE 8080

# Start the app
CMD ["node", "reservation-dashboard.js"]