
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN || 'your_bot_token_here';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdfphvmmwfqhnzfggpln.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ';

// Admin IDs
const ADMIN_IDS = ['6295092422', '12345678'];

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN);

// User session storage
const userSessions = new Map();
const adminSessions = new Map();

// Order flow states
const ORDER_STATES = {
    AWAITING_NAME: 'awaiting_name',
    AWAITING_BIRTH_DATE: 'awaiting_birth_date',
    AWAITING_PROFESSION: 'awaiting_profession',
    AWAITING_ADDRESS: 'awaiting_address',
    AWAITING_PHONE: 'awaiting_phone',
    AWAITING_QUANTITY: 'awaiting_quantity'
};

// Admin states
const ADMIN_STATES = {
    AWAITING_BROADCAST_MESSAGE: 'awaiting_broadcast_message'
};

// Utility functions
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
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

function formatProductMessage(product, seller = null) {
    const deliveryText = product.has_delivery ? 
        `🚚 Yetkazib berish: ${product.delivery_price > 0 ? `${product.delivery_price} so'm` : 'Bepul'}` : 
        '🚫 Yetkazib berish yo\'q';
    
    const warrantyText = product.has_warranty ? 
        `🛡 Kafolat: ${product.warranty_months} oy` : 
        '🚫 Kafolat yo\'q';
    
    const returnText = product.is_returnable ? 
        `↩️ Qaytarish: ${product.return_days} kun ichida` : 
        '🚫 Qaytarib bo\'lmaydi';

    const sellerInfo = seller ? 
        `👤 Sotuvchi: ${seller.full_name}\n📞 Tel: ${seller.phone}` : 
        '👤 Sotuvchi: Ma\'lumot yo\'q';

    return `📦 *${product.name}*

💰 Narx: ${product.price} so'm
📝 Ta'rif: ${product.description}
👨‍💼 Muallif: ${product.author || 'Noma\'lum'}
🏷 Brend: ${product.brand || 'Noma\'lum'}
📦 Omborda: ${product.stock_quantity || 0} dona

📊 Statistika:
⭐ Reyting: ${product.rating || 4.5}/5
🛒 Buyurtmalar: ${product.order_count || 0}
❤️ Yoqtirishlar: ${product.like_count || 0}

${sellerInfo}

🚚 Yetkazib berish va xizmatlar:
${deliveryText}
${warrantyText}
${returnText}`;
}

// Safe message editing function
async function safeEditMessage(chatId, messageId, text, options = {}) {
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

// Handle product like/unlike
async function handleProductLike(chatId, productId, isLike) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) return false;

        if (isLike) {
            // Add like
            const { error: likeError } = await supabase
                .from('product_likes')
                .insert({
                    user_id: user.id,
                    product_id: productId
                });

            if (likeError && !likeError.message.includes('duplicate key')) {
                console.error('Error adding like:', likeError);
                return false;
            }
        } else {
            // Remove like
            const { error: unlikeError } = await supabase
                .from('product_likes')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', productId);

            if (unlikeError) {
                console.error('Error removing like:', unlikeError);
                return false;
            }
        }

        // Update product like count
        const { data: likeCount } = await supabase
            .from('product_likes')
            .select('count', { count: 'exact', head: true })
            .eq('product_id', productId);

        await supabase
            .from('products')
            .update({ like_count: likeCount.count || 0 })
            .eq('id', productId);

        return true;
    } catch (error) {
        console.error('Error in handleProductLike:', error);
        return false;
    }
}

// Check if user liked product
async function isProductLiked(chatId, productId) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) return false;

        const { data, error } = await supabase
            .from('product_likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .single();

        return !error && data;
    } catch (error) {
        return false;
    }
}

