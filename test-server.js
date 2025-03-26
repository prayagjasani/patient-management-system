// Test server to run the Express app directly
process.env.NODE_ENV = 'development';
process.resourcesPath = __dirname;

const app = require('./server');
const PORT = 3001;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} - http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop');
});