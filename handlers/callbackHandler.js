
const { userSessions, adminSessions } = require('../utils/sessionManager');
const { ADMIN_STATES } = require('../utils/constants');
const { isAdmin } = require('../utils/helpers');
const { 
    handleStart, 
    showProfile, 
    showMyOrders, 
    showOrderDetail, 
    showAdminPanel, 
    showAdminStats, 
    showCategories, 
    showProducts, 
    showProductDetails,
    handleContactAdmin,
    handleBroadcast,
    showAdminOrders,
    showAdminOrderDetail,
    handleSearch,
    searchProducts
} = require('./uiHandler');
const { startOrderProcess, confirmOrder, rejectOrder, deliverOrder } = require('../utils/orderUtils');
const { safeEditMessage } = require('../utils/helpers');

async function handleCallback(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Safely answer callback query
    try {
        await bot.answerCallbackQuery(callbackQuery.id);
    } catch (callbackError) {
        console.log('Callback query timeout, continuing...');
    }

    // Main menu handlers
    if (data === 'main_menu') {
        await handleStart(bot, chatId, messageId);
    } else if (data === 'help') {
        await safeEditMessage(bot, chatId, messageId, '❓ *Yordam*\n\nBu bot Global Market do\'koni uchun mo\'ljallangan.\n\n/start - Botni qayta ishga tushirish\n/admin - Admin panel (faqat adminlar uchun)', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Orqaga', callback_data: 'main_menu' }
                ]]
            }
        });
    } else if (data === 'my_profile') {
        await showProfile(bot, chatId, messageId);
    } else if (data === 'my_orders') {
        await showMyOrders(bot, chatId, messageId);
    } else if (data === 'contact_admin') {
        await handleContactAdmin(bot, chatId, messageId);
    } else if (data === 'search_products') {
        await handleSearch(bot, chatId, messageId);
    } 
    // Admin handlers
    else if (data === 'admin_panel') {
        await showAdminPanel(bot, chatId, messageId);
    } else if (data === 'admin_stats') {
        await showAdminStats(bot, chatId, messageId);
    } else if (data === 'admin_broadcast') {
        await handleBroadcast(bot, chatId, messageId);
    } else if (data === 'admin_orders') {
        await showAdminOrders(bot, chatId, messageId);
    } else if (data.startsWith('admin_order_')) {
        const orderId = data.split('_')[2];
        await showAdminOrderDetail(bot, chatId, messageId, orderId);
    }
    // Product handlers
    else if (data === 'buy_products') {
        await showCategories(bot, chatId, messageId);
    } else if (data.startsWith('category_')) {
        const categoryId = data.split('_')[1];
        await showProducts(bot, chatId, messageId, categoryId);
    } else if (data.startsWith('product_')) {
        const productId = data.split('_')[1];
        await showProductDetails(bot, chatId, messageId, productId);
    } else if (data.startsWith('order_')) {
        const productId = data.split('_')[1];
        await startOrderProcess(bot, chatId, messageId, productId);
    } else if (data.startsWith('order_detail_')) {
        const orderId = data.split('_')[2];
        await showOrderDetail(bot, chatId, messageId, orderId);
    }
    // Order management
    else if (data.startsWith('confirm_order_')) {
        const orderId = data.split('_')[2];
        await confirmOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('reject_order_')) {
        const orderId = data.split('_')[2];
        await rejectOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('deliver_order_')) {
        const orderId = data.split('_')[2];
        await deliverOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('customer_arrived_')) {
        const orderId = data.split('_')[2];
        await handleCustomerArrived(bot, chatId, messageId, orderId);
    } else if (data.startsWith('customer_not_arrived_')) {
        const orderId = data.split('_')[3];
        await handleCustomerNotArrived(bot, chatId, messageId, orderId);
    } else if (data.startsWith('product_delivered_')) {
        const orderId = data.split('_')[2];
        await handleProductDelivered(bot, chatId, messageId, orderId);
    } else if (data.startsWith('product_not_delivered_')) {
        const orderId = data.split('_')[3];
        await handleProductNotDelivered(bot, chatId, messageId, orderId);
    }
    // Reply handler
    else if (data.startsWith('reply_')) {
        const userChatId = data.split('_')[1];
        adminSessions.set(chatId, { 
            state: 'awaiting_reply_message', 
            replyToUserId: userChatId 
        });
        await safeEditMessage(bot, chatId, messageId, '📝 Javob xabarini yozing:', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '❌ Bekor qilish', callback_data: 'admin_panel' }
                ]]
            }
        });
    }
}

async function handleCustomerArrived(bot, chatId, messageId, orderId) {
    try {
        const { supabase } = require('../utils/database');
        const { ADMIN_IDS } = require('../utils/constants');
        
        const { data: order, error } = await supabase
            .from('orders')
            .select('*, products(name)')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma topilmadi.');
            return;
        }

        const adminMessage = `👤 *Mijoz keldi*\n\n📦 Mahsulot: ${order.products?.name}\n👤 Mijoz: ${order.full_name}\n📞 Telefon: ${order.phone}\n\n❓ Mahsulot berildi?`;

        for (const adminId of ADMIN_IDS) {
            try {
                await bot.sendMessage(adminId, adminMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Ha, berildi', callback_data: `product_delivered_${orderId}` },
                            { text: '❌ Yo\'q, berilmadi', callback_data: `product_not_delivered_${orderId}` }
                        ]]
                    }
                });
            } catch (error) {
                console.error(`Error sending to admin ${adminId}:`, error);
            }
        }

        await safeEditMessage(bot, chatId, messageId, '✅ Adminlarga xabar yuborildi. Mahsulotni olganingizdan so\'ng admin tasdiqlaydi.');
    } catch (error) {
        console.error('Error in handleCustomerArrived:', error);
    }
}

async function handleCustomerNotArrived(bot, chatId, messageId, orderId) {
    await safeEditMessage(bot, chatId, messageId, '❌ Iltimos, avval kelgan bo\'lganingizdan so\'ng bosing.', {
        reply_markup: {
            inline_keyboard: [[
                { text: '🔙 Orqaga', callback_data: 'my_orders' }
            ]]
        }
    });
}

async function handleProductDelivered(bot, chatId, messageId, orderId) {
    try {
        const { supabase } = require('../utils/database');
        
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'completed',
                delivery_status: 'delivered',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma holatini yangilashda xatolik.');
            return;
        }

        // Get order details to notify customer
        const { data: order } = await supabase
            .from('orders')
            .select('user_id, products(name), users!inner(telegram_id)')
            .eq('id', orderId)
            .single();

        if (order && order.users) {
            await bot.sendMessage(order.users.telegram_id, `✅ *Buyurtma yakunlandi*\n\n📦 Mahsulot: ${order.products?.name}\n\nRahmat! Bizdan xarid qilganingiz uchun tashakkur!`, {
                parse_mode: 'Markdown'
            });
        }

        await safeEditMessage(bot, chatId, messageId, '✅ Buyurtma muvaffaqiyatli yakunlandi. Mijozga xabar yuborildi.');
    } catch (error) {
        console.error('Error in handleProductDelivered:', error);
    }
}

async function handleProductNotDelivered(bot, chatId, messageId, orderId) {
    await safeEditMessage(bot, chatId, messageId, '❌ Mahsulot berilmadi deb belgilandi.', {
        reply_markup: {
            inline_keyboard: [[
                { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
            ]]
        }
    });
}

module.exports = { handleCallback };