// Handle /start command
async function handleStart(chatId, messageId = null, userInfo = null) {
    // Create or get user
    if (userInfo) {
        await getOrCreateUser(chatId, userInfo);
    }

    const welcomeMessage = `🛍 *Global Market - Qashqadaryo, G'uzor*

Bizning onlayn do'konimizga xush kelibsiz! Bu yerda siz turli xil mahsulotlarni ko'rishingiz va buyurtma berishingiz mumkin.

Quyidagi tugmalardan birini tanlang:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '🛒 Sotib olish', callback_data: 'buy_products' }
            ],
            [
                { text: '📦 Buyurtmalarim', callback_data: 'my_orders' },
                { text: '👤 Profilim', callback_data: 'my_profile' }
            ],
            [
                { text: '📞 Murojaat', callback_data: 'contact_admin' },
                { text: '❓ Yordam', callback_data: 'help' }
            ]
        ]
    };

    // Add admin panel for admins
    if (isAdmin(chatId)) {
        keyboard.inline_keyboard.push([
            { text: '⚙️ Admin Panel', callback_data: 'admin_panel' }
        ]);
    }

    const options = {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    };

    try {
        if (messageId) {
            await safeEditMessage(chatId, messageId, welcomeMessage, options);
        } else {
            await bot.sendMessage(chatId, welcomeMessage, options);
        }
    } catch (error) {
        console.error('Error in handleStart:', error);
    }
}

// Show user profile
async function showProfile(chatId, messageId) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await safeEditMessage(chatId, messageId, '❌ Profil ma\'lumotlarini olishda xatolik.');
            return;
        }

        const profileMessage = `👤 *Profil Ma'lumotlari*

📛 Ism: ${user.full_name || 'Kiritilmagan'}
🆔 Telegram ID: ${user.telegram_id}
🏷 Temp ID: ${user.temp_id}
📧 Email: ${user.email}
📅 Ro'yxatdan o'tgan: ${new Date(user.created_at).toLocaleDateString('uz-UZ')}`;

        await safeEditMessage(chatId, messageId, profileMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Orqaga', callback_data: 'main_menu' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in showProfile:', error);
    }
}

// Show user orders
async function showMyOrders(chatId, messageId) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await safeEditMessage(chatId, messageId, '❌ Foydalanuvchi ma\'lumotlari topilmadi.');
            return;
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (name, price)
            `)
            .eq('anon_temp_id', user.temp_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            await safeEditMessage(chatId, messageId, '❌ Buyurtmalarni yuklashda xatolik.');
            return;
        }

        if (!orders || orders.length === 0) {
            await safeEditMessage(chatId, messageId, '📭 Sizda hali buyurtmalar yo\'q.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🛒 Xarid qilish', callback_data: 'buy_products' },
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        const message = `📦 *Buyurtmalarim (${orders.length} ta)*\n\nQuyidagi buyurtmalardan birini tanlang:`;
        
        const keyboard = {
            inline_keyboard: [
                ...orders.map((order, index) => [
                    { text: `${index + 1}. ${order.products?.name || 'Noma\'lum'} - ${order.status === 'completed' ? '✅' : '⏳'}`, callback_data: `order_detail_${order.id}` }
                ]),
                [{ text: '🔙 Orqaga', callback_data: 'main_menu' }]
            ]
        };

        await safeEditMessage(chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showMyOrders:', error);
    }
}

