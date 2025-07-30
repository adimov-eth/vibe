-- XLN Hub Database Schema
-- PostgreSQL database for managing credit-line channels

-- Create database
CREATE DATABASE xln_hub;

-- Connect to database
\c xln_hub;

-- Channels table - stores merchant credit lines
CREATE TABLE channels (
  merchant_address TEXT PRIMARY KEY,
  merchant_name TEXT NOT NULL,
  credit_limit BIGINT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments table - payment history
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  merchant_address TEXT NOT NULL REFERENCES channels(merchant_address),
  amount BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_payments_merchant ON payments(merchant_address);
CREATE INDEX idx_payments_created ON payments(created_at);

-- Example: Register Maria's Taco Truck
INSERT INTO channels (merchant_address, merchant_name, credit_limit) 
VALUES ('0x1234...', 'Maria''s Taco Truck', 1000);

-- Check credit utilization
SELECT 
  merchant_name,
  credit_limit,
  balance,
  (credit_limit - balance) as available_credit,
  ROUND(100.0 * balance / credit_limit, 2) as utilization_percent
FROM channels;