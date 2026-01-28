# Email Configuration Guide for Nurture-Glow

## 🚀 Quick Setup (Gmail - Recommended for Testing)

### Step 1: Enable 2-Step Verification
1. Go to your [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required for App Passwords)

### Step 2: Generate App Password
1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Other (Custom name)**
3. Enter "Nurture Glow" as the name
4. Click **Generate**
5. Copy the 16-character password (remove spaces)

### Step 3: Update .env File
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop  # Your 16-char app password
FRONTEND_URL=http://localhost:5173
```

### Step 4: Restart Backend
```bash
npm start
```

You should see: `✓ Email service is ready`

---

## 📧 Email Features Included

### 1. **Welcome Email** (On Registration)
- Sent automatically when new user registers
- Beautiful HTML template with brand colors
- Includes quick start guide
- Non-blocking (won't delay registration response)

### 2. **Password Reset Email**
- Triggered when user clicks "Forgot Password"
- Contains secure reset link (1-hour expiry)
- Beautiful HTML with security tips
- Prevents email enumeration attacks

### 3. **Password Reset Confirmation**
- Sent after successful password reset
- Security alert in case of unauthorized access
- Includes login link

---

## 🔧 Alternative Email Services

### Outlook/Hotmail
```env
EMAIL_SERVICE=
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Custom SMTP Server
```env
EMAIL_SERVICE=
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=noreply@your-domain.com
EMAIL_PASSWORD=your-smtp-password
```

### SendGrid (Production Recommended)
```bash
npm install @sendgrid/mail
```

Update `emailService.js`:
```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Use SendGrid instead of nodemailer
```

---

## 🧪 Testing Email Functionality

### Test Password Reset Flow:
1. Start backend: `npm start`
2. Verify email config: Look for `✓ Email service is ready`
3. Go to login page: `http://localhost:5173/login`
4. Click "Forgot password?"
5. Enter your email
6. Check your inbox for reset email (might be in spam initially)

### Development Mode Benefits:
- Reset link is also logged to console
- Can copy link directly from terminal if email fails
- Email errors won't break the flow

---

## 🔒 Security Features

✅ **Rate Limiting** - 5 attempts per 15 minutes (client-side)  
✅ **Token Expiry** - Reset tokens expire in 1 hour  
✅ **One-Time Use** - Tokens can only be used once  
✅ **Email Enumeration Prevention** - Same response for existing/non-existing emails  
✅ **HTML Sanitization** - All inputs sanitized  
✅ **JWT Signing** - Tokens cryptographically signed  

---

## 🎨 Email Templates

All email templates include:
- **Responsive Design** - Works on mobile and desktop
- **Brand Colors** - Matches Nurture-Glow design system
- **Plain Text Fallback** - For email clients that don't support HTML
- **Security Tips** - Educates users about phishing
- **Professional Layout** - Beautiful gradient headers

---

## 🐛 Troubleshooting

### "Email configuration error"
- **Cause**: Invalid credentials or 2FA not enabled
- **Fix**: Enable 2-Step Verification and generate new App Password

### "Less secure app access"
- **Cause**: Old Gmail security setting (deprecated)
- **Fix**: Use App Password instead (required for modern Gmail)

### Emails going to spam
- **Cause**: New sender, no SPF/DKIM records
- **Fix**: 
  - Mark as "Not Spam" for testing
  - For production, set up SPF/DKIM/DMARC records
  - Use professional email service (SendGrid, AWS SES)

### "Connection timeout"
- **Cause**: Firewall blocking SMTP port
- **Fix**: Check port 587 is open, try different network

### Email not received
1. Check spam folder
2. Check console logs for errors
3. Verify EMAIL_USER is correct
4. Test with different email provider
5. Check email service status (Gmail, etc.)

---

## 📊 Production Recommendations

### For Production Deployment:

1. **Use Professional Email Service**
   - SendGrid (12,000 free emails/month)
   - AWS SES (62,000 free emails/month)
   - Mailgun (5,000 free emails/month)

2. **Set Up DNS Records**
   - SPF record for email authentication
   - DKIM for signature verification
   - DMARC for reporting

3. **Monitor Delivery**
   - Track bounce rates
   - Monitor spam complaints
   - Set up delivery webhooks

4. **Email Best Practices**
   - Use consistent "From" name
   - Include unsubscribe link (for newsletters)
   - Warm up new domains gradually
   - Keep email content clean (avoid spam triggers)

---

## 📝 Environment Variables Reference

```env
# Required
EMAIL_SERVICE=gmail                    # Or leave empty for custom SMTP
EMAIL_USER=your-email@gmail.com        # Sender email address
EMAIL_PASSWORD=your-app-password       # Gmail App Password (16 chars)

# Optional (for custom SMTP)
SMTP_HOST=smtp.gmail.com               # SMTP server hostname
SMTP_PORT=587                          # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE=false                      # true for port 465, false for 587

# Application
FRONTEND_URL=http://localhost:5173     # Frontend URL for email links
NODE_ENV=development                   # Show dev logs
```

---

## 💡 Tips

- **Gmail Limits**: 500 emails/day for free accounts
- **Testing**: Use your own email for testing
- **Logs**: Check console for email delivery status
- **Async**: Welcome emails are non-blocking
- **Fallback**: Reset tokens work even if email fails

---

## ✅ Verification Checklist

- [ ] 2-Step Verification enabled on Google Account
- [ ] App Password generated (16 characters)
- [ ] EMAIL_USER set in .env
- [ ] EMAIL_PASSWORD set in .env (no spaces)
- [ ] Backend restarted after .env changes
- [ ] Console shows "✓ Email service is ready"
- [ ] Test email received successfully
- [ ] Check spam folder if not in inbox

---

**Need Help?** Check the console logs - they show detailed error messages for email delivery issues.
