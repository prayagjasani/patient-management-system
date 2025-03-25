const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const aiUtils = require('./utils/aiUtils');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set static files directory based on environment
const publicPath = isDev ? 'public' : path.join(process.resourcesPath, 'public');
app.use(express.static(publicPath));

// Set views directory based on environment
const viewsPath = isDev ? 'views' : path.join(process.resourcesPath, 'views');
app.set("views", viewsPath);
app.set("view engine", "ejs");

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Prayag@2oo4.",
    database: "mydatabase"
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
                last_visit_date DATETIME,
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
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as formatted_created_date,
        DATE_FORMAT(last_visit_date, '%Y-%m-%d %H:%i') as formatted_last_visit_date 
        FROM patients 
        ORDER BY last_name ASC`;

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

    // Use current date and time for last visit
    const now = new Date();
    const last_visit_date = now.toISOString().slice(0, 19).replace('T', ' ');

    const query = "INSERT INTO patients (first_name, last_name, contact_number, medical_history, treatment_notes, last_visit_date) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(query, [first_name, last_name, contact_number, medical_history, treatment_notes, last_visit_date], (err, result) => {
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
            res.status(500).send('Error deleting patient');
            return;
        }
        res.redirect("/records");
    });
});

// Search patient data
app.get("/search", (req, res) => {
    res.render("search");
});

app.post("/search", (req, res) => {
    const { search_term, visit_date } = req.body;
    let query = `
        SELECT *, 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as formatted_created_date,
        DATE_FORMAT(last_visit_date, '%Y-%m-%d %H:%i') as formatted_last_visit_date 
        FROM patients WHERE 1=1`;
    const params = [];

    if (search_term && search_term.trim() !== '') {
        query += " AND (first_name LIKE ? OR last_name LIKE ? OR contact_number LIKE ?)";
        params.push(`%${search_term}%`);
        params.push(`%${search_term}%`);
        params.push(`%${search_term}%`);
    }

    if (visit_date) {
        query += " AND DATE(last_visit_date) = ?";
        params.push(visit_date);
    }

    query += " ORDER BY last_name ASC";

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
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as formatted_created_date,
        DATE_FORMAT(last_visit_date, '%Y-%m-%d %H:%i') as formatted_last_visit_date 
        FROM patients 
        ORDER BY last_name ASC`;

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