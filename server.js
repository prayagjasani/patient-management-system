const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const aiUtils = require('./utils/aiUtils');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Get resource path safely for Electron environments
const getResourcePath = () => {
    if (process && process.resourcesPath) {
        console.log('Using resourcesPath:', process.resourcesPath);
        return process.resourcesPath;
    }
    console.log('Falling back to __dirname:', __dirname);
    return __dirname;
};

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set static files directory based on environment
const publicPath = isDev ? path.join(__dirname, 'public') : path.join(getResourcePath(), 'public');
app.use(express.static(publicPath));

// Set views directory based on environment
const viewsPath = isDev ? path.join(__dirname, 'views') : path.join(getResourcePath(), 'views');
console.log('Setting views directory to:', viewsPath);
app.set("views", viewsPath);
app.set("view engine", "ejs");

// For debugging - log all environment variables
console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    isDev: isDev,
    __dirname: __dirname,
    viewsPath: viewsPath,
    publicPath: publicPath
});

// Database connection using environment variables or defaults
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "DATABASE_PASSWORD_PLACEHOLDER", // Replace with env variable
    database: process.env.DB_NAME || "mydatabase",
    port: process.env.DB_PORT || 3306,
    ...(process.env.DB_HOST && {
        ssl: {
            rejectUnauthorized: false
        }
    })
});

// Add specific error handling for database connection
db.on('error', function(err) {
    console.error('Database connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Attempting to reconnect to database...');
        initializeDatabase().catch(err => {
            console.error('Failed to reconnect to database:', err);
        });
    } else {
        console.error('Database error:', err);
    }
});

// Initialize database and tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.connect((err) => {
            if (err) {
                console.error('Error connecting to the database:', err);
                reject(err);
                return;
            }
            console.log('Connected to MySQL database');

            // Create table if it doesn't exist
            const createTableQuery = `
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                contact_number VARCHAR(15),
                medical_history TEXT,
                treatment_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`;

            db.query(createTableQuery, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                    return;
                }
                console.log('Table structure verified');
                resolve();
            });
        });
    });
}

// Initialize database before starting the server
initializeDatabase().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Home page with all patients
app.get("/", (req, res) => {
    const query = `
        SELECT *, 
        DATE_FORMAT(created_at, '%a, %M %d, %Y at %h:%i %p') as formatted_created_date
        FROM patients 
        ORDER BY created_at DESC`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching patients:', err);
            res.status(500).send('Error fetching patients');
            return;
        }
        res.render("index", { patients: results });
    });
});

// Insert patient data
app.post("/add", (req, res) => {
    const { first_name, last_name, contact_number, medical_history, treatment_notes } = req.body;

    // Convert to Indian Standard Time (IST) - UTC+5:30
    const now = new Date();
    // Adjust to IST by adding 5 hours and 30 minutes
    now.setHours(now.getHours() + 5);
    now.setMinutes(now.getMinutes() + 30);
    const istTimestamp = now.toISOString().slice(0, 19).replace('T', ' ');

    console.log('Using Indian Standard Time (IST) timestamp:', istTimestamp);

    // Include IST timestamp in the query
    const query = "INSERT INTO patients (first_name, last_name, contact_number, medical_history, treatment_notes, created_at) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(query, [first_name, last_name, contact_number, medical_history, treatment_notes, istTimestamp], (err, result) => {
        if (err) {
            console.error('Error adding patient:', err);
            res.status(500).send('Error adding patient');
            return;
        }
        res.redirect("/");
    });
});

// Delete patient
app.post("/delete/:id", (req, res) => {
    const patientId = req.params.id;
    const query = "DELETE FROM patients WHERE id = ?";

    db.query(query, [patientId], (err, result) => {
        if (err) {
            console.error('Error deleting patient:', err);
            return res.status(500).json({ success: false, message: 'Error deleting patient' });
        }

        return res.json({ success: true, message: 'Patient deleted successfully' });
    });
});

// Search patient data
app.get("/search", (req, res) => {
    res.render("search");
});

app.post("/search", (req, res) => {
    const { search_term } = req.body;
    let query = `
        SELECT *, 
        DATE_FORMAT(created_at, '%a, %M %d, %Y at %h:%i %p') as formatted_created_date
        FROM patients WHERE 1=1`;
    const params = [];

    if (search_term && search_term.trim() !== '') {
        query += " AND (first_name LIKE ? OR last_name LIKE ? OR contact_number LIKE ?)";
        params.push(`%${search_term}%`);
        params.push(`%${search_term}%`);
        params.push(`%${search_term}%`);
    }

    query += " ORDER BY created_at DESC";

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error searching patients:', err);
            res.status(500).send('Error searching patients');
            return;
        }
        res.render("results", { patients: results });
    });
});

// View all patient records
app.get("/records", (req, res) => {
    const query = `
        SELECT *, 
        DATE_FORMAT(created_at, '%a, %M %d, %Y at %h:%i %p') as formatted_created_date
        FROM patients 
        ORDER BY created_at DESC`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching patients:', err);
            res.status(500).send('Error fetching patients');
            return;
        }
        res.render("records", { patients: results });
    });
});

// AI-powered endpoints
app.get("/api/suggest-medical-terms", (req, res) => {
    const { input } = req.query;
    const suggestions = aiUtils.getMedicalTermSuggestions(input);
    res.json(suggestions);
});

app.get("/api/suggest-treatments", (req, res) => {
    const { input } = req.query;
    const suggestions = aiUtils.getTreatmentSuggestions(input);
    res.json(suggestions);
});

app.get("/api/suggest-patients", (req, res) => {
    const { name } = req.query;
    const query = "SELECT first_name, last_name, id FROM patients";

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching patients for suggestions:', err);
            res.status(500).json([]);
            return;
        }
        const suggestions = aiUtils.findSimilarNames(name, results);
        res.json(suggestions);
    });
});

// Export the app without starting the server
module.exports = app;