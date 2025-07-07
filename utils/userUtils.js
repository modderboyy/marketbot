const { supabase } = require('./database');

// Create or get user
async function getOrCreateUser(chatId, userInfo, requireRegistration = false) {
    try {
        const { data: existingUser, error: getUserError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', chatId.toString())
            .single();

        if (existingUser) {
            return existingUser;
        }

        if (requireRegistration) {
            return null; // Return null to trigger phone registration
        }

        // Create temporary user for browsing
        const tempId = `temp_${chatId}`;
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                telegram_id: chatId.toString(),
                full_name: userInfo.first_name + (userInfo.last_name ? ` ${userInfo.last_name}` : ''),
                temp_id: tempId,
                type: 'temp',
                is_temp: true
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating user:', createError);
            return null;
        }

        return newUser;
    } catch (error) {
        console.error('Error in getOrCreateUser:', error);
        return null;
    }
}

// Register user with phone number
async function registerUserWithPhone(chatId, userInfo, phoneNumber) {
    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', chatId)
            .single();

        if (existingUser) {
            return existingUser;
        }

        const { data: newUser, error } = await supabase
            .from('users')
            .insert([{
                telegram_id: chatId,
                full_name: userInfo.first_name + (userInfo.last_name ? ' ' + userInfo.last_name : ''),
                phone: phoneNumber,
                type: 'phone',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating user with phone:', error);
            return null;
        }

        return newUser;
    } catch (error) {
        console.error('Error in registerUserWithPhone:', error);
        return null;
    }
}

module.exports = {
    getOrCreateUser,
    registerUserWithPhone
};