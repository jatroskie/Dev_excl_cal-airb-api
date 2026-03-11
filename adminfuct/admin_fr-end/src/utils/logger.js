import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Logs user activity to the 'activity_logs' collection in Firestore.
 * @param {string} action - The action performed (e.g., 'LOGIN', 'DELETE_IMAGE')
 * @param {object} details - Specific details of the action (e.g., { roomId: '123' })
 * @param {object} metadata - Additional context (optional)
 */
export const logActivity = async (action, details = {}, metadata = {}) => {
    try {
        const user = auth.currentUser;
        const logEntry = {
            timestamp: serverTimestamp(),
            action: action,
            userEmail: user ? user.email : 'anonymous',
            userId: user ? user.uid : 'unknown',
            details: details,
            metadata: {
                ...metadata,
                userAgent: navigator.userAgent,
                url: window.location.href
            }
        };

        const logsRef = collection(db, 'activity_logs');
        await addDoc(logsRef, logEntry);
        console.log(`Activity logged: ${action}`, details);
    } catch (err) {
        // Silently fail logging to avoid breaking user experience
        console.error('Failed to log activity:', err);
    }
};
