# DevLens authentication email template

## Signup verification

In the Supabase Dashboard for project `ufptcrhuibihwzjbjhqc`:

1. Open Authentication → Email Templates.
2. Select **Confirm signup**.
3. Set the subject to: `Your DevLens verification code`.
4. Replace the message body with the complete contents of `confirmation-otp.html`.
5. Save the template.

The HTML uses Supabase's `{{ .Token }}` variable. Do not replace it with `{{ .ConfirmationURL }}`, because the DevLens signup screen expects a six-digit code.

The DevLens signup UI calls `signUp()`, then verifies the code with `verifyOtp({ email, token, type: "email" })`.

## SMTP sender

Use the authenticated Brevo sender already configured for DevLens:
- From name: DevLens
- From address: noreply@devlens.cc.cd

Do not put SMTP credentials in this repository.
