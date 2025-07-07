
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

// Register user with phone
async function registerUserWithPhone(chatId, userInfo, phoneNumber) {
    try {
        const fullName = userInfo.first_name + (userInfo.last_name ? ` ${userInfo.last_name}` : '');
        
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                telegram_id: chatId.toString(),
                full_name: fullName,
                phone: phoneNumber,
                type: 'phone',
                is_temp: false
            })
            .select()
            .single();

        if (createError) {
            console.error('Error registering user with phone:', createError);
            return null;
        }

        return newUser;
    } catch (error) {
        console.error('Error in registerUserWithPhone:', error);
        return null;
    }
}

module.exports = { getOrCreateUser, registerUserWithPhone };
