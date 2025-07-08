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
        await handleCustomerOrders(bot, chatId, messageId);
    } else if (data.startsWith('order_detail_')) {
        const orderId = data.replace('order_detail_', '');
        await handleOrderDetail(bot, chatId, messageId, orderId);
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
    } else if (data.startsWith('confirm_order_')) {
        const orderId = data.replace('confirm_order_', '');
        await confirmOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('reject_order_')) {
        const orderId = data.replace('reject_order_', '');
        await rejectOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('deliver_order_')) {
        const orderId = data.replace('deliver_order_', '');
        await deliverOrder(bot, chatId, messageId, orderId);
    } else if (data.startsWith('customer_arrived_')) {
        const orderId = data.replace('customer_arrived_', '');
        await handleCustomerArrived(bot, chatId, messageId, orderId);
    } else if (data.startsWith('customer_not_arrived_')) {
        const orderId = data.replace('customer_not_arrived_', '');
        await handleCustomerNotArrived(bot, chatId, messageId, orderId);
    } else if (data.startsWith('product_delivered_')) {
        const orderId = data.replace('product_delivered_', '');
        await handleProductDelivered(bot, chatId, messageId, orderId);
    } else if (data.startsWith('product_not_delivered_')) {
        const orderId = data.replace('product_not_delivered_', '');
        await handleProductNotDelivered(bot, chatId, messageId, orderId);
    } else if (data.startsWith('reply_')) {
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
    // Address selection callbacks
    else if (data === 'select_region_qashqadaryo') {
        const { ORDER_STATES } = require('../utils/constants');
        const session = userSessions.get(chatId);
        if (session) {
            session.state = ORDER_STATES.AWAITING_DISTRICT;
            await safeEditMessage(bot, chatId, messageId, '🏙 Tumanni tanlang:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'G\'uzor tumani', callback_data: 'select_district_guzor' }],
                        [{ text: '❌ Bekor qilish', callback_data: `product_${session.productId}` }]
                    ]
                }
            });
        }
    } else if (data === 'select_district_guzor') {
        const { ORDER_STATES } = require('../utils/constants');
        const session = userSessions.get(chatId);
        if (session) {
            session.state = ORDER_STATES.AWAITING_NEIGHBORHOOD;
            await safeEditMessage(bot, chatId, messageId, '🏘 Mahalla nomini kiriting:', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '❌ Bekor qilish', callback_data: `product_${session.productId}` }
                    ]]
                }
            });
        }
    }
    // Admin confirmation callbacks
    else if (data.startsWith('confirm_main_center_')) {
        const orderId = data.replace('confirm_main_center_', '');
        await handleMainCenterConfirmation(bot, chatId, messageId, orderId);
    } else if (data.startsWith('confirm_manual_address_')) {
        const orderId = data.replace('confirm_manual_address_', '');
        await handleManualAddressConfirmation(bot, chatId, messageId, orderId);
    }
}

async function handleCustomerArrived(bot, chatId, messageId, orderId) {
    try {
        const { supabase } = require('../utils/database');
        const { ADMIN_IDS } = require('../utils/constants');

        // Update is_client_went to true
        const { error: updateError } = await supabase
            .from('orders')
            .update({ 
                is_client_went: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('Error updating client went status:', updateError);
            await safeEditMessage(bot, chatId, messageId, '❌ Xatolik yuz berdi.');
            return;
        }

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
    try {
        const { supabase } = require('../utils/database');

        // Update is_client_went to false
        const { error } = await supabase
            .from('orders')
            .update({ 
                is_client_went: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating client went status:', error);
        }

        await safeEditMessage(bot, chatId, messageId, '❌ Iltimos, avval kelgan bo\'lganingizdan so\'ng bosing.', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Orqaga', callback_data: 'my_orders' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in handleCustomerNotArrived:', error);
    }
}

async function handleProductDelivered(bot, chatId, messageId, orderId) {
    const { supabase } = require('../utils/database');
    const { safeEditMessage } = require('../utils/helpers');

    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'completed',
                delivery_status: true,
                is_client_claimed: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order status:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmani yakunlashda xatolik.');
            return;
        }

        // Notify customer
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select(`
                user_id,
                products(name),
                users!inner(telegram_id)
            `)
            .eq('id', orderId)
            .single();

        if (fetchError) {
            console.error('Error fetching order for notification:', fetchError);
        } else if (order && order.users) {
            await bot.sendMessage(order.users.telegram_id, `✅ *Buyurtma yakunlandi*\n\n📦 Mahsulot: ${order.products?.name}\n\nRahmat! Bizdan xarid qilganingiz uchun tashakkur!`, {
                parse_mode: 'Markdown'
            });
        }

        await safeEditMessage(bot, chatId, messageId, '✅ Buyurtma muvaffaqiyatli yakunlandi. Mijozga xabar yuborildi.', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in handleProductDelivered:', error);
        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmani yakunlashda xatolik yuz berdi.');
    }
}

async function handleProductNotDelivered(bot, chatId, messageId, orderId) {
    const { supabase } = require('../utils/database');
    const { safeEditMessage } = require('../utils/helpers');

    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'cancelled',
                delivery_status: false,
                is_client_claimed: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order status:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma holatini yangilashda xatolik.');
            return;
        }

        await safeEditMessage(bot, chatId, messageId, '❌ Mahsulot berilmadi deb belgilandi. Buyurtma bekor qilindi.', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in handleProductNotDelivered:', error);
        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma holatini yangilashda xatolik yuz berdi.');
    }
}

async function handleMainCenterConfirmation(bot, chatId, messageId, orderId) {
    try {
        const { supabase } = require('../utils/database');

        const mainCenterAddress = "Qashqadaryo viloyati, G'uzor tumani, Fazo yonida";

        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'confirmed',
                delivery_address: mainCenterAddress,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmani tasdiqlashda xatolik.');
            return;
        }

        // Get order details to notify customer
        const { data: order } = await supabase
            .from('orders')
            .select('user_id, products(name), users!inner(telegram_id)')
            .eq('id', orderId)
            .single();

        if (order && order.users) {
            await bot.sendMessage(order.users.telegram_id, `✅ *Buyurtma tasdiqlandi*\n\n📦 Mahsulot: ${order.products?.name}\n🏠 Olish manzili: ${mainCenterAddress}\n\nMahsulotni olish uchun yuqoridagi manzilga keling.\n\n*Faqatgina borib kelganingizdan so'ng pastdagi tugmani bosing!*`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Bordim', callback_data: `customer_arrived_${orderId}` },
                        { text: '❌ Bormadim', callback_data: `customer_not_arrived_${orderId}` }
                    ]]
                }
            });
        }

        await safeEditMessage(bot, chatId, messageId, '✅ Buyurtma asosiy markazga tasdiqlandi. Mijozga manzil yuborildi.');
    } catch (error) {
        console.error('Error in handleMainCenterConfirmation:', error);
        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmani tasdiqlashda xatolik yuz berdi.');
    }
}

