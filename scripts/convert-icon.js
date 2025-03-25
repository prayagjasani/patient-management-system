const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '../assets/icon.svg');
const pngPath = path.join(__dirname, '../assets/icon.png');
const icoPath = path.join(__dirname, '../assets/icon.ico');

// First convert to PNG
sharp(svgPath)
    .resize(256, 256)
    .png()
    .toBuffer()
    .then(pngBuffer => {
        // Save PNG
        fs.writeFileSync(pngPath, pngBuffer);
        console.log('PNG icon created successfully!');

        // Create ICO (multiple sizes for better quality)
        return Promise.all([
            sharp(pngBuffer).resize(16, 16).toBuffer(),
            sharp(pngBuffer).resize(32, 32).toBuffer(),
            sharp(pngBuffer).resize(48, 48).toBuffer(),
            sharp(pngBuffer).resize(64, 64).toBuffer(),
            sharp(pngBuffer).resize(128, 128).toBuffer(),
            sharp(pngBuffer).resize(256, 256).toBuffer()
        ]);
    })
    .then(buffers => {
        // Combine buffers into ICO format
        const icoHeader = Buffer.alloc(6);
        icoHeader.writeUInt16LE(0, 0); // Reserved
        icoHeader.writeUInt16LE(1, 2); // ICO type
        icoHeader.writeUInt16LE(buffers.length, 4); // Number of images

        let offset = 6 + (buffers.length * 16); // Header size + directory entries size
        const directory = Buffer.alloc(buffers.length * 16);
        const imageData = Buffer.concat(buffers);

        buffers.forEach((buffer, i) => {
            const size = buffer.length;
            const width = [16, 32, 48, 64, 128, 0][i]; // Use 0 for 256 (ICO format specification)
            const dirEntry = directory.slice(i * 16, (i + 1) * 16);

            dirEntry.writeUInt8(width, 0); // Width
            dirEntry.writeUInt8(width, 1); // Height
            dirEntry.writeUInt8(0, 2); // Color palette
            dirEntry.writeUInt8(0, 3); // Reserved
            dirEntry.writeUInt16LE(1, 4); // Color planes
            dirEntry.writeUInt16LE(32, 6); // Bits per pixel
            dirEntry.writeUInt32LE(size, 8); // Image size
            dirEntry.writeUInt32LE(offset, 12); // Image offset

            offset += size;
        });

        const ico = Buffer.concat([icoHeader, directory, imageData]);
        fs.writeFileSync(icoPath, ico);
        console.log('ICO icon created successfully!');
    })
    .catch(err => {
        console.error('Error creating icons:', err);
        process.exit(1);
    });