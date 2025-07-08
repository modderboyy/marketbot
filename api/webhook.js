const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN } = require('../utils/constants');
const { handleMessage } = require('../handlers/messageHandler');
const { handleCallback } = require('../handlers/callbackHandler');
const { adminSessions } = require('../utils/sessionManager');
const { isAdmin } = require('../utils/helpers');

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN);



// Handle inline queries for search
async function handleInlineQuery(bot, inlineQuery) {
    const { supabase } = require('../utils/database');
    const query = inlineQuery.query.trim();

    if (!query) {
        await bot.answerInlineQuery(inlineQuery.id, [], {
            switch_pm_text: "🔍 Mahsulot qidirish",
            switch_pm_parameter: "search"
        });
        return;
    }

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .or(`name.ilike.%${query}%,description.ilike.%${query}%,author.ilike.%${query}%`)
            .limit(10);

        if (error) {
            console.error('Error searching products:', error);
            return;
        }

        const results = products.map(product => ({
            type: 'article',
            id: product.id,
            title: product.name,
            description: `💰 ${product.price} so'm | 👨‍💼 ${product.author || 'Noma\'lum'}`,
            input_message_content: {
                message_text: `📦 *${product.name}*\n\n💰 Narx: ${product.price} so'm\n👨‍💼 Muallif: ${product.author || 'Noma\'lum'}\n📝 Ta'rif: ${product.description?.substring(0, 150)}...\n\n🛒 Buyurtma berish uchun pastdagi tugmani bosing`,
                parse_mode: 'Markdown'
            },
            reply_markup: {
                inline_keyboard: [[
                    { text: '🛒 Buyurtma berish', url: `https://t.me/${process.env.BOT_USERNAME || 'globalmarketshopbot'}?start=order_${product.id}` }
                ]]
            }
        }));

        await bot.answerInlineQuery(inlineQuery.id, results, {
            cache_time: 10
        });
    } catch (error) {
        console.error('Error in handleInlineQuery:', error);
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

        // Handle inline queries
        if (update.inline_query) {
            await handleInlineQuery(bot, update.inline_query);
        }

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
            if (adminSession && adminSession.state === 'awaiting_delivery_address') {
                await handleDeliveryAddress(bot, chatId, messageText, adminSession);
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