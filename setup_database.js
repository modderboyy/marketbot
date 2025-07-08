
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupDatabase() {
    try {
        console.log('Setting up database...');

        console.log('\nSupabase Dashboard SQL buyruqlari:');
        console.log('======================================');
        
        const sqlCommands = [
            `-- Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_agree BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_client_went BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_client_claimed BOOLEAN DEFAULT FALSE;`,

            `-- Update existing delivery_status column to boolean if needed
UPDATE orders SET delivery_status = false WHERE delivery_status IS NULL;`,

            `-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_is_agree ON orders(is_agree);
CREATE INDEX IF NOT EXISTS idx_orders_is_client_went ON orders(is_client_went);
CREATE INDEX IF NOT EXISTS idx_orders_is_client_claimed ON orders(is_client_claimed);`
        ];

        sqlCommands.forEach((sql, index) => {
            console.log(`\n${index + 1}. ${sql}`);
        });

        console.log('\n======================================');
        console.log('Bu SQL buyruqlarini Supabase Dashboard > SQL Editor da ishga tushiring.');
        console.log('Database setup completed!');
    } catch (error) {
        console.error('Error setting up database:', error);
    }
}

setupDatabase();
