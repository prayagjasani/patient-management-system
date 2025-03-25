-- Create the database
CREATE DATABASE IF NOT EXISTS mydatabase;
USE mydatabase;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    description TEXT,
    appointment_datetime DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add appointment_datetime column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS appointment_datetime DATETIME; 