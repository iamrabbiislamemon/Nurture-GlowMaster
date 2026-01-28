import nodemailer from 'nodemailer';
import 'dotenv/config';

/**
 * Email Service for Nurture-Glow
 * Handles all email sending functionality
 */

// Create reusable transporter
let transporter;
let testAccount = null;
let isTestMode = false;

const initializeTransporter = async () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    // Use Ethereal Email for testing (auto-generates fake SMTP account)
    console.log('No email credentials found. Creating test email account...');
    testAccount = await nodemailer.createTestAccount();
    isTestMode = true;
    
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ TEST EMAIL ACCOUNT CREATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Preview URL: All sent emails can be viewed at:');
    console.log('  👉 Check console after sending email for preview link');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return;
  }
  
  // Check if using Gmail
  if (process.env.EMAIL_SERVICE === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
      }
    });
  } 
  // Generic SMTP configuration
  else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
};

// Initialize transporter (now async)
let initPromise = initializeTransporter();

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, resetToken, userName = '') {
  await initPromise; // Wait for transporter initialization
  
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: isTestMode ? testAccount.user : `"Nurture Glow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - Nurture Glow',
    html: generatePasswordResetHTML(resetLink, userName),
    text: generatePasswordResetText(resetLink, userName)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Password reset email sent to:', email);
    
    // If test mode, show preview URL
    if (isTestMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 EMAIL SENT - VIEW IN BROWSER:');
      console.log('   ' + previewUrl);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return { success: true, messageId: info.messageId, previewUrl: isTestMode ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('✗ Failed to send password reset email:', error.message);
    throw new Error('Failed to send password reset email');
  }
}

/**
 * Send welcome email on registration
 */
export async function sendWelcomeEmail(email, userName) {
  await initPromise; // Wait for transporter initialization
  
  const mailOptions = {
    from: isTestMode ? testAccount.user : `"Nurture Glow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Nurture Glow! 🌸',
    html: generateWelcomeHTML(userName),
    text: generateWelcomeText(userName)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Welcome email sent to:', email);
    
    // If test mode, show preview URL
    if (isTestMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 WELCOME EMAIL SENT - VIEW IN BROWSER:');
      console.log('   ' + previewUrl);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return { success: true, messageId: info.messageId, previewUrl: isTestMode ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('✗ Failed to send welcome email:', error.message);
    // Don't throw error for welcome email - it's not critical
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset confirmation email
 */
export async function sendPasswordResetConfirmationEmail(email, userName = '') {
  await initPromise; // Wait for transporter initialization
  
  const mailOptions = {
    from: isTestMode ? testAccount.user : `"Nurture Glow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Successful - Nurture Glow',
    html: generatePasswordResetConfirmationHTML(userName),
    text: generatePasswordResetConfirmationText(userName)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Password reset confirmation email sent to:', email);
    
    // If test mode, show preview URL
    if (isTestMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 CONFIRMATION EMAIL SENT - VIEW IN BROWSER:');
      console.log('   ' + previewUrl);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return { success: true, messageId: info.messageId, previewUrl: isTestMode ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('✗ Failed to send password reset confirmation:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send account suspension email
 */
export async function sendAccountSuspendedEmail(email, userName = '', reason = '') {
  await initPromise;

  const mailOptions = {
    from: isTestMode ? testAccount.user : `"Nurture Glow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Account Suspended - Nurture Glow',
    html: generateAccountSuspendedHTML(userName, reason),
    text: generateAccountSuspendedText(userName, reason)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Suspension email sent to:', email);
    if (isTestMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Email preview:', previewUrl);
    }
    return { success: true, messageId: info.messageId, previewUrl: isTestMode ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('✕ Failed to send suspension email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send admin email when a suspension appeal is submitted
 */
export async function sendSuspensionAppealEmail(email, details = {}) {
  await initPromise;

  const {
    userEmail = '',
    userName = 'User',
    message = '',
    appealId = '',
    submittedAt = ''
  } = details;

  const mailOptions = {
    from: isTestMode ? testAccount.user : `"Nurture Glow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'New Suspension Appeal Submitted',
    html: generateSuspensionAppealHTML({ userEmail, userName, message, appealId, submittedAt }),
    text: generateSuspensionAppealText({ userEmail, userName, message, appealId, submittedAt })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('âœ“ Suspension appeal email sent to:', email);
    if (isTestMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Email preview:', previewUrl);
    }
    return { success: true, messageId: info.messageId, previewUrl: isTestMode ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error('âœ• Failed to send suspension appeal email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig() {
  try {
    await initPromise; // Wait for initialization
    await transporter.verify();
    console.log('✓ Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('✗ Email configuration error:', error.message);
    return false;
  }
}

// ============= HTML EMAIL TEMPLATES =============

function generatePasswordResetHTML(resetLink, userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F5EF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F5EF; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Nurture Glow</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Your Pregnancy & Baby Care Journey</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${userName ? `<p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName},</p>` : ''}
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                We received a request to reset your password for your Nurture Glow account. Click the button below to create a new password:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background-color: #10B981; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                This link will expire in <strong>1 hour</strong>. If you didn't request this password reset, you can safely ignore this email.
              </p>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 8px;">
                <p style="color: #92400E; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Security Tip:</strong> Never share your password or reset link with anyone. Nurture Glow will never ask for your password via email.
                </p>
              </div>
              
              <p style="color: #9CA3AF; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetLink}" style="color: #10B981; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #6B7280; font-size: 13px; margin: 0 0 10px 0;">
                © 2026 Nurture Glow. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                Your trusted partner in pregnancy and baby care
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generatePasswordResetText(resetLink, userName) {
  return `
Hello ${userName ? userName : 'there'},

We received a request to reset your password for your Nurture Glow account.

Click the link below to create a new password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

Security Tip: Never share your password or reset link with anyone.

---
© 2026 Nurture Glow
Your trusted partner in pregnancy and baby care
  `;
}

function generateWelcomeHTML(userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Nurture Glow</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F5EF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F5EF; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #E6C77A 0%, #D4A853 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Welcome to Nurture Glow! 🌸</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #374151; font-size: 18px; margin: 0 0 20px 0; font-weight: 600;">
                Hello ${userName},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Welcome to <strong>Nurture Glow</strong> – your trusted companion throughout your pregnancy and baby care journey! We're thrilled to have you join our community of caring mothers and families.
              </p>
              
              <div style="background-color: #D1FAE5; padding: 20px; border-radius: 12px; margin: 30px 0;">
                <h3 style="color: #065F46; margin: 0 0 15px 0; font-size: 18px;">What You Can Do:</h3>
                <ul style="color: #047857; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Track your pregnancy week by week</li>
                  <li>Connect with experienced doctors</li>
                  <li>Monitor baby's health & development</li>
                  <li>Access nutrition & wellness guides</li>
                  <li>Join our supportive community</li>
                  <li>Shop for baby essentials</li>
                </ul>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; padding: 16px 40px; background-color: #E6C77A; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">Get Started</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                If you have any questions, our support team is here to help. Just reply to this email!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #6B7280; font-size: 13px; margin: 0 0 10px 0;">
                © 2026 Nurture Glow. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                Your trusted partner in pregnancy and baby care
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateWelcomeText(userName) {
  return `
Welcome to Nurture Glow! 🌸

Hello ${userName},

Welcome to Nurture Glow – your trusted companion throughout your pregnancy and baby care journey!

What You Can Do:
• Track your pregnancy week by week
• Connect with experienced doctors
• Monitor baby's health & development
• Access nutrition & wellness guides
• Join our supportive community
• Shop for baby essentials

Get started: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard

If you have any questions, our support team is here to help!

---
© 2026 Nurture Glow
Your trusted partner in pregnancy and baby care
  `;
}

function generatePasswordResetConfirmationHTML(userName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F5EF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F5EF; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <div style="width: 60px; height: 60px; background-color: #ffffff; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #10B981; font-size: 32px;">✓</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Password Reset Successful</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${userName ? `<p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName},</p>` : ''}
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your password has been successfully reset. You can now log in to your Nurture Glow account with your new password.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; padding: 16px 40px; background-color: #10B981; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">Log In Now</a>
                  </td>
                </tr>
              </table>
              
              <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px; margin: 20px 0; border-radius: 8px;">
                <p style="color: #991B1B; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>Didn't reset your password?</strong><br>
                  If you didn't make this change, please contact our support team immediately to secure your account.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #6B7280; font-size: 13px; margin: 0 0 10px 0;">
                © 2026 Nurture Glow. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                Your trusted partner in pregnancy and baby care
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generatePasswordResetConfirmationText(userName) {
  return `
Password Reset Successful ✓

Hello ${userName ? userName : 'there'},

Your password has been successfully reset. You can now log in to your Nurture Glow account with your new password.

Log in: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/login

IMPORTANT: If you didn't reset your password, please contact our support team immediately to secure your account.

---
© 2026 Nurture Glow
Your trusted partner in pregnancy and baby care
  `;
}

function generateAccountSuspendedHTML(userName, reason) {
  const reasonHtml = reason ? `<p style="color: #374151; font-size: 14px;"><strong>Reason:</strong> ${reason}</p>` : '';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Suspended</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F5EF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F5EF; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Account Suspended</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              ${userName ? `<p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${userName},</p>` : ''}
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your Nurture Glow account has been suspended. If you believe this is a mistake, please contact support or submit a show-cause request from the login screen.
              </p>
              ${reasonHtml}
              <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                If you need assistance, reply to this email and our team will help you.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #6B7280; font-size: 13px; margin: 0 0 10px 0;">
                © 2026 Nurture Glow. All rights reserved.
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                Your trusted partner in pregnancy and baby care
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateAccountSuspendedText(userName, reason) {
  return `
Account Suspended

Hello ${userName ? userName : 'there'},

Your Nurture Glow account has been suspended.
${reason ? `Reason: ${reason}\n` : ''}
If you believe this is a mistake, please submit a show-cause request from the login screen or contact support.

© 2026 Nurture Glow
Your trusted partner in pregnancy and baby care
  `;
}

export default {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordResetConfirmationEmail,
  sendAccountSuspendedEmail,
  sendSuspensionAppealEmail,
  verifyEmailConfig
};

function generateSuspensionAppealHTML({ userEmail, userName, message, appealId, submittedAt }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Suspension Appeal</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0F172A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">New Suspension Appeal</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 30px;">
              <p style="color: #E5E7EB; margin: 0 0 12px 0; font-size: 14px;">
                A suspended user has submitted a show-cause request.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(15, 23, 42, 0.6); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <tr>
                  <td style="color: #9CA3AF; font-size: 12px; padding-bottom: 6px;">User</td>
                  <td style="color: #F9FAFB; font-size: 12px; padding-bottom: 6px; text-align: right;">${userName}</td>
                </tr>
                <tr>
                  <td style="color: #9CA3AF; font-size: 12px; padding-bottom: 6px;">Email</td>
                  <td style="color: #F9FAFB; font-size: 12px; padding-bottom: 6px; text-align: right;">${userEmail || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="color: #9CA3AF; font-size: 12px;">Appeal ID</td>
                  <td style="color: #F9FAFB; font-size: 12px; text-align: right;">${appealId}</td>
                </tr>
              </table>
              <p style="color: #E6C77A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px 0;">Appeal Message</p>
              <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 10px; color: #F3F4F6; font-size: 14px; line-height: 1.6;">
                ${message || 'No message provided.'}
              </div>
              <p style="color: #6B7280; font-size: 12px; margin-top: 16px;">Submitted: ${submittedAt || 'N/A'}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center; background: #0B1324;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">Open the System Admin → Suspension Appeals panel to review.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateSuspensionAppealText({ userEmail, userName, message, appealId, submittedAt }) {
  return `
New Suspension Appeal Submitted

User: ${userName}
Email: ${userEmail || 'N/A'}
Appeal ID: ${appealId}
Submitted: ${submittedAt || 'N/A'}

Message:
${message || 'No message provided.'}

Review in System Admin -> Suspension Appeals.
  `;
}
