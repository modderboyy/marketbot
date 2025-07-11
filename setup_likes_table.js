
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupLikesTable() {
    console.log('Setting up product_likes table...');
    
    try {
        // Note: This requires database access permissions
        // You may need to run this SQL directly in Supabase dashboard:
        console.log(`
Please run this SQL in your Supabase SQL editor:

CREATE TABLE IF NOT EXISTS product_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON product_likes(user_id);
        `);
        
        // Test if table exists by trying to query it
        const { data, error } = await supabase
            .from('product_likes')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            console.log('Table does not exist yet. Please create it using the SQL above.');
        } else {
            console.log('✅ product_likes table is ready!');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

setupLikesTable();
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupLikesTable() {
    console.log('Setting up product likes table...');
    
    try {
        // First, let's check if the table exists by trying to select from it
        const { data, error } = await supabase
            .from('product_likes')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            console.log('Table does not exist, it needs to be created via Supabase dashboard');
            console.log('Please run this SQL in your Supabase dashboard:');
            console.log(`
CREATE TABLE IF NOT EXISTS product_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_likes_user_id ON product_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_created_at ON product_likes(created_at);
            `);
        } else {
            console.log('Product likes table already exists');
            console.log(`Current likes count: ${data.count}`);
        }
        
    } catch (error) {
        console.error('Error setting up likes table:', error);
    }
}

// Run the setup
setupLikesTable();
