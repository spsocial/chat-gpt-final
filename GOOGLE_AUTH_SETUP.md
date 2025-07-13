# Google Sign-In Setup Guide

## 1. Google Cloud Console Configuration

### Go to: https://console.cloud.google.com

1. **APIs & Services > Credentials**
   - Click on your OAuth 2.0 Client ID

2. **Add Authorized JavaScript origins:**
   ```
   http://localhost:3000
   http://127.0.0.1:3000
   https://chat-gpt-final-production.up.railway.app
   ```

3. **Authorized redirect URIs:**
   - Leave empty (we use popup mode)

4. **OAuth consent screen:**
   - Publishing status: **Production** (not Testing)
   - User type: **External**
   - Add your app domain to Authorized domains

## 2. Railway Environment Variables

Add these to your Railway project variables:

```
GOOGLE_CLIENT_ID=1062109975739-avasict57nmucjds54qp4etmv24g49ue.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NODE_ENV=production
```

## 3. Troubleshooting

### Check Console (F12) for:
- "Google Identity Services loaded"
- "Google Sign-In library loaded successfully"
- "Current origin: [your-domain]"

### Common Issues:
1. **Stuck on transform page**: Origins not configured correctly
2. **No response**: Check if popup is blocked
3. **Error 400**: Invalid client ID or domain not authorized

### Test Flow:
1. Open browser console (F12)
2. Click Google Sign-In button
3. Check for any error messages
4. Verify origin matches authorized origins

## 4. Local Testing

For local testing, use:
```bash
npm start
```
Then access via: http://localhost:3000 (not 127.0.0.1)