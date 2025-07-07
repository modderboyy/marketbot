
const { safeEditMessage, isAdmin } = require('../utils/helpers');
const { supabase } = require('../utils/database');
const { getOrCreateUser } = require('../utils/userUtils');
const { adminSessions } = require('../utils/sessionManager');
const { ADMIN_STATES, ADMIN_IDS } = require('../utils/constants');

// Handle /start command
async function handleStart(bot, chatId, messageId = null, userInfo = null) {
    if (userInfo) {
        const user = await getOrCreateUser(chatId, userInfo, true);
        if (!user) {
            // User needs to register with phone
            const registrationMessage = `🔐 *Ro'yxatdan o'tish*

Botdan foydalanish uchun telefon raqamingizni ulashing.`;

            const keyboard = {
                keyboard: [[{
                    text: '📞 Telefon raqamni ulashish',
                    request_contact: true
                }]],
                one_time_keyboard: true,
                resize_keyboard: true
            };

            const options = {
                reply_markup: keyboard,
                parse_mode: 'Markdown'
            };

            if (messageId) {
                await bot.sendMessage(chatId, registrationMessage, options);
            } else {
                await bot.sendMessage(chatId, registrationMessage, options);
            }
            return;
        }
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
                { text: '🔍 Qidiruv', callback_data: 'search_products' },
                { text: '🌐 Websaytga kirish', url: 'https://globalmarketshop.uz' }
            ],
            [
                { text: '❓ Yordam', callback_data: 'help' }
            ]
        ]
    };

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
            await safeEditMessage(bot, chatId, messageId, welcomeMessage, options);
        } else {
            await bot.sendMessage(chatId, welcomeMessage, options);
        }
    } catch (error) {
        console.error('Error in handleStart:', error);
    }
}

