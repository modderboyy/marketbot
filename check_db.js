const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDatabase() {
    try {
        console.log('Checking categories table...');
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('*')
            .limit(5);
        
        if (catError) {
            console.log('Categories error:', catError);
        } else {
            console.log('Categories found:', categories?.length || 0);
            if (categories && categories.length > 0) {
                console.log('Sample category:', categories[0]);
            }
        }
        
        console.log('\nChecking products table...');
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('*')
            .limit(5);
        
        if (prodError) {
            console.log('Products error:', prodError);
        } else {
            console.log('Products found:', products?.length || 0);
            if (products && products.length > 0) {
                console.log('Sample product:', products[0]);
            }
        }
        
        console.log('\nChecking orders table...');
        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .limit(5);
        
        if (orderError) {
            console.log('Orders error:', orderError);
        } else {
            console.log('Orders found:', orders?.length || 0);
            if (orders && orders.length > 0) {
                console.log('Sample order:', orders[0]);
            }
        }
        
    } catch (error) {
        console.error('Database check error:', error);
    }
}

checkDatabase();