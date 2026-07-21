-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    module VARCHAR(50) PRIMARY KEY,
    admin_access VARCHAR(10) NOT NULL,
    purchase_access VARCHAR(10) NOT NULL,
    site_access VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate role_permissions table
INSERT INTO role_permissions (module, admin_access, purchase_access, site_access) VALUES
('dashboard', 'Full', 'None', 'None'),
('projects', 'Full', 'View', 'View'),
('boq', 'Full', 'View', 'View'),
('procurement', 'Full', 'Full', 'None'),
('suppliers', 'Full', 'Full', 'None'),
('inventory', 'Full', 'None', 'Full'),
('reports', 'Full', 'View', 'View'),
('users', 'Full', 'None', 'None')
ON CONFLICT (module) DO NOTHING;
