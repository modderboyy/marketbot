
const { supabase } = require('./database');

// Create or get user
async function getOrCreateUser(chatId, userInfo) {
    try {
        const { data: existingUser, error: getUserError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', chatId.toString())
            .single();

        if (existingUser) {
            return existingUser;
        }

        // Create new user
        const tempId = `temp_${chatId}`;
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                telegram_id: chatId.toString(),
                full_name: userInfo.first_name + (userInfo.last_name ? ` ${userInfo.last_name}` : ''),
                email: `${tempId}@temp.local`,
                temp_id: tempId,
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

module.exports = { getOrCreateUser };
