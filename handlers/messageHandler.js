
const { userSessions, adminSessions } = require('../utils/sessionManager');
const { ORDER_STATES, ADMIN_STATES } = require('../utils/constants');
const { getOrCreateUser } = require('../utils/userUtils');
const { processOrderData, sendContactToAdmins, sendBroadcastMessage } = require('../utils/orderUtils');
const { isAdmin } = require('../utils/helpers');
const { handleStart, showAdminPanel } = require('./uiHandler');

async function handleMessage(bot, message) {
    const chatId = message.chat.id;
    const messageText = message.text;
    const userInfo = message.from;

    if (messageText === '/start') {
        await handleStart(bot, chatId, null, userInfo);
    } else if (messageText === '/admin') {
        if (isAdmin(chatId)) {
            await showAdminPanel(bot, chatId, null);
        } else {
            await bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q.');
        }
    } else {
        // Check for session states
        const session = userSessions.get(chatId);
        const adminSession = adminSessions.get(chatId);

        if (session) {
            if (session.state === 'awaiting_contact_message') {
                await sendContactToAdmins(bot, chatId, messageText, userInfo);
            } else if (session.state === 'awaiting_reply_message') {
                await sendReplyToUser(bot, chatId, messageText, session.replyToUserId);
            } else {
                await processOrderData(bot, chatId, messageText);
            }
        } else if (adminSession && adminSession.state === ADMIN_STATES.AWAITING_BROADCAST_MESSAGE) {
            await sendBroadcastMessage(bot, chatId, messageText);
        } else {
            await bot.sendMessage(chatId, 'Iltimos, /start tugmasini bosing yoki menyudan foydalaning.');
        }
    }
}

async function sendReplyToUser(bot, adminChatId, message, userChatId) {
    try {
        await bot.sendMessage(userChatId, `📨 *Admin javobi:*\n\n${message}`, {
            parse_mode: 'Markdown'
        });
        
        await bot.sendMessage(adminChatId, '✅ Javob yuborildi.');
        
        // Clear admin session
        adminSessions.delete(adminChatId);
    } catch (error) {
        console.error('Error sending reply:', error);
        await bot.sendMessage(adminChatId, '❌ Javob yuborishda xatolik.');
    }
}

module.exports = { handleMessage };
