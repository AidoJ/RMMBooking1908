# EmailJS Password Reset Template Setup Guide

This guide will help you create the password reset email template in your EmailJS account.

## Prerequisites

- EmailJS account (already configured with Service ID: `service_puww2kb`)
- Access to EmailJS dashboard at https://dashboard.emailjs.com/

## Step-by-Step Instructions

### 1. Create New Email Template

1. Log in to your EmailJS dashboard
2. Navigate to **Email Templates** in the left sidebar
3. Click **Create New Template** button
4. Set the **Template ID** to: `template_passwordreset`
5. Set the **Template Name** to: `Password Reset Request`

### 2. Configure Template Settings

**From Name:** Rejuvenators
**From Email:** Your verified sender email (e.g., noreply@rejuvenators.com)
**Subject:** Reset Your Password - Rejuvenators
**Reply To:** {{to_email}}

### 3. Email Template Content

Copy and paste the following HTML template into the **Content** section:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f0f2f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #007e8c 0%, #00a99d 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-family: 'Josefin Sans', Arial, sans-serif;">
                                Rejuvenators
                            </h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #007e8c; margin: 0 0 20px 0; font-size: 24px;">
                                Password Reset Request
                            </h2>

                            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi {{user_name}},
                            </p>

                            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                We received a request to reset your password. Click the button below to create a new password:
                            </p>

                            <!-- Reset Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{{reset_link}}"
                                           style="display: inline-block; padding: 15px 40px; background-color: #007e8c; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                                            Reset Your Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                                Or copy and paste this link into your browser:
                            </p>

                            <p style="color: #007e8c; font-size: 14px; word-break: break-all; background-color: #f0f8f9; padding: 15px; border-radius: 4px; margin: 0 0 20px 0;">
                                {{reset_link}}
                            </p>

                            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                                <p style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0;">
                                    <strong>Important:</strong> This link will expire in {{expiry_hours}} hour. If you didn't request a password reset, you can safely ignore this email.
                                </p>
                            </div>

                            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
                                Best regards,<br>
                                The Rejuvenators Team
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f0f8f9; padding: 20px 30px; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="color: #666666; font-size: 12px; line-height: 1.5; margin: 0;">
                                This is an automated message, please do not reply to this email.<br>
                                © 2025 Rejuvenators. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

### 4. Template Variables

The template uses the following variables (automatically populated by the backend):

| Variable | Description | Example |
|----------|-------------|---------|
| `{{to_email}}` | Recipient's email address | user@example.com |
| `{{user_name}}` | User's first name | John |
| `{{reset_link}}` | Password reset link with token | https://booking.rejuvenators.com/admin/reset-password?token=abc123... |
| `{{expiry_hours}}` | Token expiration time | 1 |

### 5. Test the Template

1. Click **Test It** button in EmailJS dashboard
2. Fill in sample values for all variables:
   - `to_email`: your-test-email@example.com
   - `user_name`: Test User
   - `reset_link`: https://booking.rejuvenators.com/admin/reset-password?token=test123
   - `expiry_hours`: 1
3. Click **Send Test** and verify the email arrives correctly

### 6. Save and Publish

1. Click **Save** to save your template
2. Verify the Template ID is exactly: `template_passwordreset`
3. The template is now ready to use!

## Text-Only Alternative

If you prefer a simpler text-only email, use this content instead:

```
Hi {{user_name}},

We received a request to reset your password for your Rejuvenators account.

To reset your password, click the following link:
{{reset_link}}

This link will expire in {{expiry_hours}} hour.

If you didn't request a password reset, you can safely ignore this email.

Best regards,
The Rejuvenators Team

---
This is an automated message, please do not reply to this email.
© 2025 Rejuvenators. All rights reserved.
```

## Troubleshooting

### Email not sending?
1. Verify EmailJS credentials in Netlify environment variables:
   - `EMAILJS_SERVICE_ID` = service_puww2kb
   - `EMAILJS_PUBLIC_KEY` = qfM_qA664E4JddSMN
   - `EMAILJS_PRIVATE_KEY` = (your private key)
2. Check EmailJS dashboard for quota limits
3. Verify sender email is verified in EmailJS

### Reset link not working?
1. Check that the token hasn't expired (1 hour limit)
2. Verify the database migration for `password_reset_tokens` has been run
3. Check Netlify function logs for errors

### Email goes to spam?
1. Add SPF and DKIM records for your sending domain
2. Use a verified sender email address
3. Consider using a dedicated transactional email service for production

## Next Steps

After creating the template:
1. Run the database migration to create the `password_reset_tokens` table
2. Test the complete password reset flow for both admin and therapist apps
3. Monitor EmailJS quota usage as password resets are used

## Support

If you encounter issues:
- Check EmailJS documentation: https://www.emailjs.com/docs/
- Review Netlify function logs for error messages
- Verify all environment variables are set correctly
