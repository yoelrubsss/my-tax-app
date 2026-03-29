# Vercel WhatsApp Webhook Setup Guide

## ✅ Pre-Deployment Checklist

### 1. Environment Variables in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables and add:

```env
# WhatsApp Configuration
WHATSAPP_TOKEN=EAAVJsKDkz8kBROpjdC9qXKMGKXiRAgJQtD7rZCmaFMK7UJlwwuqhLy3955d8qZAbOrz2BxwGLvZB1cE03ZCwTtmSHa3BZAO3mxbLqcdZAVG3G197aXvKzXrZCupr0oyP4WAZB8uVoqDpsohzDjQqmKvoIY208qoe4di64Teuva3iLijwxPAwGLrUhaUEFTzXsnxzesMDtmue3BI1WTJxZAZBuieIMVpkGgza1hnGr46lc53WpnRpbLr6JbOZCqJPb6qphTXBcDFGDZAmZC37UKQPBk7MW8exk2knShfOJEtcZD

WHATSAPP_VERIFY_TOKEN=yoel_tax_app_2026

WHATSAPP_PHONE_NUMBER_ID=996334873570957

WHATSAPP_BUSINESS_ACCOUNT_ID=1267584128303097

# Gemini AI (for receipt scanning)
GEMINI_API_KEY=AIzaSyBbaLGSo4bXW0w_GZ2vxwGGlpTFrx8sog4
```

**CRITICAL**: After adding these, click **"Redeploy"** to apply the changes!

---

## 🔧 Webhook Configuration Steps

### Step 1: Verify Deployment

1. Visit: `https://my-tax-app-seven.vercel.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=yoel_tax_app_2026&hub.challenge=test123`

2. **Expected response**: Plain text `test123` (not JSON, not error page)

3. **If you get an error**, check:
   - Environment variables are set in Vercel
   - You redeployed after adding env vars
   - Check Vercel logs for errors

---

### Step 2: Configure Meta Webhook

1. Go to [Meta for Developers](https://developers.facebook.com/apps)

2. Select your app → **WhatsApp** → **Configuration**

3. Find **Webhook** section, click **Edit**

4. Enter these exact values:
   ```
   Callback URL: https://my-tax-app-seven.vercel.app/api/webhook/whatsapp
   Verify token: yoel_tax_app_2026
   ```

5. Click **Verify and Save**

6. **Subscribe to webhook fields:**
   - Click **Manage** button
   - Check the box for **messages** ✅
   - Click **Save**

---

## 🧪 Testing

### Test 1: Manual Verification

Open this URL in your browser:
```
https://my-tax-app-seven.vercel.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=yoel_tax_app_2026&hub.challenge=HELLO_WORLD
```

**Expected**: Browser shows plain text `HELLO_WORLD`

---

### Test 2: Send Image via WhatsApp

1. From phone number: **+972-52-458-9771**
2. Send to your WhatsApp Business number
3. Attach a receipt image

---

### Test 3: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → **Logs**
2. Look for:
   ```
   📲 WhatsApp webhook verification request
   ✅ WhatsApp webhook verified
   📱 Processing message from 972524589771
   ```

---

## 🔍 Troubleshooting

### Error: "The callback URL or verify token couldn't be validated"

**Causes:**
- Environment variables not set in Vercel
- Forgot to redeploy after adding env vars
- Wrong verify token (typo)
- Endpoint not returning plain text

**Solutions:**
1. Double-check environment variables in Vercel dashboard
2. Redeploy: `vercel --prod` or click "Redeploy" in dashboard
3. Test the manual verification URL in your browser
4. Check Vercel function logs for errors

---

### Error: Webhook receives verification but not messages

**Solution:**
- Make sure you clicked **Manage** and checked **messages** field
- Wait 1-2 minutes after subscribing
- Try sending a test message

---

### Error: "No user found with WhatsApp phone: 972524589771"

**Solution:** Already linked! ✅
```bash
npm run link-whatsapp yoelrubs@gmail.com 972524589771
```

---

### Error: Gemini processing fails

**Check:**
- `GEMINI_API_KEY` is set in Vercel
- Gemini quota hasn't been exceeded
- Check Vercel logs for specific error

---

## 📝 Environment Variables Checklist

Copy these to Vercel → Settings → Environment Variables:

- [ ] `WHATSAPP_TOKEN`
- [ ] `WHATSAPP_VERIFY_TOKEN`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID`
- [ ] `GEMINI_API_KEY`
- [ ] `DATABASE_URL`
- [ ] `DIRECT_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `JWT_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`

After adding all variables: **REDEPLOY!**

---

## 🚀 Quick Command Reference

```bash
# Deploy to Vercel
vercel --prod

# Test webhook locally with ngrok
npm run dev
ngrok http 3000

# Link WhatsApp to user
npm run link-whatsapp yoelrubs@gmail.com 972524589771

# Check database
npx prisma studio
```

---

## ✅ Success Indicators

When everything works, you'll see in Vercel logs:

```
📲 WhatsApp webhook received
📱 Processing message from 972524589771, type: image
✅ Found user: yoelrubs@gmail.com
📥 Downloaded image: 45231 bytes
🤖 Gemini response: {"merchant":"קופיקס"...}
✅ Draft transaction created: clxxxxxx
```

And in your web app, you'll see a new draft transaction! 🎉
