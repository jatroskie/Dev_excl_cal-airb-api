// src/utils/imageProcessing.js

const MAX_WIDTH = 1920;
const QUALITY = 0.8;

export const processImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // Check dimensions
                if (img.width < 800) {
                    reject(new Error(`Image ${file.name} is too small (${img.width}px). Minimum width is 800px.`));
                    return;
                }

                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error(`Compression failed for ${file.name}`));
                        return;
                    }
                    const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });

                    // Create object URL for preview
                    const previewUrl = URL.createObjectURL(newFile);

                    resolve({
                        file: newFile,
                        url: previewUrl,
                        originalName: file.name,
                        width,
                        height
                    });
                }, 'image/webp', QUALITY);
            };
            img.onerror = (err) => reject(new Error(`Failed to load image ${file.name}`));
        };
        reader.onerror = (err) => reject(new Error(`Failed to read file ${file.name}`));
    });
};
