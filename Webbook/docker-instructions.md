docker-instructions.md
markdown

# Docker Instructions for Deploying a New Project to Google Cloud Run

This guide provides step-by-step instructions to create a new project, containerize it using Docker, and deploy it to Google Cloud Run at `265621559963.us-central1.run.app`. The instructions assume you're starting a new project and deploying it as a service named `new-project` (resulting in a URL like `https://new-project-265621559963.us-central1.run.app`).

## Prerequisites

Before you begin, ensure you have the following:

- **Google Cloud Account**: A Google Cloud project with the ID `265621559963` and billing enabled.
- **Google Cloud CLI (gcloud)**: Installed on your machine. Download it from the [Google Cloud SDK page](https://cloud.google.com/sdk/docs/install) if needed.
- **Docker**: Installed locally to build your container image. Install it from [Docker's official site](https://docs.docker.com/get-docker/).
- **Artifact Registry API Enabled**: We'll use Artifact Registry to store Docker images.

## Step 1: Set Up Your Google Cloud Environment

1. **Log in to Google Cloud**:
   Open your terminal and authenticate your Google Cloud CLI:
   ```bash
   gcloud auth login

   Follow the prompts to log in.
Set Your Project:
Set your project ID (265621559963) as the default:
bash

gcloud config set project 265621559963

Enable Required APIs:
Ensure the Cloud Run and Artifact Registry APIs are enabled:
bash

gcloud services enable run.googleapis.com artifactregistry.googleapis.com

Configure Docker for Artifact Registry:
Authenticate Docker to push images to Artifact Registry in the us-central1 region:
bash

gcloud auth configure-docker us-central1-docker.pkg.dev

Step 2: Create a Repository in Artifact Registry
You need a repository to store your Docker image.
Create a Repository:
Create a Docker repository named my-repo in us-central1:
bash

gcloud artifacts repositories create my-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repository for Cloud Run images"

Verify the Repository:
Confirm the repository was created:
bash

gcloud artifacts repositories list

Step 3: Set Up a New Project
We'll create a simple Node.js project as an example. You can adapt these steps for your preferred language or framework.
Create a Project Directory:
Create a new directory for your project and navigate into it:
bash

mkdir new-project
cd new-project

Initialize a Node.js Project:
Initialize a new Node.js project and install Express:
bash

npm init -y
npm install express

Create the Application Code:
Create a file named index.js with the following content:
javascript

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello from your New Project!');
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

Update package.json:
Ensure your package.json includes a start script. It should look like this:
json

{
    "name": "new-project",
    "version": "1.0.0",
    "main": "index.js",
    "scripts": {
        "start": "node index.js"
    },
    "dependencies": {
        "express": "^4.18.2"
    }
}

Step 4: Create a Dockerfile
Create a Dockerfile to containerize your project.
Create the Dockerfile:
In your project directory (new-project), create a file named Dockerfile with the following content:
dockerfile

# Use the official Node.js image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port Cloud Run expects (default is 8080)
ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["npm", "start"]

Note: Cloud Run requires your app to listen on the port defined by the PORT environment variable (default is 8080). The index.js code above is already configured to use process.env.PORT.

Step 5: Build and Push Your Docker Image
Build the Docker Image:
Build your Docker image and tag it for Artifact Registry:
bash

docker build -t us-central1-docker.pkg.dev/265621559963/my-repo/new-project:latest .

Push the Image to Artifact Registry:
Push the image to the repository you created:
bash

docker push us-central1-docker.pkg.dev/265621559963/my-repo/new-project:latest

Step 6: Deploy to Cloud Run
Deploy the image to Cloud Run with the service name new-project, resulting in the URL https://new-project-265621559963.us-central1.run.app.
Deploy the Service:
Run the following command:
bash

gcloud run deploy new-project \
    --image us-central1-docker.pkg.dev/265621559963/my-repo/new-project:latest \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated

new-project: The service name, which determines the URL.

--image: The image you pushed to Artifact Registry.

--region us-central1: The region matching your desired URL.

--platform managed: Specifies fully managed Cloud Run.

--allow-unauthenticated: Makes the service publicly accessible. Remove this flag if you want to restrict access.

Wait for Deployment:
The deployment will take a few moments. Once complete, you’ll see the service URL: https://new-project-265621559963.us-central1.run.app.

Test the URL:
Open the URL in your browser. You should see "Hello from your New Project!".

Step 7: Verify and Manage Your Service
Check the Service in Cloud Run:
In the Google Cloud Console, navigate to Cloud Run and confirm your service (new-project) is listed with the correct URL.

View Logs:
In the Cloud Run dashboard, click on your service to view logs for troubleshooting.

Step 8: Clean Up (Optional)
To avoid incurring charges:
Delete the Service:
bash

gcloud run services delete new-project --region us-central1

Delete the Docker Image:
bash

gcloud artifacts docker images delete us-central1-docker.pkg.dev/265621559963/my-repo/new-project:latest

Additional Notes
Custom Service Name: You can change new-project to any name you prefer (e.g., my-app) in the gcloud run deploy command, and the URL will update accordingly (e.g., https://my-app-265621559963.us-central1.run.app).

Authentication: The --allow-unauthenticated flag makes your service public. For a private service, omit this flag and configure IAM permissions.

Cost: Cloud Run charges based on usage (CPU, memory, requests). Artifact Registry charges for storage. Check Cloud Run pricing and Artifact Registry pricing for details.

