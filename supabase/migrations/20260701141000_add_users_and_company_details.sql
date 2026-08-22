-- Migration to add users and company_details tables

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Purchase', 'Site')),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_details (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'current_config',
    name VARCHAR(255) NOT NULL,
    address TEXT,
    vat_number VARCHAR(100),
    tin_number VARCHAR(100),
    logo TEXT, -- base64 or URL string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
