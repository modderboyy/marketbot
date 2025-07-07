const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN || 'your_bot_token_here';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN);

// User session storage for order flow
const userSessions = new Map();

// Order flow states
const ORDER_STATES = {
    AWAITING_NAME: 'awaiting_name',
    AWAITING_ADDRESS: 'awaiting_address',
    AWAITING_PHONE: 'awaiting_phone',
    AWAITING_QUANTITY: 'awaiting_quantity'
};

// Utility functions
function formatProductMessage(product) {
    const deliveryText = product.has_delivery ? 
        `🚚 Yetkazib berish: ${product.delivery_price > 0 ? `${product.delivery_price} so'm` : 'Bepul'}` : 
        '🚫 Yetkazib berish yo\'q';
    
    const warrantyText = product.has_warranty ? 
        `🛡 Kafolat: ${product.warranty_months} oy` : 
        '🚫 Kafolat yo\'q';
    
    const returnText = product.is_returnable ? 
        `↩️ Qaytarish: ${product.return_days} kun ichida` : 
        '🚫 Qaytarib bo\'lmaydi';

    return `📦 *${product.name}*

💰 Narx: ${product.price} so'm
📝 Ta'rif: ${product.description}

📊 Statistika:
⭐ Reyting: ${product.rating || 4.5}/5
🛒 Buyurtmalar: ${product.order_count || 0}
❤️ Yoqtirishlar: ${product.like_count || 0}

🚚 Yetkazib berish va xizmatlar:
${deliveryText}
${warrantyText}
${returnText}`;
}

function validatePhoneNumber(phone) {
    const phoneRegex = /^\+998\d{9}$/;
    return phoneRegex.test(phone);
}

