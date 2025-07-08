const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupDatabase() {
    try {
        console.log('Setting up database...');

        // Add new columns to orders table
        const alterQueries = [
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_agree BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_client_went BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_client_claimed BOOLEAN DEFAULT FALSE;`
        ];

        for (const query of alterQueries) {
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
            if (error) {
                console.error('Error executing query:', query, error);
            } else {
                console.log('Successfully executed:', query);
            }
        }

        console.log('Database setup completed!');
    } catch (error) {
        console.error('Error setting up database:', error);
    }
}

setupDatabase();