const { supabase } = require('./utils/database');

async function setupContactTable() {
    try {
        // Test if table exists by trying a simple select
        const { data: testData, error: testError } = await supabase
            .from('contact_messages')
            .select('id')
            .limit(1);

        if (testError) {
            console.log('Table does not exist, likely needs to be created in Supabase dashboard');
            console.log('Please create the table manually in Supabase with this SQL:');
            console.log(`
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid not null default gen_random_uuid (),
    name character varying(255) not null,
    email character varying(255) null,
    phone character varying(20) null,
    subject character varying(255) null,
    message text not null,
    status character varying(50) null default 'new'::character varying,
    admin_response text null,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    constraint contact_messages_pkey primary key (id)
);
            `);
        } else {
            console.log('✅ contact_messages table exists and is accessible');
        }

        // Test insert a sample message (will be deleted)
        const { data: insertData, error: insertError } = await supabase
            .from('contact_messages')
            .insert({
                name: 'Test User',
                phone: '+998901234567',
                message: 'Test message',
                subject: 'Test'
            })
            .select()
            .single();

        if (insertError) {
            console.error('Insert test failed:', insertError);
        } else {
            console.log('✅ Insert test successful');
            
            // Delete the test message
            await supabase
                .from('contact_messages')
                .delete()
                .eq('id', insertData.id);
            console.log('✅ Test message cleaned up');
        }

    } catch (error) {
        console.error('Setup failed:', error);
    }
}

setupContactTable();