import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    // TODO: Replace with your actual Firebase Web App config
    apiKey: "REPLACE_WITH_YOUR_API_KEY",
    authDomain: "cal-airb-api.firebaseapp.com",
    projectId: "cal-airb-api",
    storageBucket: "cal-airb-api.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
