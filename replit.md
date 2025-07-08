# Telegram Bot for E-commerce

## Overview

This is a Node.js-based Telegram bot designed for e-commerce functionality, deployed on Vercel. The bot provides an interactive shopping experience with product catalogs, order management, and customer data collection. It integrates with Supabase for backend data storage and uses webhook-based communication with Telegram's Bot API.

## System Architecture

### Backend Architecture
- **Runtime**: Node.js serverless functions on Vercel
- **Bot Framework**: node-telegram-bot-api for Telegram Bot API integration
- **Database**: Supabase (PostgreSQL-based) for data persistence
- **Deployment**: Vercel with webhook endpoint configuration

### Frontend Architecture
- **Interface**: Telegram chat interface with inline keyboards
- **User Flow**: State-based conversation flow using in-memory session management
- **Localization**: Uzbek language support (uz locale)

## Key Components

### 1. Webhook Handler (`api/webhook.js`)
- Processes incoming Telegram updates
- Manages bot commands and user interactions
- Handles order flow state management
- Integrates with Supabase for data operations

### 2. Session Management
- In-memory user session storage using Map data structure
- Tracks order flow states for each user
- Manages temporary user data during order process

### 3. Product Management
- Product catalog display with detailed information
- Category-based product organization
- Rich product information including ratings, delivery options, and warranty details

### 4. Order Processing
- Multi-step order flow collecting user information
- States: name, birth date, profession, address, phone, quantity
- Customer data validation and storage

## Data Flow

### 1. User Interaction Flow
```
User Command → Webhook → Bot Processing → Database Query → Response Generation → Telegram API
```

### 2. Order Flow
```
Product Selection → Order Initiation → Customer Data Collection → Order Confirmation → Database Storage
```

### 3. Product Display Flow
```
Category Selection → Product Retrieval → Format Product Info → Display with Actions → User Action Processing
```

## External Dependencies

### 1. Telegram Bot API
- **Purpose**: Bot communication and webhook handling
- **Library**: node-telegram-bot-api v0.66.0
- **Configuration**: BOT_TOKEN environment variable

### 2. Supabase
- **Purpose**: Database operations and backend services
- **Library**: @supabase/supabase-js v2.50.3
- **Configuration**: 
  - NEXT_PUBLIC_SUPABASE_URL: https://tdfphvmmwfqhnzfggpln.supabase.co
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: (JWT token for anonymous access)

### 3. Database Schema (Expected)
- **Categories Table**: name_uz, product listings
- **Products Table**: name_uz, price, description_uz, rating, order_count, like_count, delivery options, warranty info
- **Orders Table**: Customer information and order details

## Deployment Strategy

### 1. Vercel Configuration
- **Function**: api/webhook.js with 30-second max duration
- **Environment Variables**: BOT_TOKEN, Supabase credentials
- **Scaling**: Serverless auto-scaling based on demand

### 2. Webhook Setup
- Self-configuring webhook registration
- Automatic HTTPS endpoint handling via Vercel
- Real-time message processing

### 3. Database Integration
- Supabase hosted PostgreSQL
- Real-time capabilities for live updates
- Anonymous key access for public operations

## User Preferences

Preferred communication style: Simple, everyday language.

## Current Status

✅ Bot is fully functional with:
- Categories and products display from Supabase
- Complete order flow with user data collection
- Admin panel for order management 
- Order status updates (delivered/cancelled)
- Proper database integration with existing schema

## Admin Functions Fixed

✅ "Ha, berildi" button: Sets `status = 'completed'` and `is_client_claimed = true`
✅ "Yo'q, berilmadi" button: Sets `status = 'cancelled'` and `is_client_claimed = false`

## Deployment Ready

The bot is configured for both development (Express server on port 5000) and production (Vercel serverless functions). To deploy:

1. Set BOT_TOKEN in Vercel environment variables
2. Set DATABASE_URL in Vercel environment variables  
3. Deploy to Vercel - webhook will auto-configure

## Changelog

- July 07, 2025: Initial setup
- July 08, 2025: Fixed admin order status handling, integrated with existing Supabase schema, bot fully functional
- July 08, 2025: Fixed critical UUID parsing error - reordered callback handlers so product_delivered_ and product_not_delivered_ are processed before generic product_ callbacks
- July 08, 2025: Added comprehensive help guide with detailed step-by-step instructions for all bot features
- July 08, 2025: Created comprehensive security guidelines document (SECURITY.md) with best practices, threat prevention, and monitoring guidelines