// Show order details
async function showOrderDetail(chatId, messageId, orderId) {
    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (name, price)
            `)
            .eq('id', orderId)
            .single();

        if (error || !order) {
            await safeEditMessage(chatId, messageId, '❌ Buyurtma topilmadi.');
            return;
        }

        const statusText = order.status === 'completed' ? '✅ Yetkazildi' : 
                          order.status === 'cancelled' ? '❌ Bekor qilindi' : '⏳ Jarayonda';

        const orderMessage = `📦 *Buyurtma Tafsilotlari*

🆔 Buyurtma ID: ${order.id}
📦 Mahsulot: ${order.products?.name || 'Noma\'lum'}
🔢 Miqdor: ${order.quantity}
💰 Jami summa: ${order.total_amount} so'm
📊 Holat: ${statusText}
📅 Buyurtma vaqti: ${new Date(order.created_at).toLocaleDateString('uz-UZ')}

👤 Mijoz ma'lumotlari:
📛 F.I.O: ${order.full_name}
📞 Telefon: ${order.phone}
🏠 Manzil: ${order.address}`;

        await safeEditMessage(chatId, messageId, orderMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Buyurtmalarga qaytish', callback_data: 'my_orders' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in showOrderDetail:', error);
    }
}

// Admin panel
async function showAdminPanel(chatId, messageId) {
    if (!isAdmin(chatId)) {
        await safeEditMessage(chatId, messageId, '❌ Sizda admin huquqlari yo\'q.');
        return;
    }

    const adminMessage = `⚙️ *Admin Panel*

Admin paneliga xush kelibsiz. Quyidagi amallardan birini tanlang:`;

    await safeEditMessage(chatId, messageId, adminMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📊 Statistika', callback_data: 'admin_stats' },
                    { text: '📢 Xabar tarqatish', callback_data: 'admin_broadcast' }
                ],
                [
                    { text: '📨 Murojaatlar', callback_data: 'admin_contacts' },
                    { text: '📦 Buyurtmalar', callback_data: 'admin_orders' }
                ],
                [
                    { text: '🔙 Orqaga', callback_data: 'main_menu' }
                ]
            ]
        }
    });
}

// Admin statistics
async function showAdminStats(chatId, messageId) {
    if (!isAdmin(chatId)) return;

    try {
        const [usersResult, ordersResult, productsResult, categoriesResult] = await Promise.all([
            supabase.from('users').select('count', { count: 'exact', head: true }),
            supabase.from('orders').select('count', { count: 'exact', head: true }),
            supabase.from('products').select('count', { count: 'exact', head: true }),
            supabase.from('categories').select('count', { count: 'exact', head: true })
        ]);

        const { data: recentOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const totalRevenue = recentOrders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

        const statsMessage = `📊 *Statistika*

👥 Jami foydalanuvchilar: ${usersResult.count || 0}
📦 Jami buyurtmalar: ${ordersResult.count || 0}
🛍 Jami mahsulotlar: ${productsResult.count || 0}
🗂 Jami kategoriyalar: ${categoriesResult.count || 0}
💰 30 kunlik daromad: ${totalRevenue.toLocaleString()} so'm`;

        await safeEditMessage(chatId, messageId, statsMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
                ]]
            }
        });
    } catch (error) {
        console.error('Error in showAdminStats:', error);
    }
}

// Handle broadcast
async function handleBroadcast(chatId, messageId) {
    if (!isAdmin(chatId)) return;

    adminSessions.set(chatId, { state: ADMIN_STATES.AWAITING_BROADCAST_MESSAGE });

    await safeEditMessage(chatId, messageId, '📢 *Xabar tarqatish*\n\nBarcha foydalanuvchilarga yubormoqchi bo\'lgan xabaringizni yozing:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: 'admin_panel' }
            ]]
        }
    });
}

// Send broadcast message
async function sendBroadcastMessage(chatId, message) {
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

// Contact admin
async function handleContactAdmin(chatId, messageId) {
    userSessions.set(chatId, { state: 'awaiting_contact_message' });

    await safeEditMessage(chatId, messageId, '📞 *Murojaat*\n\nAdminlarga yubormoqchi bo\'lgan xabaringizni yozing:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: 'main_menu' }
            ]]
        }
    });
}

