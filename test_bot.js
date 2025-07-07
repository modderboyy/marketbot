const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBotFunctions() {
    console.log('Testing bot functions...\n');
    
    // Test categories
    console.log('1. Testing categories fetch:');
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('name_uz');
        
        if (error) {
            console.log('   Error:', error);
        } else {
            console.log(`   ✅ Found ${categories.length} categories`);
            categories.forEach(cat => {
                console.log(`   - ${cat.icon} ${cat.name_uz} (ID: ${cat.id})`);
            });
        }
    } catch (err) {
        console.log('   Error:', err.message);
    }
    
    // Test products for first category
    console.log('\n2. Testing products fetch:');
    try {
        const { data: categories } = await supabase.from('categories').select('id').limit(1);
        if (categories && categories.length > 0) {
            const categoryId = categories[0].id;
            
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .eq('category_id', categoryId)
                .eq('is_active', true)
                .order('name');
            
            if (error) {
                console.log('   Error:', error);
            } else {
                console.log(`   ✅ Found ${products.length} products for category ${categoryId}`);
                products.forEach(prod => {
                    console.log(`   - ${prod.name} - ${prod.price} so'm`);
                });
            }
        }
    } catch (err) {
        console.log('   Error:', err.message);
    }
    
    // Test product details
    console.log('\n3. Testing product details:');
    try {
        const { data: products } = await supabase.from('products').select('id, name').limit(1);
        if (products && products.length > 0) {
            const productId = products[0].id;
            
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();
            
            if (error) {
                console.log('   Error:', error);
            } else {
                console.log(`   ✅ Product details for ${product.name}:`);
                console.log(`   - Price: ${product.price} so'm`);
                console.log(`   - Rating: ${product.rating}`);
                console.log(`   - Orders: ${product.order_count}`);
                console.log(`   - Delivery: ${product.has_delivery ? 'Yes' : 'No'}`);
            }
        }
    } catch (err) {
        console.log('   Error:', err.message);
    }
    
    console.log('\n✅ Bot functionality test completed!');
}

testBotFunctions();