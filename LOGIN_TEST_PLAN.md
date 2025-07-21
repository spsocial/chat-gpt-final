# Login System Test Plan

## Summary of Implementation

The login system has been implemented with the following features:
- Login button in desktop header (next to tutorial/guide button)
- Login modal with three states: Not linked, Link account, and Logged in
- Firebase integration using the same database as the credit system
- Credit syncing between devices
- Automatic credit sync on page load for logged-in users

## Fixed Issues

1. **Fixed undefined function error**: Changed `getUserId()` to `ensureUserId()` in the `showLinkAccountForm()` function
2. **Added credit sync on page load**: When a user visits the page while logged in, their credits are automatically synced from Firebase

## Test Steps

### 1. Login Button Visibility (Desktop)
- **Expected**: Login button should appear in the desktop header with:
  - Dark gray background (#404040)
  - User icon (👤) and "Login" text
  - Located in the usage-display section next to the guide button
- **Test**: Open the site on desktop (viewport > 768px)

### 2. Login Modal Opening
- **Expected**: Clicking the login button should open the login modal
- **Test**: Click the login button and verify modal appears

### 3. Not Linked State (First Time Users)
- **Expected**: Modal shows login form with:
  - Username and Password fields
  - "เข้าสู่ระบบ" (Login) button
  - Link to create account ("ยังไม่ได้ผูกบัญชี? คลิกที่นี่")
- **Test**: Open modal without being logged in

### 4. Link Account State
- **Expected**: When clicking "คลิกที่นี่", should show:
  - Pre-filled User ID (10 characters)
  - Username field (for new username)
  - Password field
  - "ผูกบัญชี" (Link Account) button
- **Test**: Click the link account link and verify User ID is pre-filled

### 5. Account Creation
- **Test Process**:
  1. Enter a unique username (lowercase, min 3 chars)
  2. Enter a password
  3. Click "ผูกบัญชี"
- **Expected**: 
  - Success notification "✅ ผูกบัญชีสำเร็จ!"
  - Automatic switch to logged-in view
  - Credits saved to Firebase

### 6. Login Process
- **Test Process**:
  1. Enter existing username
  2. Enter correct password
  3. Click "เข้าสู่ระบบ"
- **Expected**:
  - Success notification "✅ เข้าสู่ระบบสำเร็จ!"
  - Page refreshes after 1.5 seconds
  - Credits synced from Firebase

### 7. Logged In State
- **Expected**: Shows:
  - User icon (👤)
  - Username
  - User ID
  - Current credits
  - "ออกจากระบบ" (Logout) button
- **Test**: Open modal while logged in

### 8. Credit Syncing
- **Test Process**:
  1. Note current credits on Device A
  2. Make a purchase or use credits
  3. Login on Device B with same account
- **Expected**: Credits should match between devices

### 9. Auto-sync on Page Load
- **Test Process**:
  1. Login on Device A
  2. Change credits on Device B
  3. Refresh page on Device A
- **Expected**: Credits automatically update without re-login

### 10. Logout Process
- **Test**: Click "ออกจากระบบ"
- **Expected**: 
  - Notification "👋 ออกจากระบบแล้ว"
  - Modal closes
  - Returns to not-linked state

## Firebase Database Structure

```
credit-wallet-e9b6e/
├── accounts/
│   └── [username]/
│       ├── userId: string
│       └── createdAt: ISO string
└── users/
    └── [userId]/
        ├── credits: number
        ├── linkedAccount/
        │   ├── username: string
        │   └── hashedPassword: string
        └── updatedAt: ISO string
```

## Potential Issues to Watch

1. **Mobile View**: The login button has class `desktop-login-btn` but no explicit mobile hiding in CSS. It should be visible on desktop but might need testing on various screen sizes.

2. **Credit Sync Timing**: Credits sync on:
   - Login
   - Page load (if logged in)
   - After credit changes (via `syncCreditsToCloud()`)

3. **Password Security**: Uses SHA-256 hashing (client-side). In production, should use server-side hashing with salt.

## Testing Checklist

- [ ] Login button visible on desktop
- [ ] Modal opens when clicking login button
- [ ] Can create new account
- [ ] Can login with existing account
- [ ] Credits sync on login
- [ ] Credits sync on page refresh
- [ ] Logout works correctly
- [ ] Error messages show for invalid inputs
- [ ] Username uniqueness is enforced
- [ ] Password verification works
- [ ] Cross-device credit syncing works

## Debug Information

- Firebase URL: `https://credit-wallet-e9b6e-default-rtdb.asia-southeast1.firebasedatabase.app`
- Check console for errors related to Firebase requests
- Local storage keys: `linkedAccount`, `userId`, `totalCredits`