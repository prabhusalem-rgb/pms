-- Create task_messages table
CREATE TABLE IF NOT EXISTS task_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    sender VARCHAR(100) NOT NULL,
    message TEXT,
    attachment_name VARCHAR(255),
    attachment_data TEXT, -- Stores base64 encoded document/file data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable Row Level Security (RLS) to allow system/frontend updates
ALTER TABLE task_messages DISABLE ROW LEVEL SECURITY;
