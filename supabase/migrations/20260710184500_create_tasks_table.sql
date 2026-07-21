-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assigned_to VARCHAR(100),
    due_date DATE,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE SET NULL,
    progress NUMERIC(5, 2) DEFAULT 0.00,
    estimated_hours NUMERIC(10, 2),
    actual_hours NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable Row Level Security (RLS) to allow system/frontend updates
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
