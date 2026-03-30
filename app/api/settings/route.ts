import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { formatIsraeliPhoneForDisplay } from "@/lib/phone-utils";

// GET: Fetch user settings
export async function GET(_request: NextRequest) {
  try {
    const userId = await requireAuth();

    // CRITICAL FIX: Convert userId to String for Prisma
    const userIdStr = String(userId);

    // Single round-trip: profile + WhatsApp fields (was two sequential queries)
    const user = await prisma.user.findUnique({
      where: { id: userIdStr },
      select: {
        whatsappPhone: true,
        whatsappPhone2: true,
        profile: true,
      },
    });

    const profile = user?.profile ?? null;

    const formattedPhone = user?.whatsappPhone
      ? formatIsraeliPhoneForDisplay(user.whatsappPhone)
      : null;
    const formattedPhone2 = user?.whatsappPhone2
      ? formatIsraeliPhoneForDisplay(user.whatsappPhone2)
      : null;

    // Plain JSON only (no Prisma object spread) — avoids surprise fields / serialization issues on the client.
    return NextResponse.json({
      success: true,
      data: {
        business_name: profile?.businessName ?? null,
        business_type: profile?.businessType ?? null,
        is_home_office: profile?.isHomeOffice ?? false,
        has_children: profile?.hasChildren ?? false,
        children_count: profile?.childrenCount ?? 0,
        has_vehicle: profile?.hasVehicle ?? false,
        standard_work_day: profile?.standardWorkDay ?? 9,
        whatsapp_phone: formattedPhone,
        whatsapp_phone_2: formattedPhone2,
      },
    });
  } catch (error: any) {
    console.error("Error fetching settings:", error);

    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PUT: Update user settings
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth();

    // CRITICAL FIX: Convert userId to String for Prisma
    const userIdStr = String(userId);

    const body = await request.json();

    const {
      business_name,
      business_type,
      is_home_office,
      has_children,
      children_count,
      has_vehicle,
      whatsapp_phone,
      whatsapp_phone_2,
    } = body;

    // Validate business_type
    if (business_type && !["OSEK_PATUR", "OSEK_MURSHE", "LTD"].includes(business_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid business type" },
        { status: 400 }
      );
    }

    // Normalize and validate WhatsApp phones if provided
    let normalizedPhone: string | null | undefined = undefined;
    if (whatsapp_phone !== undefined) {
      if (whatsapp_phone === "" || whatsapp_phone === null) {
        normalizedPhone = null;
      } else {
        const { normalizeIsraeliPhone } = await import("@/lib/phone-utils");
        normalizedPhone = normalizeIsraeliPhone(whatsapp_phone);

        if (!normalizedPhone) {
          return NextResponse.json(
            { success: false, error: "Invalid phone number format. Please use Israeli format (e.g., 052-1234567)" },
            { status: 400 }
          );
        }

        console.log(`📱 [SETTINGS] Phone normalized: "${whatsapp_phone}" → "${normalizedPhone}"`);
      }
    }

    let normalizedPhone2: string | null | undefined = undefined;
    if (whatsapp_phone_2 !== undefined) {
      if (whatsapp_phone_2 === "" || whatsapp_phone_2 === null) {
        normalizedPhone2 = null;
      } else {
        const { normalizeIsraeliPhone } = await import("@/lib/phone-utils");
        normalizedPhone2 = normalizeIsraeliPhone(whatsapp_phone_2);

        if (!normalizedPhone2) {
          return NextResponse.json(
            { success: false, error: "Invalid secondary phone format. Please use Israeli format (e.g., 052-1234567)" },
            { status: 400 }
          );
        }

        console.log(`📱 [SETTINGS] Phone 2 normalized: "${whatsapp_phone_2}" → "${normalizedPhone2}"`);
      }
    }

    // Use upsert to create or update the profile
    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: userIdStr },
      create: {
        userId: userIdStr,
        businessName: business_name || null,
        businessType: business_type || null,
        isHomeOffice: is_home_office || false,
        hasChildren: has_children || false,
        childrenCount: has_children ? (children_count || 0) : 0,
        hasVehicle: has_vehicle || false,
      },
      update: {
        businessName: business_name !== undefined ? business_name : undefined,
        businessType: business_type !== undefined ? business_type : undefined,
        isHomeOffice: is_home_office !== undefined ? is_home_office : undefined,
        hasChildren: has_children !== undefined ? has_children : undefined,
        childrenCount: children_count !== undefined ? (has_children ? children_count : 0) : undefined,
        hasVehicle: has_vehicle !== undefined ? has_vehicle : undefined,
      },
    });

    // Update WhatsApp numbers in User table
    if (whatsapp_phone !== undefined || whatsapp_phone_2 !== undefined) {
      const data: { whatsappPhone?: string | null; whatsappPhone2?: string | null } = {};
      if (whatsapp_phone !== undefined) {
        data.whatsappPhone = normalizedPhone as string | null;
      }
      if (whatsapp_phone_2 !== undefined) {
        data.whatsappPhone2 = normalizedPhone2 as string | null;
      }
      await prisma.user.update({
        where: { id: userIdStr },
        data,
      });
      console.log(`✅ [SETTINGS] WhatsApp phone(s) updated for user ${userIdStr}`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdStr },
      select: { whatsappPhone: true, whatsappPhone2: true },
    });

    const formattedPhone = user?.whatsappPhone
      ? formatIsraeliPhoneForDisplay(user.whatsappPhone)
      : null;
    const formattedPhone2 = user?.whatsappPhone2
      ? formatIsraeliPhoneForDisplay(user.whatsappPhone2)
      : null;

    // Convert back to snake_case for frontend compatibility
    const responseData = {
      id: updatedProfile.id,
      user_id: updatedProfile.userId,
      business_name: updatedProfile.businessName,
      business_type: updatedProfile.businessType,
      is_home_office: updatedProfile.isHomeOffice,
      has_children: updatedProfile.hasChildren,
      children_count: updatedProfile.childrenCount,
      has_vehicle: updatedProfile.hasVehicle,
      whatsapp_phone: formattedPhone,
      whatsapp_phone_2: formattedPhone2,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("Error updating settings:", error);

    if (error.message === "Authentication required" || error.message.includes("authentication")) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