// Handle /start command
async function handleStart(chatId, messageId = null) {
    const welcomeMessage = `🛍 Xush kelibsiz!

Bizning onlayn do'konimizga xush kelibsiz. Bu yerda siz turli xil mahsulotlarni ko'rishingiz va buyurtma berishingiz mumkin.

Quyidagi tugmalardan birini tanlang:`;

    const keyboard = {
        inline_keyboard: [[
            { text: '🛒 Sotib olish', callback_data: 'buy_products' }
        ], [
            { text: '❓ Yordam', callback_data: 'help' }
        ]]
    };

    const options = {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    };

    if (messageId) {
        await bot.editMessageText(welcomeMessage, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
    } else {
        await bot.sendMessage(chatId, welcomeMessage, options);
    }
}

// Handle /help command
async function handleHelp(chatId, messageId = null) {
    const helpMessage = `❓ *Yordam*

Bu bot orqali siz:
• 🛒 Mahsulotlarni ko'rishingiz
• 📝 Buyurtma berishingiz
• ❤️ Mahsulotlarni yoqtirishingiz

*Buyruqlar:*
/start - Botni ishga tushirish
/help - Yordam olish

*Qanday foydalanish:*
1. "Sotib olish" tugmasini bosing
2. Kategoriyani tanlang
3. Mahsulotni tanlang
4. "Buyurtma berish" tugmasini bosing
5. Ma'lumotlaringizni kiriting

Savollaringiz bo'lsa, biz bilan bog'laning!`;

    const keyboard = {
        inline_keyboard: [[
            { text: '🔙 Orqaga', callback_data: 'main_menu' }
        ]]
    };

    const options = {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    };

    if (messageId) {
        await bot.editMessageText(helpMessage, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
    } else {
        await bot.sendMessage(chatId, helpMessage, options);
    }
}

// Show categories
async function showCategories(chatId, messageId) {
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('name_uz');

        if (error) {
            console.error('Error fetching categories:', error);
            await bot.editMessageText('❌ Kategoriyalarni yuklashda xatolik yuz berdi.', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        if (!categories || categories.length === 0) {
            await bot.editMessageText('📭 Hozircha kategoriyalar mavjud emas.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        const message = '🗂 *Kategoriyalarni tanlang:*';
        
        const keyboard = {
            inline_keyboard: [
                ...categories.map(category => [
                    { text: `${category.icon || '📦'} ${category.name_uz}`, callback_data: `category_${category.id}` }
                ]),
                [{ text: '🔙 Orqaga', callback_data: 'main_menu' }]
            ]
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showCategories:', error);
        await bot.editMessageText('❌ Xatolik yuz berdi.', {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

// Show products by category
async function showProducts(chatId, messageId, categoryId) {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Error fetching products:', error);
            await bot.editMessageText('❌ Mahsulotlarni yuklashda xatolik yuz berdi.', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        if (!products || products.length === 0) {
            await bot.editMessageText('📭 Bu kategoriyada mahsulotlar mavjud emas.', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Kategoriyalarga qaytish', callback_data: 'buy_products' }
                    ]]
                }
            });
            return;
        }

        const message = '📦 *Mahsulotlarni tanlang:*';
        
        const keyboard = {
            inline_keyboard: [
                ...products.map(product => [
                    { text: `${product.name} - ${product.price} so'm`, callback_data: `product_${product.id}` }
                ]),
                [{ text: '🔙 Kategoriyalarga qaytish', callback_data: 'buy_products' }]
            ]
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProducts:', error);
        await bot.editMessageText('❌ Xatolik yuz berdi.', {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

// Show product details
async function showProductDetails(chatId, messageId, productId) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            console.error('Error fetching product:', error);
            await bot.editMessageText('❌ Mahsulot topilmadi.', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const message = formatProductMessage(product);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🛒 Buyurtma berish', callback_data: `order_${productId}` },
                    { text: '❤️ Yoqtirish', callback_data: `like_${productId}` }
                ],
                [{ text: '🔙 Orqaga', callback_data: `category_${product.category_id}` }]
            ]
        };

        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProductDetails:', error);
        await bot.editMessageText('❌ Xatolik yuz berdi.', {
            chat_id: chatId,
            message_id: messageId
        });
    }
}

// Handle like product
async function handleLikeProduct(chatId, messageId, productId) {
    try {
        // Increment like count
        const { error } = await supabase
            .from('products')
            .update({ like_count: supabase.sql`like_count + 1` })
            .eq('id', productId);

        if (error) {
            console.error('Error updating like count:', error);
            await bot.answerCallbackQuery(messageId, { text: '❌ Xatolik yuz berdi.' });
            return;
        }

        await bot.answerCallbackQuery(messageId, { text: '❤️ Yoqtirildi!' });
        
        // Refresh product details
        await showProductDetails(chatId, messageId, productId);
    } catch (error) {
        console.error('Error in handleLikeProduct:', error);
        await bot.answerCallbackQuery(messageId, { text: '❌ Xatolik yuz berdi.' });
    }
}

// Start order process
async function startOrderProcess(chatId, messageId, productId) {
    userSessions.set(chatId, {
        productId: productId,
        state: ORDER_STATES.AWAITING_NAME,
        orderData: {}
    });

    await bot.editMessageText('👤 *Buyurtma berish*\n\nIltimos, to\'liq ismingizni kiriting (Ism Familiya):', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: `product_${productId}` }
            ]]
        }
    });
}

// Process order data
async function processOrderData(chatId, messageText) {
    const session = userSessions.get(chatId);
    if (!session) return;

    const { state, orderData, productId } = session;

    switch (state) {
        case ORDER_STATES.AWAITING_NAME:
            if (messageText.trim().split(' ').length < 2) {
                await bot.sendMessage(chatId, '❌ Iltimos, ism va familiyangizni to\'liq kiriting.');
                return;
            }
            orderData.full_name = messageText.trim();
            session.state = ORDER_STATES.AWAITING_ADDRESS;
            await bot.sendMessage(chatId, '🏠 To\'liq manzilingizni kiriting:');
            break;

        case ORDER_STATES.AWAITING_ADDRESS:
            orderData.address = messageText.trim();
            session.state = ORDER_STATES.AWAITING_PHONE;
            await bot.sendMessage(chatId, '📞 Telefon raqamingizni kiriting (+998XXXXXXXXX formatida):');
            break;

        case ORDER_STATES.AWAITING_PHONE:
            if (!validatePhoneNumber(messageText.trim())) {
                await bot.sendMessage(chatId, '❌ Iltimos, telefon raqamni to\'g\'ri formatda kiriting (+998XXXXXXXXX).');
                return;
            }
            orderData.phone = messageText.trim();
            session.state = ORDER_STATES.AWAITING_QUANTITY;
            await bot.sendMessage(chatId, '🔢 Nechta mahsulot buyurtma qilmoqchisiz? (raqam kiriting):');
            break;

        case ORDER_STATES.AWAITING_QUANTITY:
            const quantity = parseInt(messageText.trim());
            if (isNaN(quantity) || quantity <= 0) {
                await bot.sendMessage(chatId, '❌ Iltimos, to\'g\'ri miqdorni kiriting (musbat son).');
                return;
            }
            orderData.quantity = quantity;
            await completeOrder(chatId, session);
            break;
    }

    userSessions.set(chatId, session);
}

// Complete order
async function completeOrder(chatId, session) {
    try {
        const { orderData, productId } = session;
        
        // Get product details for price calculation
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('price, name')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            await bot.sendMessage(chatId, '❌ Mahsulot ma\'lumotlarini olishda xatolik yuz berdi.');
            return;
        }

        const totalPrice = product.price * orderData.quantity;

        // Save order to database
        const { error } = await supabase
            .from('orders')
            .insert({
                product_id: productId,
                full_name: orderData.full_name,
                phone: orderData.phone,
                address: orderData.address,
                quantity: orderData.quantity,
                total_amount: totalPrice,
                status: 'pending',
                order_type: 'telegram_bot'
            });

        if (error) {
            console.error('Error saving order:', error);
            await bot.sendMessage(chatId, '❌ Buyurtmani saqlashda xatolik yuz berdi.');
            return;
        }

        // Update product order count
        await supabase
            .from('products')
            .update({ order_count: supabase.sql`order_count + 1` })
            .eq('id', productId);

        const successMessage = `✅ *Buyurtma muvaffaqiyatli qabul qilindi!*

📦 Mahsulot: ${product.name}
🔢 Miqdor: ${orderData.quantity}
💰 Jami summa: ${totalPrice} so'm

📞 Tez orada siz bilan bog'lanamiz!`;

        await bot.sendMessage(chatId, successMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🏠 Bosh sahifa', callback_data: 'main_menu' },
                    { text: '🛒 Yana buyurtma', callback_data: 'buy_products' }
                ]]
            }
        });

        // Clear session
        userSessions.delete(chatId);
    } catch (error) {
        console.error('Error in completeOrder:', error);
        await bot.sendMessage(chatId, '❌ Buyurtmani yakunlashda xatolik yuz berdi.');
    }
}

