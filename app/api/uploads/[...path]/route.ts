import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    // Next.js 15 fix: Await params before using
    const params = await props.params;

    console.log("📥 Incoming request params.path:", params.path);

    // 1. Reconstruct the requested filename/path
    // Filter out 'api' and 'uploads' to get the clean relative path
    const cleanPathSegments = params.path.filter(p => p !== 'api' && p !== 'uploads');
    const relativePath = cleanPathSegments.join('/');

    console.log("🧹 Clean relative path:", relativePath);

    // Security: Prevent directory traversal attacks
    if (relativePath.includes("..") || relativePath.includes("\\..")) {
      console.log("🚫 Security: Directory traversal attempt blocked");
      return new NextResponse("Invalid file path", { status: 400 });
    }

    // 2. Define ALL possible locations where the file might be (The Hunt)
    const possiblePaths = [
      // Option A: Root uploads folder (e.g., /uploads/receipt.jpg)
      join(process.cwd(), 'uploads', relativePath),

      // Option B: Public uploads folder
      join(process.cwd(), 'public', 'uploads', relativePath),

      // Option C: Maybe the path already includes 'uploads'?
      join(process.cwd(), ...params.path),

      // Option D: Direct from uploads without nesting
      join(process.cwd(), 'uploads', ...cleanPathSegments),

      // Option E: Maybe it's stored with the full original path
      join(process.cwd(), relativePath),
    ];

    console.log("🔍 Searching for file:", relativePath);
    console.log("📂 Current working directory:", process.cwd());

    // 3. Iterate and find the first one that exists
    let foundPath: string | null = null;
    for (let i = 0; i < possiblePaths.length; i++) {
      const p = possiblePaths[i];
      // Decode URI to handle Hebrew filenames/spaces
      const decodedPath = decodeURIComponent(p);
      console.log(`  [${i + 1}/${possiblePaths.length}] Checking:`, decodedPath);

      if (existsSync(decodedPath)) {
        foundPath = decodedPath;
        console.log("✅ Found at:", foundPath);
        break;
      } else {
        console.log("❌ Not found");
      }
    }

    if (!foundPath) {
      console.log("💔 File not found in any location");
      return new NextResponse("File not found", { status: 404 });
    }

    // 4. Read the file
    console.log("📖 Reading file from:", foundPath);
    const fileBuffer = await readFile(foundPath);
    console.log("✅ File read successfully, size:", fileBuffer.length, "bytes");

    // 5. Simple MIME type detection
    const ext = foundPath.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'pdf' ? 'application/pdf' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      'application/octet-stream';

    console.log("📄 MIME type:", mimeType);

    // 6. Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("❌ Error serving file:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
