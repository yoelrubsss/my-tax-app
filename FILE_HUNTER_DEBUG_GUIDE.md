# File Hunter - Debugging Guide

## 🎯 What Changed

The API route now uses a "Hunter" strategy that searches **5 possible locations** for each file instead of just one.

## 🔍 How It Works

When a request comes in for `/api/uploads/receipt_123.jpg`, the route:

1. **Cleans the path** - Removes 'api' and 'uploads' from segments
2. **Searches 5 locations** in order:
   - `C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg`
   - `C:\Users\יואל\Desktop\my-tax-app\public\uploads\receipt_123.jpg`
   - `C:\Users\יואל\Desktop\my-tax-app\api\uploads\receipt_123.jpg`
   - `C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg` (direct)
   - `C:\Users\יואל\Desktop\my-tax-app\receipt_123.jpg` (relative)
3. **Returns the first match** it finds
4. **Logs everything** to help debug

## 📋 Debugging Steps

### Step 1: Check Your Terminal

When you load a receipt, you'll see logs like this:

```
📥 Incoming request params.path: [ 'uploads', 'receipt_123.jpg' ]
🧹 Clean relative path: receipt_123.jpg
🔍 Searching for file: receipt_123.jpg
📂 Current working directory: C:\Users\יואל\Desktop\my-tax-app
  [1/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg
✅ Found at: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg
📖 Reading file from: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg
✅ File read successfully, size: 245678 bytes
📄 MIME type: image/jpeg
```

### Step 2: If Still Getting 404

Look for this pattern in terminal:

```
📥 Incoming request params.path: [ 'uploads', 'receipt_123.jpg' ]
🧹 Clean relative path: receipt_123.jpg
🔍 Searching for file: receipt_123.jpg
📂 Current working directory: C:\Users\יואל\Desktop\my-tax-app
  [1/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg
❌ Not found
  [2/5] Checking: C:\Users\יואל\Desktop\my-tax-app\public\uploads\receipt_123.jpg
❌ Not found
  [3/5] Checking: C:\Users\יואל\Desktop\my-tax-app\api\uploads\receipt_123.jpg
❌ Not found
  [4/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_123.jpg
❌ Not found
  [5/5] Checking: C:\Users\יואל\Desktop\my-tax-app\receipt_123.jpg
❌ Not found
💔 File not found in any location
```

### Step 3: Find Where Files Actually Are

Run this in your terminal:

```bash
# Windows PowerShell
Get-ChildItem -Path "C:\Users\יואל\Desktop\my-tax-app" -Recurse -Include *.jpg,*.jpeg,*.png,*.pdf | Select-Object FullName

# OR Windows CMD
dir /s /b C:\Users\יואל\Desktop\my-tax-app\*.jpg
dir /s /b C:\Users\יואל\Desktop\my-tax-app\*.png
dir /s /b C:\Users\יואל\Desktop\my-tax-app\*.pdf
```

This will show you the **actual location** of all uploaded files.

### Step 4: Compare Logs

Compare the logs:
- **What the API is searching for:** Look at `[1/5] Checking:` lines
- **Where the file actually is:** From the dir command above

If they don't match, you need to adjust the upload logic.

## 🔧 Common Issues & Solutions

### Issue 1: Files in Wrong Folder

**Symptom:** All 5 checks fail, but files exist somewhere

**Solution:** Check where your `/api/upload` endpoint saves files:

```typescript
// In app/api/upload/route.ts
const uploadDir = join(process.cwd(), 'uploads'); // Should match Option A in hunter
```

### Issue 2: Filename Mismatch

**Symptom:** Logs show searching for `receipt_123.jpg` but file is `receipt_123 (1).jpg`

**Solution:** Check how filenames are generated during upload. Look for:
- Timestamp prefixes
- Random suffixes
- Space/special character encoding

### Issue 3: Hebrew/Special Characters

**Symptom:** Logs show garbled characters in filename

**Solution:** Already handled! The route uses `decodeURIComponent()` to handle Hebrew filenames.

### Issue 4: Nested Folders

**Symptom:** Files are in `uploads/2024/01/receipt.jpg` but hunter looks for `uploads/receipt.jpg`

**Solution:** Check if your upload endpoint creates subfolders. If so, the database should store the full relative path like `2024/01/receipt.jpg`.

## 📊 Expected Log Flow

### Successful Request
```
📥 Incoming request params.path: ['uploads', 'receipt_abc123.jpg']
🧹 Clean relative path: receipt_abc123.jpg
🔍 Searching for file: receipt_abc123.jpg
📂 Current working directory: C:\Users\יואל\Desktop\my-tax-app
  [1/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_abc123.jpg
✅ Found at: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_abc123.jpg
📖 Reading file from: C:\Users\יואל\Desktop\my-tax-app\uploads\receipt_abc123.jpg
✅ File read successfully, size: 154832 bytes
📄 MIME type: image/jpeg
```

### Failed Request
```
📥 Incoming request params.path: ['uploads', 'missing_file.jpg']
🧹 Clean relative path: missing_file.jpg
🔍 Searching for file: missing_file.jpg
📂 Current working directory: C:\Users\יואל\Desktop\my-tax-app
  [1/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\missing_file.jpg
❌ Not found
  [2/5] Checking: C:\Users\יואל\Desktop\my-tax-app\public\uploads\missing_file.jpg
❌ Not found
  [3/5] Checking: C:\Users\יואל\Desktop\my-tax-app\api\uploads\missing_file.jpg
❌ Not found
  [4/5] Checking: C:\Users\יואל\Desktop\my-tax-app\uploads\missing_file.jpg
❌ Not found
  [5/5] Checking: C:\Users\יואל\Desktop\my-tax-app\missing_file.jpg
❌ Not found
💔 File not found in any location
```

## 🎯 Next Steps

1. **Upload a new receipt** using the quick upload button
2. **Open your terminal** where Next.js dev server is running
3. **Click "מלא פרטים"** to open the receipt in TransactionEditor
4. **Watch the logs** to see where it's searching
5. **Copy the logs** and send them if you still get 404

The logs will tell us **exactly** where the file should be!

---

## 🚀 Quick Test

Run this in your terminal to test the route directly:

```bash
# Test with a known file (replace with your actual filename)
curl http://localhost:3000/api/uploads/receipt_123.jpg
```

If you get a 404, check the server logs - they'll show all 5 locations it checked.
