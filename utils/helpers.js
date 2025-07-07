const { ADMIN_IDS } = require('./constants');

// Check if user is admin
function isAdmin(chatId) {
    const numericChatId = parseInt(chatId);
    return ADMIN_IDS.includes(numericChatId);
}

function validatePhoneNumber(phone) {
    const phoneRegex = /^\+998\d{9}$/;
    return phoneRegex.test(phone);
}

function validateBirthDate(dateStr) {
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!dateRegex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();

    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day &&
           date <= now &&
           year >= 1900;
}

// Safe message editing function
async function safeEditMessage(bot, chatId, messageId, text, options = {}) {
    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
        return true;
    } catch (error) {
        if (error.message.includes('there is no text in the message to edit') || 
            error.message.includes('message to edit not found') ||
            error.message.includes('query is too old')) {
            // Send new message if editing fails
            try {
                await bot.sendMessage(chatId, text, options);
                return true;
            } catch (sendError) {
                console.error('Error sending new message:', sendError);
                return false;
            }
        }
        console.error('Error editing message:', error);
        return false;
    }
}

module.exports = {
    isAdmin,
    validatePhoneNumber,
    validateBirthDate,
    safeEditMessage
};