// Send contact message to admins
async function sendContactToAdmins(chatId, message, userInfo) {
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
            await safeEditMessage(chatId, messageId, '❌ Kategoriyalarni yuklashda xatolik yuz berdi.');
            return;
        }

        if (!categories || categories.length === 0) {
            await safeEditMessage(chatId, messageId, '📭 Hozircha kategoriyalar mavjud emas.', {
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

        await safeEditMessage(chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showCategories:', error);
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
            await safeEditMessage(chatId, messageId, '❌ Mahsulotlarni yuklashda xatolik yuz berdi.');
            return;
        }

        if (!products || products.length === 0) {
            await safeEditMessage(chatId, messageId, '📭 Bu kategoriyada mahsulotlar mavjud emas.', {
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

        await safeEditMessage(chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProducts:', error);
    }
}

// Show product details
async function showProductDetails(chatId, messageId, productId) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*, users!products_seller_id_fkey(full_name, phone)')
            .eq('id', productId)
            .single();

        if (error || !product) {
            console.error('Error fetching product:', error);
            await safeEditMessage(chatId, messageId, '❌ Mahsulot topilmadi.');
            return;
        }

        const seller = product.users || null;
        const message = formatProductMessage(product, seller);
        
        // Check if user liked this product
        const isLiked = await isProductLiked(chatId, productId);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🛒 Buyurtma berish', callback_data: `order_${productId}` }
                ],
                [
                    { text: isLiked ? '❤️ Yoqtirilgan' : '🤍 Yoqtirish', callback_data: `like_${productId}` }
                ],
                [{ text: '🔙 Orqaga', callback_data: `category_${product.category_id}` }]
            ]
        };

        // Try to send with photo first
        if (product.image_url) {
            try {
                await bot.sendPhoto(chatId, product.image_url, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                // Delete the old message if photo sent successfully
                try {
                    await bot.deleteMessage(chatId, messageId);
                } catch (deleteError) {
                    // Ignore delete errors
                }
                return;
            } catch (photoError) {
                console.log('Could not send photo, sending text instead');
            }
        }

        await safeEditMessage(chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProductDetails:', error);
    }
}

// Start order process
async function startOrderProcess(chatId, messageId, productId) {
    userSessions.set(chatId, {
        productId: productId,
        state: ORDER_STATES.AWAITING_NAME,
        orderData: {}
    });

    await safeEditMessage(chatId, messageId, '👤 *Buyurtma berish*\n\nIltimos, to\'liq ismingizni kiriting (Ism Familiya):', {
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
            await completeOrder(chatId, session);
            break;
    }

    userSessions.set(chatId, session);
}

// Complete order
async function completeOrder(chatId, session) {
    try {
        const { orderData, productId } = session;
        
        // Get user
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await bot.sendMessage(chatId, '❌ Foydalanuvchi ma\'lumotlarini olishda xatolik.');
            return;
        }

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
                order_type: 'immediate',
                anon_temp_id: user.temp_id
            });

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

        userSessions.delete(chatId);
    } catch (error) {
        console.error('Error in completeOrder:', error);
        await bot.sendMessage(chatId, '❌ Buyurtmani yakunlashda xatolik yuz berdi.');
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
            const callbackQuery = update.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            const data = callbackQuery.data;

            // Safely answer callback query
            try {
                await bot.answerCallbackQuery(callbackQuery.id);
            } catch (callbackError) {
                // Ignore callback query timeout errors
                console.log('Callback query timeout, continuing...');
            }

            if (data === 'main_menu') {
                await handleStart(chatId, messageId);
            } else if (data === 'help') {
                await safeEditMessage(chatId, messageId, '❓ *Yordam*\n\nBu bot Global Market do\'koni uchun mo\'ljallangan.\n\n/start - Botni qayta ishga tushirish\n/admin - Admin panel (faqat adminlar uchun)', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🔙 Orqaga', callback_data: 'main_menu' }
                        ]]
                    }
                });
            } else if (data === 'my_profile') {
                await showProfile(chatId, messageId);
            } else if (data === 'my_orders') {
                await showMyOrders(chatId, messageId);
            } else if (data === 'contact_admin') {
                await handleContactAdmin(chatId, messageId);
            } else if (data === 'admin_panel') {
                await showAdminPanel(chatId, messageId);
            } else if (data === 'admin_stats') {
                await showAdminStats(chatId, messageId);
            } else if (data === 'admin_broadcast') {
                await handleBroadcast(chatId, messageId);
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
                const isLiked = await isProductLiked(chatId, productId);
                await handleProductLike(chatId, productId, !isLiked);
                await showProductDetails(chatId, messageId, productId);
            } else if (data.startsWith('order_detail_')) {
                const orderId = data.split('_')[2];
                await showOrderDetail(chatId, messageId, orderId);
            }
        }

        // Handle text messages
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const messageText = message.text;
            const userInfo = message.from;

            if (messageText === '/start') {
                await handleStart(chatId, null, userInfo);
            } else if (messageText === '/admin') {
                if (isAdmin(chatId)) {
                    await showAdminPanel(chatId, null);
                } else {
                    await bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q.');
                }
            } else {
                // Check for session states
                const session = userSessions.get(chatId);
                const adminSession = adminSessions.get(chatId);

                if (session) {
                    if (session.state === 'awaiting_contact_message') {
                        await sendContactToAdmins(chatId, messageText, userInfo);
                    } else {
                        await processOrderData(chatId, messageText);
                    }
                } else if (adminSession && adminSession.state === ADMIN_STATES.AWAITING_BROADCAST_MESSAGE) {
                    await sendBroadcastMessage(chatId, messageText);
                } else {
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