// Show user profile
async function showProfile(bot, chatId, messageId) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await safeEditMessage(bot, chatId, messageId, '❌ Profil ma\'lumotlarini olishda xatolik.');
            return;
        }

        const profileMessage = `👤 *Profil Ma'lumotlari*

📛 Ism: ${user.full_name || 'Kiritilmagan'}
🆔 Telegram ID: ${user.telegram_id}
🏷 Temp ID: ${user.temp_id}
📧 Email: ${user.email}
📅 Tug'ilgan sana: ${user.birth_date || 'Kiritilmagan'}
👨‍💼 Kasb: ${user.profession || 'Kiritilmagan'}
📅 Ro'yxatdan o'tgan: ${new Date(user.created_at).toLocaleDateString('uz-UZ')}`;

        await safeEditMessage(bot, chatId, messageId, profileMessage, {
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
async function showMyOrders(bot, chatId, messageId) {
    try {
        const user = await getOrCreateUser(chatId, {});
        if (!user) {
            await safeEditMessage(bot, chatId, messageId, '❌ Foydalanuvchi ma\'lumotlarini olishda xatolik.');
            return;
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (name, price)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmalarni yuklashda xatolik.');
            return;
        }

        if (!orders || orders.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📭 Sizda hozircha buyurtmalar yo\'q.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🛒 Sotib olish', callback_data: 'buy_products' },
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        let orderMessage = '📦 *Buyurtmalarim*\n\n';
        const keyboard = [];

        orders.forEach((order, index) => {
            const statusEmoji = order.status === 'pending' ? '⏳' :
                               order.status === 'confirmed' ? '✅' :
                               order.status === 'completed' ? '🎉' : '❌';
            
            orderMessage += `${statusEmoji} *${order.products?.name || 'Noma\'lum mahsulot'}*\n`;
            orderMessage += `💰 ${order.total_amount} so'm\n`;
            orderMessage += `📅 ${new Date(order.created_at).toLocaleDateString('uz-UZ')}\n\n`;

            keyboard.push([{ 
                text: `${index + 1}. ${order.products?.name || 'Buyurtma'} - ${statusEmoji}`, 
                callback_data: `order_detail_${order.id}` 
            }]);
        });

        keyboard.push([{ text: '🔙 Orqaga', callback_data: 'main_menu' }]);

        await safeEditMessage(bot, chatId, messageId, orderMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error('Error in showMyOrders:', error);
    }
}

// Show order details
async function showOrderDetail(bot, chatId, messageId, orderId) {
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
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma topilmadi.');
            return;
        }

        const statusText = order.status === 'completed' ? '✅ Yetkazildi' : 
                          order.status === 'cancelled' ? '❌ Bekor qilindi' : 
                          order.status === 'confirmed' ? '✅ Tasdiqlandi' : 
                          '⏳ Kutilmoqda';

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

        let keyboard = [[{ text: '🔙 Buyurtmalarga qaytish', callback_data: 'my_orders' }]];

        // Add customer action buttons if order is confirmed
        if (order.status === 'confirmed' && order.delivery_address) {
            keyboard.unshift([
                { text: '✅ Bordim', callback_data: `customer_arrived_${order.id}` },
                { text: '❌ Bormadim', callback_data: `customer_not_arrived_${order.id}` }
            ]);
        }

        await safeEditMessage(bot, chatId, messageId, orderMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error('Error in showOrderDetail:', error);
    }
}

// Show categories with 2-column layout
async function showCategories(bot, chatId, messageId) {
    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('name_uz');

        if (error) {
            console.error('Error fetching categories:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Kategoriyalarni yuklashda xatolik yuz berdi.');
            return;
        }

        if (!categories || categories.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📭 Hozircha kategoriyalar mavjud emas.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        const message = '🗂 *Kategoriyalarni tanlang:*';
        
        // Create 2-column layout
        const keyboard = { inline_keyboard: [] };
        
        for (let i = 0; i < categories.length; i += 2) {
            const row = [];
            row.push({ 
                text: `${categories[i].icon || '📦'} ${categories[i].name_uz}`, 
                callback_data: `category_${categories[i].id}` 
            });
            
            if (i + 1 < categories.length) {
                row.push({ 
                    text: `${categories[i + 1].icon || '📦'} ${categories[i + 1].name_uz}`, 
                    callback_data: `category_${categories[i + 1].id}` 
                });
            }
            
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([{ text: '🔙 Orqaga', callback_data: 'main_menu' }]);

        await safeEditMessage(bot, chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showCategories:', error);
    }
}

// Show products by category
async function showProducts(bot, chatId, messageId, categoryId) {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Error fetching products:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Mahsulotlarni yuklashda xatolik yuz berdi.');
            return;
        }

        if (!products || products.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📭 Bu kategoriyada mahsulotlar mavjud emas.', {
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

        await safeEditMessage(bot, chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProducts:', error);
    }
}

// Show product details (without like functionality)
async function showProductDetails(bot, chatId, messageId, productId) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*, users!products_seller_id_fkey(full_name, phone)')
            .eq('id', productId)
            .single();

        if (error || !product) {
            console.error('Error fetching product:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Mahsulot topilmadi.');
            return;
        }

        const seller = product.users || null;
        const message = formatProductMessage(product, seller);
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🛒 Buyurtma berish', callback_data: `order_${productId}` }
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

        await safeEditMessage(bot, chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showProductDetails:', error);
    }
}

// Admin panel functions
async function showAdminPanel(bot, chatId, messageId) {
    if (!isAdmin(chatId)) {
        await safeEditMessage(bot, chatId, messageId, '❌ Sizda admin huquqlari yo\'q.');
        return;
    }

    const adminMessage = `⚙️ *Admin Panel*

Admin paneliga xush kelibsiz. Quyidagi amallardan birini tanlang:`;

    await safeEditMessage(bot, chatId, messageId, adminMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📊 Statistika', callback_data: 'admin_stats' },
                    { text: '📢 Xabar tarqatish', callback_data: 'admin_broadcast' }
                ],
                [
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
async function showAdminStats(bot, chatId, messageId) {
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

        await safeEditMessage(bot, chatId, messageId, statsMessage, {
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
async function handleBroadcast(bot, chatId, messageId) {
    if (!isAdmin(chatId)) return;

    adminSessions.set(chatId, { state: ADMIN_STATES.AWAITING_BROADCAST_MESSAGE });

    await safeEditMessage(bot, chatId, messageId, '📢 *Xabar tarqatish*\n\nBarcha foydalanuvchilarga yubormoqchi bo\'lgan xabaringizni yozing:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Bekor qilish', callback_data: 'admin_panel' }
            ]]
        }
    });
}

// Contact admin (deprecated - removed from UI)
async function handleContactAdmin(bot, chatId, messageId) {
    await safeEditMessage(bot, chatId, messageId, '❌ Bu funksiya vaqtincha ishlamaydi.', {
        reply_markup: {
            inline_keyboard: [[
                { text: '🔙 Orqaga', callback_data: 'main_menu' }
            ]]
        }
    });
}

// Show admin orders
async function showAdminOrders(bot, chatId, messageId) {
    if (!isAdmin(chatId)) return;

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                products (name, price)
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching admin orders:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtmalarni yuklashda xatolik.');
            return;
        }

        if (!orders || orders.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📭 Buyurtmalar yo\'q.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Admin Panel', callback_data: 'admin_panel' }
                    ]]
                }
            });
            return;
        }

        const message = `📦 *Buyurtmalar (${orders.length} ta)*\n\nQuyidagi buyurtmalardan birini tanlang:`;
        
        const keyboard = {
            inline_keyboard: [
                ...orders.map((order, index) => [
                    { text: `${index + 1}. ${order.products?.name || 'Noma\'lum'} - ${order.status === 'completed' ? '✅' : order.status === 'confirmed' ? '⏳' : '📋'}`, callback_data: `admin_order_${order.id}` }
                ]),
                [{ text: '🔙 Admin Panel', callback_data: 'admin_panel' }]
            ]
        };

        await safeEditMessage(bot, chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in showAdminOrders:', error);
    }
}

