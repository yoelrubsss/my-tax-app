# WhatsApp Integration Setup Guide

## Overview

The WhatsApp integration allows users to send receipt images directly via WhatsApp, which are automatically processed with Gemini AI and added as draft transactions.

---

## 1. WhatsApp Business API Setup

### Create WhatsApp Business Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or use existing app
3. Add "WhatsApp" product to your app
4. Get your **Phone Number ID** and **WhatsApp Business Account ID**

### Get Access Token

1. In your WhatsApp Business API dashboard, generate a **Permanent Access Token**
2. Copy the token - this is your `WHATSAPP_TOKEN`

### Configure Webhook

1. In WhatsApp > Configuration > Webhook, set:
   - **Callback URL**: `https://yourdomain.com/api/webhook/whatsapp`
   - **Verify Token**: Create a custom string (e.g., `my-secure-verify-token-123`)
     - This becomes your `WHATSAPP_VERIFY_TOKEN`

2. Subscribe to webhook fields:
   - ✅ `messages` (required for receiving incoming messages)

3. Click "Verify and Save"

---

## 2. Environment Variables

Add these to your `.env` file:

```env
# WhatsApp Business API
WHATSAPP_TOKEN=your_permanent_access_token_here
WHATSAPP_VERIFY_TOKEN=my-secure-verify-token-123

# Gemini AI (for receipt scanning)
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 3. Database Setup

Update your database schema to include WhatsApp phone numbers:

```bash
npx prisma db push
npx prisma generate
```

This adds the `whatsappPhone` field to the User model.

---

## 4. Link Users to WhatsApp Numbers

Users need to link their WhatsApp phone number to their account. You can do this by:

### Option A: Manual Database Update (for testing)

```typescript
// Run in Prisma Studio or via script
await prisma.user.update({
  where: { email: 'user@example.com' },
  data: { whatsappPhone: '972501234567' } // Format: country code + number (no + or spaces)
});
```

### Option B: Add to Settings Page (Recommended)

Add a WhatsApp phone field in `app/settings/page.tsx`:

```typescript
// Add to user profile form
<input
  type="tel"
  name="whatsapp_phone"
  placeholder="972501234567"
  pattern="[0-9]{12}"
  title="Format: 972501234567 (country code + number)"
/>
```

Update the API endpoint in `app/api/settings/route.ts`:

```typescript
whatsappPhone: body.whatsapp_phone || user.whatsappPhone,
```

---

## 5. Testing the Webhook

### Local Testing with ngrok

1. Install [ngrok](https://ngrok.com/):
   ```bash
   npm install -g ngrok
   ```

2. Start your Next.js server:
   ```bash
   npm run dev
   ```

3. Create a tunnel:
   ```bash
   ngrok http 3000
   ```

4. Use the ngrok URL in WhatsApp webhook configuration:
   ```
   https://your-ngrok-url.ngrok.io/api/webhook/whatsapp
   ```

5. Send a test image to your WhatsApp Business number

### Check Logs

Monitor the console output for:
```
📲 WhatsApp webhook received: {...}
📱 Processing message from 972501234567, type: image
✅ Found user: user@example.com (user_id)
📥 Downloaded image: 123456 bytes
🤖 Gemini scan result: {...}
✅ Draft transaction created: transaction_id
```

---

## 6. Production Deployment

### Vercel Deployment

1. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

2. Add environment variables in Vercel dashboard:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_VERIFY_TOKEN`
   - `GEMINI_API_KEY`

3. Update WhatsApp webhook URL to production:
   ```
   https://your-domain.vercel.app/api/webhook/whatsapp
   ```

### Security Considerations

- ✅ Webhook always returns 200 OK (prevents retry loops)
- ✅ Verify token prevents unauthorized webhook calls
- ✅ User lookup by phone number (only registered users can send receipts)
- ✅ Graceful error handling (Gemini failures don't break the webhook)

---

## 7. How It Works

### User Flow

1. **User sends image** via WhatsApp to your business number
2. **WhatsApp sends webhook** to your server with media ID
3. **Server downloads image** from WhatsApp Cloud API
4. **Gemini AI processes** the receipt image
5. **Draft transaction created** with extracted data
6. **User reviews and completes** the draft in the web app

### Draft Transaction Structure

Draft transactions are created with:
- `status: "DRAFT"` - Marks as incomplete
- `merchant`: From Gemini or "Draft Transaction"
- `amount`: From Gemini or 0
- `category`: Suggested by Gemini or "other"
- `description`: "מ-WhatsApp - נדרש מילוי פרטים"

---

## 8. Troubleshooting

### "No user found with WhatsApp phone"

**Solution**: Link the user's WhatsApp number to their account in the database.

### "Failed to download image from WhatsApp"

**Possible causes**:
- Invalid `WHATSAPP_TOKEN`
- Token expired (generate new permanent token)
- Media ID is invalid or expired (WhatsApp media expires after 30 days)

### "Gemini processing failed"

**Solution**: The system still creates a draft transaction with empty values. User can fill manually.

### Webhook not receiving messages

**Checklist**:
1. ✅ Webhook URL is publicly accessible (use ngrok for local testing)
2. ✅ `WHATSAPP_VERIFY_TOKEN` matches what you entered in Meta dashboard
3. ✅ Subscribed to `messages` field in webhook configuration
4. ✅ WhatsApp Business phone number is verified and active

---

## 9. Future Enhancements

- [ ] Send WhatsApp reply messages to confirm receipt processing
- [ ] Send notification when draft is ready for review
- [ ] Support multiple receipt images in one message
- [ ] Add voice message transcription for expense notes
- [ ] Implement user registration via WhatsApp

---

## Support

For WhatsApp Business API issues:
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Cloud API Quick Start](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

For Gemini AI issues:
- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
