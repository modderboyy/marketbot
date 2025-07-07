const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupDatabase() {
    console.log('Setting up database tables and test data...');
    
    try {
        // Test connection
        console.log('Testing Supabase connection...');
        const { data, error: testError } = await supabase.from('categories').select('count', { count: 'exact', head: true });
        
        if (testError && testError.code !== 'PGRST116') {
            console.error('Connection error:', testError);
            return;
        }
        
        console.log('Connection successful!');
        
        // Insert test categories
        console.log('Adding categories...');
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .upsert([
                { id: 1, name_uz: 'Elektronika', icon: '📱' },
                { id: 2, name_uz: 'Kiyimlar', icon: '👕' },
                { id: 3, name_uz: 'Kitoblar', icon: '📚' },
                { id: 4, name_uz: 'Sport', icon: '⚽' },
                { id: 5, name_uz: 'Uy-joy', icon: '🏠' }
            ], { onConflict: 'id' });
        
        if (catError) {
            console.error('Error inserting categories:', catError);
        } else {
            console.log('Categories added successfully');
        }
        
        // Insert test products
        console.log('Adding products...');
        const { data: products, error: prodError } = await supabase
            .from('products')
            .upsert([
                {
                    id: 1,
                    category_id: 1,
                    name_uz: 'Samsung Galaxy A54',
                    price: 3500000,
                    description_uz: 'Zamonaviy smartfon, 128GB xotira, 6GB RAM',
                    rating: 4.5,
                    order_count: 15,
                    like_count: 23,
                    has_delivery: true,
                    delivery_price: 0,
                    has_warranty: true,
                    warranty_months: 12,
                    is_returnable: true,
                    return_days: 14
                },
                {
                    id: 2,
                    category_id: 1,
                    name_uz: 'iPhone 15',
                    price: 12000000,
                    description_uz: 'Apple iPhone 15, 256GB xotira, eng so\'nggi model',
                    rating: 4.8,
                    order_count: 8,
                    like_count: 45,
                    has_delivery: true,
                    delivery_price: 50000,
                    has_warranty: true,
                    warranty_months: 24,
                    is_returnable: true,
                    return_days: 7
                },
                {
                    id: 3,
                    category_id: 2,
                    name_uz: 'Nike Air Max',
                    price: 800000,
                    description_uz: 'Sport krossovkalar, yuqori sifat, barcha o\'lchamlar',
                    rating: 4.3,
                    order_count: 32,
                    like_count: 18,
                    has_delivery: true,
                    delivery_price: 25000,
                    has_warranty: false,
                    warranty_months: 0,
                    is_returnable: true,
                    return_days: 30
                },
                {
                    id: 4,
                    category_id: 3,
                    name_uz: 'JavaScript Darsligi',
                    price: 150000,
                    description_uz: 'Dasturlashni o\'rganish uchun eng yaxshi kitob',
                    rating: 4.7,
                    order_count: 12,
                    like_count: 8,
                    has_delivery: true,
                    delivery_price: 15000,
                    has_warranty: false,
                    warranty_months: 0,
                    is_returnable: true,
                    return_days: 7
                },
                {
                    id: 5,
                    category_id: 4,
                    name_uz: 'Futbol to\'pi',
                    price: 250000,
                    description_uz: 'Professional futbol to\'pi, FIFA standartida',
                    rating: 4.4,
                    order_count: 25,
                    like_count: 12,
                    has_delivery: true,
                    delivery_price: 20000,
                    has_warranty: true,
                    warranty_months: 6,
                    is_returnable: true,
                    return_days: 14
                }
            ], { onConflict: 'id' });
        
        if (prodError) {
            console.error('Error inserting products:', prodError);
        } else {
            console.log('Products added successfully');
        }
        
        console.log('Database setup completed!');
        
        // Show current data
        const { data: catData } = await supabase.from('categories').select('*');
        const { data: prodData } = await supabase.from('products').select('*');
        
        console.log(`\nCategories: ${catData?.length || 0}`);
        console.log(`Products: ${prodData?.length || 0}`);
        
    } catch (error) {
        console.error('Setup error:', error);
    }
}

setupDatabase();