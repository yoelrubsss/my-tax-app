import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// GET: Fetch user settings
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth();

    // CRITICAL FIX: Convert userId to String for Prisma
    const userIdStr = String(userId);

    // Fetch user profile using Prisma
    const profile = await prisma.userProfile.findUnique({
      where: { userId: userIdStr },
    });

    return NextResponse.json({
      success: true,
      data: profile,
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
    } = body;

    // Validate business_type
    if (business_type && !["OSEK_PATUR", "OSEK_MURSHE", "LTD"].includes(business_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid business type" },
        { status: 400 }
      );
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
