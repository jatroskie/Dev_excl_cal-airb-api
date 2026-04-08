import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function ChannelSettingsModal({ onClose }) {
  const [airbnbMarkup, setAirbnbMarkup] = useState(3);
  const [bookingComMarkup, setBookingComMarkup] = useState(15);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'config', 'pricingSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().channelMarkups) {
          const markups = docSnap.data().channelMarkups;
          if (markups.airbnb) setAirbnbMarkup(markups.airbnb.value);
          if (markups.bookingCom) setBookingComMarkup(markups.bookingCom.value);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const docRef = doc(db, 'config', 'pricingSettings');
      await setDoc(docRef, {
        channelMarkups: {
          airbnb: { type: 'percentage', value: Number(airbnbMarkup) },
          bookingCom: { type: 'percentage', value: Number(bookingComMarkup) }
        }
      }, { merge: true });
      
      setSuccess('Settings saved successfully!');
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError('Failed to save settings.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-panel-overlay" onClick={onClose}>
      <div className="edit-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <button className="close-button" onClick={onClose}>×</button>
        <h3>Global Channel Markups</h3>
        <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '20px' }}>
          Define the commission offset for each OTA. These percentages are automatically applied on top of your base season rates before syncing.
        </p>

        {loading ? (
          <p>Loading settings...</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Airbnb Markup (%)</label>
              <input 
                type="number" 
                step="any" 
                value={airbnbMarkup} 
                onChange={(e) => setAirbnbMarkup(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Booking.com Markup (%)</label>
              <input 
                type="number" 
                step="any" 
                value={bookingComMarkup} 
                onChange={(e) => setBookingComMarkup(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="save-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            {error && <p className="error-message">{error}</p>}
            {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default ChannelSettingsModal;
