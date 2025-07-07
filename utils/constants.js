const BOT_TOKEN = process.env.BOT_TOKEN || "your_bot_token_here";
const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://tdfphvmmwfqhnzfggpln.supabase.co";
const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZnBodm1td2ZxaG56ZmdncGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzcwNjYsImV4cCI6MjA2NzMxMzA2Nn0.0H8_6f07k0vmjOVnqqXgqBYwIEu50Qqs_tExPv1k7DQ";

// Admin IDs - Replace with real admin Telegram IDs
const ADMIN_IDS = [6295092422, 20000000]; // Add real admin Telegram IDs here when you have them

const ORDER_STATES = {
    AWAITING_NAME: "awaiting_name",
    AWAITING_BIRTH_DATE: "awaiting_birth_date",
    AWAITING_PROFESSION: "awaiting_profession",
    AWAITING_ADDRESS: "awaiting_address",
    AWAITING_PHONE: "awaiting_phone",
    AWAITING_QUANTITY: "awaiting_quantity",
};

const ADMIN_STATES = {
    AWAITING_BROADCAST_MESSAGE: "awaiting_broadcast_message",
};

module.exports = {
    BOT_TOKEN,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    ADMIN_IDS,
    ORDER_STATES,
    ADMIN_STATES,
};
