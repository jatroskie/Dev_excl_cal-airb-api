import React, { useState } from 'react';
import Step1_Location from '../components/Wizard/Step1_Location';
import Step2_Photos from '../components/Wizard/Step2_Photos';
import Step3_Review from '../components/Wizard/Step3_Review';
import '../components/Wizard/Wizard.css'; // Import the new CSS

// Simple Wizard Layout
const HostOnboarding = () => {
    const [step, setStep] = useState(1);
    const [listingData, setListingData] = useState({
        address: '',
        unitNumber: '',
        destination: '',
        photos: [], // Array of { file, url, category, isCover }
        title: '',
        description: '',
        amenities: ['Wifi', 'Essentials', 'Bed linens'], // Smart defaults
        parkingType: 'No Parking'
    });

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);

    // Update data from steps
    const updateData = (newData) => {
        setListingData(prev => ({ ...prev, ...newData }));
    };

    return (
        <div className="host-onboarding-container">
            {/* Header */}
            <header className="wizard-header">
                <div className="brand">Destinations <span className="sub-brand">Host App</span></div>
            </header>

            {/* Progress Bar */}
            <div className="progress-bar-container">
                <div
                    className="progress-bar-fill"
                    style={{ width: `${(step / 3) * 100}%` }}
                ></div>
            </div>

            {/* Main Content */}
            <main className="wizard-main">
                <div className="wizard-card">
                    <div className="wizard-title">
                        <h1>
                            {step === 1 && "Start your listing"}
                            {step === 2 && "Add your photos"}
                            {step === 3 && "Review and publish"}
                        </h1>
                        <p>
                            {step === 1 && "Tell us where your property is located."}
                            {step === 2 && "Showcase your property with high-quality images."}
                            {step === 3 && "Check the details and amenities before going live."}
                        </p>
                    </div>

                    {/* Step Render */}
                    <div className="wizard-content">
                        {step === 1 && <Step1_Location data={listingData} updateData={updateData} next={nextStep} />}
                        {step === 2 && <Step2_Photos data={listingData} updateData={updateData} next={nextStep} back={prevStep} />}
                        {step === 3 && <Step3_Review data={listingData} updateData={updateData} back={prevStep} />}
                    </div>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="w-footer">
                &copy; 2026 Destinations Inc.
            </footer>
        </div>
    );
};

export default HostOnboarding;