// Webhook handler function
async function handleWebhook(req, res) {
    if (req.method === 'GET') {
        // Setup webhook on first GET request
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

        // Handle callback queries (inline keyboard buttons)
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            const data = callbackQuery.data;

            // Answer callback query to remove loading state
            await bot.answerCallbackQuery(callbackQuery.id);

            if (data === 'main_menu') {
                await handleStart(chatId, messageId);
            } else if (data === 'help') {
                await handleHelp(chatId, messageId);
            } else if (data === 'buy_products') {
                await showCategories(chatId, messageId);
            } else if (data.startsWith('category_')) {
                const categoryId = data.split('_')[1];
                await showProducts(chatId, messageId, categoryId);
            } else if (data.startsWith('product_')) {
                const productId = data.split('_')[1];
                await showProductDetails(chatId, messageId, productId);
            } else if (data.startsWith('order_')) {
                const productId = data.split('_')[1];
                await startOrderProcess(chatId, messageId, productId);
            } else if (data.startsWith('like_')) {
                const productId = data.split('_')[1];
                await handleLikeProduct(chatId, callbackQuery.id, productId);
            }
        }

        // Handle text messages
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const messageText = message.text;

            if (messageText === '/start') {
                await handleStart(chatId);
            } else if (messageText === '/help') {
                await handleHelp(chatId);
            } else {
                // Check if user is in order flow
                const session = userSessions.get(chatId);
                if (session) {
                    await processOrderData(chatId, messageText);
                } else {
                    // Default response for unknown commands
                    await bot.sendMessage(chatId, 'Iltimos, /start tugmasini bosing yoki menyudan foydalaning.');
                }
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
    // Add express for development server
    const express = require('express');
    const app = express();
    app.use(express.json());
    
    // Routes
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
        
        // Auto-setup webhook for development
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
    // Export for Vercel serverless function
    module.exports = handleWebhook;
}