async function handleManualAddressConfirmation(bot, chatId, messageId, orderId) {
    const { adminSessions } = require('../utils/sessionManager');

    adminSessions.set(chatId, { 
        state: 'awaiting_delivery_address', 
        orderId: orderId 
    });

    await safeEditMessage(bot, chatId, messageId, '✍️ *Qo\'lda yetkazish manzilini kiriting:*', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: 'admin_panel' }
            ]]
        }
    });
}

async function handleCustomerOrders(bot, chatId, messageId) {
    const { supabase } = require('../utils/database');
    const { safeEditMessage } = require('../utils/helpers');

    try {
        // First get user ID from telegram_id
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', chatId)
            .single();

        if (userError || !user) {
            await safeEditMessage(bot, chatId, messageId, '❌ Foydalanuvchi ma\'lumotlari topilmadi.');
            return;
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                product_id,
                full_name,
                phone,
                address,
                quantity,
                total_amount,
                status,
                delivery_status,
                created_at,
                products(name, price)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmalarni yuklashda xatolik yuz berdi.');
            return;
        }

        if (!orders || orders.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📋 Sizda hech qanday buyurtma yo\'q.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        let ordersList = '';
        const keyboard = [];

        orders.forEach((order, index) => {
            const statusIcon = order.status === 'confirmed' ? '✅' : order.status === 'cancelled' ? '❌' : '⏳';
            const deliveryIcon = order.delivery_status ? '🚚' : '📦';

            ordersList += `${index + 1}. ${statusIcon} ${order.products?.name || 'Noma\'lum mahsulot'}\n`;
            ordersList += `   💰 ${order.total_amount} so'm\n`;
            ordersList += `   📅 ${new Date(order.created_at).toLocaleDateString('uz-UZ')}\n`;
            ordersList += `   📊 ${order.status === 'confirmed' ? 'Tasdiqlangan' : order.status === 'cancelled' ? 'Bekor qilingan' : 'Kutilmoqda'}\n\n`;

            keyboard.push([{ text: `📋 ${index + 1}-buyurtma`, callback_data: `order_detail_${order.id}` }]);
        });

        keyboard.push([{ text: '🔙 Orqaga', callback_data: 'main_menu' }]);

        await safeEditMessage(bot, chatId, messageId, `📋 *Sizning buyurtmalaringiz:*\n\n${ordersList}`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });

    } catch (error) {
        console.error('Error in handleCustomerOrders:', error);
        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmalarni ko\'rsatishda xatolik yuz berdi.');
    }
}

async function handleOrderDetail(bot, chatId, messageId, orderId) {
    const { supabase } = require('../utils/database');
    const { safeEditMessage } = require('../utils/helpers');

    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                id,
                product_id,
                full_name,
                phone,
                address,
                quantity,
                total_amount,
                status,
                delivery_status,
                created_at,
                products(name, price)
            `)
            .eq('id', orderId)
            .single();

        if (error) {
            console.error('Error fetching order details:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma tafsilotlarini yuklashda xatolik yuz berdi.');
            return;
        }

        if (!order) {
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma topilmadi.');
            return;
        }

        const statusText = order.status === 'confirmed' ? 'Tasdiqlangan' : order.status === 'cancelled' ? 'Bekor qilingan' : 'Kutilmoqda';
        const deliveryText = order.delivery_status ? 'Yetkazilgan' : 'Yetkazilmagan';

        const orderDetails = `
            *Buyurtma tafsilotlari:*
            ID: ${order.id}
            Mahsulot: ${order.products?.name || 'Noma\'lum mahsulot'}
            To'liq ism: ${order.full_name}
            Telefon: ${order.phone}
            Manzil: ${order.address}
            Miqdor: ${order.quantity}
            Umumiy summa: ${order.total_amount} so'm
            Holat: ${statusText}
            Yetkazish holati: ${deliveryText}
            Yaratilgan vaqti: ${new Date(order.created_at).toLocaleDateString('uz-UZ')}
        `;

        await safeEditMessage(bot, chatId, messageId, orderDetails, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Orqaga', callback_data: 'my_orders' }
                ]]
            }
        });

    } catch (error) {
        console.error('Error in handleOrderDetail:', error);
        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma tafsilotlarini ko\'rsatishda xatolik yuz berdi.');
    }
}

module.exports = { handleCallback };