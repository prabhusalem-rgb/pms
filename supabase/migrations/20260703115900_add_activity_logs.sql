-- Migration: Add activity_logs table for audit tracking
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(100) PRIMARY KEY,
    change_summary TEXT NOT NULL,
    user_details JSONB NOT NULL,
    timestamp VARCHAR(100) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    before_screenshot JSONB NOT NULL,
    after_screenshot JSONB NOT NULL,
    fields_changed JSONB NOT NULL,
    reason_or_ticket TEXT NOT NULL,
    rollback_instructions TEXT,
    verification_steps TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
