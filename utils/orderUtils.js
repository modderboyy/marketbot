
const { supabase } = require('./database');
const { userSessions, adminSessions } = require('./sessionManager');
const { ORDER_STATES, ADMIN_STATES, ADMIN_IDS } = require('./constants');
const { validatePhoneNumber, validateBirthDate } = require('./helpers');
const { getOrCreateUser } = require('./userUtils');

// Start order process
async function startOrderProcess(bot, chatId, messageId, productId) {
    userSessions.set(chatId, {
        productId: productId,
        state: ORDER_STATES.AWAITING_NAME,
        orderData: {}
    });

    const { safeEditMessage } = require('./helpers');
    await safeEditMessage(bot, chatId, messageId, '👤 *Buyurtma berish*\n\nIltimos, to\'liq ismingizni kiriting (Ism Familiya):', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: `product_${productId}` }
            ]]
        }
    });
}

// Process order data
async function processOrderData(bot, chatId, messageText) {
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
            session.state = ORDER_STATES.AWAITING_BIRTH_DATE;
            await bot.sendMessage(chatId, '📅 Tug\'ilgan sanangizni kiriting (KK.OO.YYYY formatida, masalan: 15.05.1990):');
            break;

        case ORDER_STATES.AWAITING_BIRTH_DATE:
            if (!validateBirthDate(messageText.trim())) {
                await bot.sendMessage(chatId, '❌ Iltimos, tug\'ilgan sanani to\'g\'ri formatda kiriting (KK.OO.YYYY).');
                return;
            }
            orderData.birth_date = messageText.trim();
            session.state = ORDER_STATES.AWAITING_PROFESSION;
            await bot.sendMessage(chatId, '👨‍💼 Kasbingizni kiriting (masalan: o\'quvchi, o\'qituvchi, ishchi va h.k.):');
            break;

        case ORDER_STATES.AWAITING_PROFESSION:
            orderData.profession = messageText.trim();
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
            await completeOrder(bot, chatId, session);
            break;
    }

    userSessions.set(chatId, session);
}

// Complete order
async function completeOrder(bot, chatId, session) {
    try {
        const { orderData, productId } = session;
        
        // Get user and update birth_date and profession
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await bot.sendMessage(chatId, '❌ Foydalanuvchi ma\'lumotlarini olishda xatolik.');
            return;
        }

        // Update user birth_date and profession
        await supabase
            .from('users')
            .update({
                birth_date: orderData.birth_date,
                profession: orderData.profession
            })
            .eq('id', user.id);

        // Get product details
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

        // Save order
        const { data: newOrder, error } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                product_id: productId,
                full_name: orderData.full_name,
                phone: orderData.phone,
                address: orderData.address,
                quantity: orderData.quantity,
                total_amount: totalPrice,
                status: 'pending',
                order_type: 'immediate',
                anon_temp_id: user.temp_id
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving order:', error);
            await bot.sendMessage(chatId, '❌ Buyurtmani saqlashda xatolik yuz berdi.');
            return;
        }

        // Update product order count
        const { data: currentProduct } = await supabase
            .from('products')
            .select('order_count')
            .eq('id', productId)
            .single();

        if (currentProduct) {
            await supabase
                .from('products')
                .update({ order_count: (currentProduct.order_count || 0) + 1 })
                .eq('id', productId);
        }

        // Send order to admins
        const adminMessage = `🛒 *Yangi buyurtma*

📦 Mahsulot: ${product.name}
👤 Mijoz: ${orderData.full_name}
📞 Telefon: ${orderData.phone}
🏠 Manzil: ${orderData.address}
📅 Tug'ilgan sana: ${orderData.birth_date}
👨‍💼 Kasb: ${orderData.profession}
🔢 Miqdor: ${orderData.quantity}
💰 Jami: ${totalPrice} so'm
🆔 Buyurtma ID: ${newOrder.id}`;

        for (const adminId of ADMIN_IDS) {
            try {
                await bot.sendMessage(adminId, adminMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Rozi bo\'lish', callback_data: `confirm_order_${newOrder.id}` },
                            { text: '❌ Rad etish', callback_data: `reject_order_${newOrder.id}` }
                        ]]
                    }
                });
            } catch (error) {
                console.error(`Error sending to admin ${adminId}:`, error);
            }
        }

        const successMessage = `✅ *Buyurtma muvaffaqiyatli qabul qilindi!*

📦 Mahsulot: ${product.name}
🔢 Miqdor: ${orderData.quantity}
💰 Jami summa: ${totalPrice} so'm

📞 Tez orada admin siz bilan bog'lanadi!`;

        await bot.sendMessage(chatId, successMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🏠 Bosh sahifa', callback_data: 'main_menu' },
                    { text: '🛒 Yana buyurtma', callback_data: 'buy_products' }
                ]]
            }
        });

        userSessions.delete(chatId);
    } catch (error) {
        console.error('Error in completeOrder:', error);
        await bot.sendMessage(chatId, '❌ Buyurtmani yakunlashda xatolik yuz berdi.');
    }
}

