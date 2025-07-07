const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN } = require('../utils/constants');
const { handleMessage } = require('../handlers/messageHandler');
const { handleCallback } = require('../handlers/callbackHandler');
const { adminSessions } = require('../utils/sessionManager');
const { isAdmin } = require('../utils/helpers');

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN);

// Handle delivery address input
async function handleDeliveryAddress(chatId, messageText) {
    const session = adminSessions.get(chatId);
    if (!session || session.state !== 'awaiting_delivery_address') return;

    const { supabase } = require('../utils/database');
    const { safeEditMessage } = require('../utils/helpers');

    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'confirmed',
                delivery_address: messageText.trim(),
                updated_at: new Date().toISOString()
            })
            .eq('id', session.orderId);

        if (error) {
            await bot.sendMessage(chatId, '❌ Buyurtmani tasdiqlashda xatolik.');
            return;
        }

        // Get order details to notify customer
        const { data: order } = await supabase
            .from('orders')
            .select('user_id, products(name), users!inner(telegram_id)')
            .eq('id', session.orderId)
            .single();

        if (order && order.users) {
            await bot.sendMessage(order.users.telegram_id, `✅ *Buyurtma tasdiqlandi*\n\n📦 Mahsulot: ${order.products?.name}\n🏠 Olish manzili: ${messageText.trim()}\n\nMahsulotni olish uchun yuqoridagi manzilga keling.\n\n*Faqatgina borib kelganingizdan so'ng pastdagi tugmani bosing!*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Bordim', callback_data: `customer_arrived_${session.orderId}` },
                        { text: '❌ Bormadim', callback_data: `customer_not_arrived_${session.orderId}` }
                    ]]
                }
            });
        }

        await bot.sendMessage(chatId, '✅ Buyurtma tasdiqlandi. Mijozga manzil yuborildi.');
        adminSessions.delete(chatId);
    } catch (error) {
        console.error('Error in handleDeliveryAddress:', error);
        await bot.sendMessage(chatId, '❌ Buyurtmani tasdiqlashda xatolik yuz berdi.');
    }
}

// Webhook handler function
async function handleWebhook(req, res) {
    if (req.method === 'GET') {
        const webhookUrl = `https://${req.headers.host}/api/webhook`;

        try {
            await bot.setWebHook(webhookUrl);
            res.status(200).json({ 
                status: 'success', 
                message: 'Webhook set successfully',
                url: webhookUrl 
            });
        } catch (error) {
            console.error('Error setting webhook:', error);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to set webhook',
                error: error.message 
            });
        }
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const update = req.body;

        // Handle callback queries
        if (update.callback_query) {
            await handleCallback(bot, update.callback_query);
        }

        // Handle text messages
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const messageText = message.text;

            // Check if admin is waiting for delivery address
            const adminSession = adminSessions.get(chatId);
            if (adminSession && adminSession.state === 'awaiting_delivery_address' && isAdmin(chatId)) {
                await handleDeliveryAddress(chatId, messageText);
            } else {
                await handleMessage(bot, message);
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Error processing update:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Development server setup
if (require.main === module) {
    const express = require('express');
    const app = express();
    app.use(express.json());

    app.get('/api/webhook', handleWebhook);
    app.post('/api/webhook', handleWebhook);

    app.get('/', (req, res) => {
        res.json({ 
            status: 'Telegram Bot Server is running',
            webhook_url: '/api/webhook',
            time: new Date().toISOString()
        });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);

        if (process.env.REPLIT_DEPLOYMENT_URL) {
            const webhookUrl = `${process.env.REPLIT_DEPLOYMENT_URL}/api/webhook`;
            bot.setWebHook(webhookUrl).then(() => {
                console.log(`Webhook set to: ${webhookUrl}`);
            }).catch(err => {
                console.error('Failed to set webhook:', err);
            });
        }
    });
} else {
    module.exports = handleWebhook;
}