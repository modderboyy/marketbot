const { userSessions, adminSessions } = require("../utils/sessionManager");
const { ORDER_STATES, ADMIN_STATES } = require("../utils/constants");
const {
    getOrCreateUser,
    registerUserWithPhone,
} = require("../utils/userUtils");
const {
    processOrderData,
    sendContactToAdmins,
    sendBroadcastMessage,
    startOrderProcess,
} = require("../utils/orderUtils");
const { isAdmin } = require("../utils/helpers");
const { handleStart, showAdminPanel, searchProducts } = require("./uiHandler");

async function handleMessage(bot, message) {
    const chatId = message.chat.id;
    const messageText = message.text;
    const userInfo = {
        telegram_id: chatId,
        first_name: message.from.first_name,
        last_name: message.from.last_name,
        username: message.from.username,
    };

    // Handle contact sharing
    if (message.contact) {
        const user = await getOrCreateUser(chatId, {
            ...userInfo,
            phone: message.contact.phone_number,
        });

        if (user) {
            await handleStart(bot, chatId, null, userInfo);
        }
        return;
    }

    // Handle commands
    if (messageText && messageText.startsWith("/")) {
        if (messageText.startsWith("/start")) {
            // Check for start parameter
            const parts = message.text.split(" ");
            if (parts.length > 1 && parts[1].startsWith("order_")) {
                const productId = parts[1].replace("order_", "");

                // Validate productId is a valid UUID
                const uuidRegex =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(productId)) {
                    await bot.sendMessage(
                        chatId,
                        "❌ Noto'g'ri mahsulot havolasi.",
                    );
                    return;
                }

                // Ensure user is registered first
                const user = await getOrCreateUser(chatId, userInfo, true);
                if (!user) {
                    // User needs to register with phone
                    const registrationMessage = `🔐 *Ro'yxatdan o'tish*

Buyurtma berish uchun telefon raqamingizni ulashing.`;

                    const keyboard = {
                        keyboard: [
                            [
                                {
                                    text: "📞 Telefon raqamni ulashish",
                                    request_contact: true,
                                },
                            ],
                        ],
                        one_time_keyboard: true,
                        resize_keyboard: true,
                    };

                    await bot.sendMessage(chatId, registrationMessage, {
                        reply_markup: keyboard,
                        parse_mode: "Markdown",
                    });
                    return;
                } else {
                    // User is registered, start order process
                    await startOrderProcess(bot, chatId, null, productId);
                    return;
                }
            }
            // If no order_ parameter, just handle the start
            await handleStart(bot, chatId, null, userInfo);
        } else if (messageText === "/admin" && isAdmin(chatId)) {
            await showAdminPanel(bot, chatId, null);
        } else {
            await bot.sendMessage(
                chatId,
                "Noma'lum buyruq. /start tugmasini bosing.",
            );
        }
        return;
    } else {
        // Check for session states
        const session = userSessions.get(chatId);
        const adminSession = adminSessions.get(chatId);

        if (session) {
            if (session.state === "awaiting_contact_message") {
                await sendContactToAdmins(bot, chatId, messageText, userInfo);
            } else if (session.state === "awaiting_search_query") {
                await searchProducts(bot, chatId, null, messageText);
                userSessions.delete(chatId);
            } else {
                await processOrderData(bot, chatId, messageText);
            }
        } else if (adminSession) {
            if (adminSession.state === "awaiting_reply_message") {
                await sendReplyToUser(
                    bot,
                    chatId,
                    messageText,
                    adminSession.replyToUserId,
                );
            } else if (adminSession.state === ADMIN_STATES.AWAITING_BROADCAST_MESSAGE) {
                await sendBroadcastMessage(bot, chatId, messageText);
            }
        } else {
            await bot.sendMessage(
                chatId,
                "Iltimos, /start tugmasini bosing yoki menyudan foydalaning.",
            );
        }
    }
}

async function sendReplyToUser(bot, adminChatId, message, userChatId) {
    const { supabase } = require("../utils/database");
    
    try {
        const adminSession = adminSessions.get(adminChatId);
        
        // Save admin response to database if contact message ID exists
        if (adminSession && adminSession.contactMessageId && adminSession.contactMessageId !== 'unknown') {
            await supabase
                .from('contact_messages')
                .update({
                    admin_response: message,
                    status: 'replied',
                    updated_at: new Date().toISOString()
                })
                .eq('id', adminSession.contactMessageId);
        }
        
        await bot.sendMessage(userChatId, `📨 *Admin javobi:*\n\n${message}`, {
            parse_mode: "Markdown",
        });

        await bot.sendMessage(adminChatId, "✅ Javob yuborildi.");

        // Clear admin session
        adminSessions.delete(adminChatId);
    } catch (error) {
        console.error("Error sending reply:", error);
        await bot.sendMessage(adminChatId, "❌ Javob yuborishda xatolik.");
    }
}

module.exports = { handleMessage };