// Confirm order
async function confirmOrder(bot, chatId, messageId, orderId) {
    const { safeEditMessage } = require('./helpers');
    
    // First, ask for delivery address
    adminSessions.set(chatId, { 
        state: 'awaiting_delivery_address', 
        orderId: orderId 
    });

    await safeEditMessage(bot, chatId, messageId, '🏠 *Buyurtmani tasdiqlash*\n\nMijozga yetkazish manzilini kiriting:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: 'admin_panel' }
            ]]
        }
    });
}

// Reject order
async function rejectOrder(bot, chatId, messageId, orderId) {
    const { safeEditMessage } = require('./helpers');
    
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', orderId);

        if (error) {
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmani rad etishda xatolik.');
            return;
        }

        // Notify customer
        const { data: order } = await supabase
            .from('orders')
            .select('user_id, products(name), users!inner(telegram_id)')
            .eq('id', orderId)
            .single();

        if (order && order.users) {
            await bot.sendMessage(order.users.telegram_id, `❌ *Buyurtma rad etildi*\n\n📦 Mahsulot: ${order.products?.name}\n\nAfsuski, bu buyurtmani bajarib bo'lmaydi.`, {
                parse_mode: 'Markdown'
            });
        }

        await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma rad etildi. Mijozga xabar yuborildi.');
    } catch (error) {
        console.error('Error in rejectOrder:', error);
    }
}

// Send contact message to admins
async function sendContactToAdmins(bot, chatId, message, userInfo) {
    const { userSessions } = require('./sessionManager');
    
    try {
        const user = await getOrCreateUser(chatId, userInfo);
        const contactMessage = `📨 *Yangi murojaat*\n\n👤 Foydalanuvchi: ${user?.full_name || 'Noma\'lum'}\n🆔 Telegram ID: ${chatId}\n\n💬 Xabar:\n${message}`;

        for (const adminId of ADMIN_IDS) {
            try {
                await bot.sendMessage(adminId, contactMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '↩️ Javob berish', callback_data: `reply_${chatId}` }
                        ]]
                    }
                });
            } catch (error) {
                console.error(`Error sending to admin ${adminId}:`, error);
            }
        }

        await bot.sendMessage(chatId, '✅ Xabaringiz adminlarga yuborildi. Tez orada javob berishadi.', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🏠 Bosh sahifa', callback_data: 'main_menu' }
                ]]
            }
        });

        userSessions.delete(chatId);
    } catch (error) {
        console.error('Error in sendContactToAdmins:', error);
    }
}

// Send broadcast message
async function sendBroadcastMessage(bot, chatId, message) {
    const { isAdmin } = require('./helpers');
    
    if (!isAdmin(chatId)) return;

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('telegram_id')
            .not('telegram_id', 'is', null);

        if (error) {
            await bot.sendMessage(chatId, '❌ Foydalanuvchilar ro\'yxatini olishda xatolik.');
            return;
        }

        let sentCount = 0;
        let errorCount = 0;

        const statusMessage = await bot.sendMessage(chatId, `📤 Xabar yuborilmoqda...\n\n✅ Yuborildi: 0\n❌ Xato: 0\n📊 Jami: ${users.length}`);

        for (const user of users) {
            try {
                await bot.sendMessage(user.telegram_id, `📢 *Xabar*\n\n${message}`, { parse_mode: 'Markdown' });
                sentCount++;
            } catch (error) {
                errorCount++;
                console.error(`Error sending to ${user.telegram_id}:`, error);
            }

            // Update status every 10 messages
            if ((sentCount + errorCount) % 10 === 0) {
                try {
                    await bot.editMessageText(
                        `📤 Xabar yuborilmoqda...\n\n✅ Yuborildi: ${sentCount}\n❌ Xato: ${errorCount}\n📊 Jami: ${users.length}`,
                        {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        }
                    );
                } catch (editError) {
                    // Ignore edit errors
                }
            }
        }

        await bot.editMessageText(
            `✅ *Xabar tarqatish yakunlandi*\n\n✅ Muvaffaqiyatli: ${sentCount}\n❌ Xato: ${errorCount}\n📊 Jami: ${users.length}`,
            {
                chat_id: chatId,
                message_id: statusMessage.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
                    ]]
                }
            }
        );

        adminSessions.delete(chatId);
    } catch (error) {
        console.error('Error in sendBroadcastMessage:', error);
        await bot.sendMessage(chatId, '❌ Xabar tarqatishda xatolik yuz berdi.');
    }
}

module.exports = {
    startOrderProcess,
    processOrderData,
    completeOrder,
    confirmOrder,
    rejectOrder,
    sendContactToAdmins,
    sendBroadcastMessage
};
