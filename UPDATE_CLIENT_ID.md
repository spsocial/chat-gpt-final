# How to Update Google Client ID

## 1. Update in .env file:
```
GOOGLE_CLIENT_ID=YOUR_NEW_CLIENT_ID_HERE
```

## 2. Update in public/script.js:
Find and replace all occurrences of:
```
1062109975739-avasict57nmucjds54qp4etmv24g49ue.apps.googleusercontent.com
```
With your new Client ID

## 3. Update in public/google-test.html:
Same - replace the old Client ID with new one

## 4. Update in Railway Environment Variables:
```
GOOGLE_CLIENT_ID=YOUR_NEW_CLIENT_ID_HERE
```

## 5. Push changes:
```bash
git add -A
git commit -m "Update Google Client ID"
git push origin main
```