// Show admin order details
async function showAdminOrderDetail(bot, chatId, messageId, orderId) {
    if (!isAdmin(chatId)) return;

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
            await safeEditMessage(bot, chatId, messageId, '❌ Buyurtma topilmadi.');
            return;
        }

        const statusText = order.status === 'completed' ? '✅ Yetkazildi' : 
                          order.status === 'cancelled' ? '❌ Bekor qilindi' : 
                          order.status === 'confirmed' ? '✅ Tasdiqlandi' : 
                          '⏳ Kutilmoqda';

        const orderMessage = `📦 *Buyurtma Tafsilotlari (Admin)*

🆔 Buyurtma ID: ${order.id}
📦 Mahsulot: ${order.products?.name || 'Noma\'lum'}
🔢 Miqdor: ${order.quantity}
💰 Jami summa: ${order.total_amount} so'm
📊 Holat: ${statusText}
📅 Buyurtma vaqti: ${new Date(order.created_at).toLocaleDateString('uz-UZ')}

👤 Mijoz ma'lumotlari:
📛 F.I.O: ${order.full_name}
📞 Telefon: ${order.phone}
🏠 Manzil: ${order.address}
📅 Tug'ilgan sana: ${order.birth_date || 'Noma\'lum'}
👨‍💼 Kasb: ${order.profession || 'Noma\'lum'}`;

        let keyboard = [[{ text: '🔙 Buyurtmalarga qaytish', callback_data: 'admin_orders' }]];

        if (order.status === 'pending') {
            keyboard.unshift([
                { text: '✅ Rozi bo\'lish', callback_data: `confirm_order_${order.id}` },
                { text: '❌ Rad etish', callback_data: `reject_order_${order.id}` }
            ]);
        }

        await safeEditMessage(bot, chatId, messageId, orderMessage, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error('Error in showAdminOrderDetail:', error);
    }
}

// Search products function
async function handleSearch(bot, chatId, messageId) {
    await safeEditMessage(bot, chatId, messageId, '🔍 *Qidiruv*\n\nMahsulot nomini yozing yoki inline qidiruv uchun tugmani bosing:', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔍 Inline qidiruv', switch_inline_query_current_chat: '' }
                ],
                [
                    { text: '🔙 Orqaga', callback_data: 'main_menu' }
                ]
            ]
        }
    });
}

// Search products by name
async function searchProducts(bot, chatId, messageId, searchQuery) {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .ilike('name', `%${searchQuery}%`)
            .order('name')
            .limit(10);

        if (error) {
            console.error('Error searching products:', error);
            await safeEditMessage(bot, chatId, messageId, '❌ Qidirishda xatolik yuz berdi.');
            return;
        }

        if (!products || products.length === 0) {
            await safeEditMessage(bot, chatId, messageId, '📭 Qidiruv natijasida hech narsa topilmadi.', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Orqaga', callback_data: 'main_menu' }
                    ]]
                }
            });
            return;
        }

        const message = `🔍 *Qidiruv natijalari: "${searchQuery}"*\n\nTopilgan mahsulotlar:`;
        
        const keyboard = {
            inline_keyboard: [
                ...products.map(product => [
                    { text: `${product.name} - ${product.price} so'm`, callback_data: `product_${product.id}` }
                ]),
                [{ text: '🔙 Orqaga', callback_data: 'main_menu' }]
            ]
        };

        await safeEditMessage(bot, chatId, messageId, message, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error('Error in searchProducts:', error);
    }
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

${sellerInfo}

🚚 Yetkazib berish va xizmatlar:
${deliveryText}
${warrantyText}
${returnText}`;
}

module.exports = {
    handleStart,
    showProfile,
    showMyOrders,
    showOrderDetail,
    showCategories,
    showProducts,
    showProductDetails,
    showAdminPanel,
    showAdminStats,
    handleBroadcast,
    handleContactAdmin,
    showAdminOrders,
    showAdminOrderDetail,
    handleSearch,
    searchProducts
};
