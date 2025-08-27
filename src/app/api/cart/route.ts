// src/app/api/cart/route.ts

import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod'; 

// Validation schemas using zod
const CartItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be non-negative'),
});

const UpdateCartItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

const DeleteCartItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
});

// In-memory storage (temporary replacement for a database)
const carts: Record<string, { productId: string; quantity: number; price: number }[]> = {};

// GET /api/cart - Fetch cart items
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    const cartItems = carts[userId] || [];

    return NextResponse.json({
      items: cartItems,
      totalItems: cartItems.length,
      totalPrice: cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching cart items:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch cart items', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    const body = await request.json();
    const validatedData = CartItemSchema.parse(body);

    if (!carts[userId]) {
      carts[userId] = [];
    }

    const existingItem = carts[userId].find(
      (item) => item.productId === validatedData.productId
    );

    if (existingItem) {
      existingItem.quantity += validatedData.quantity;
    } else {
      carts[userId].push({
        productId: validatedData.productId,
        quantity: validatedData.quantity,
        price: validatedData.price,
      });
    }

    return NextResponse.json({
      message: 'Item added to cart successfully',
      item: validatedData,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      // Explicitly handle ZodError and access errors property
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues }, // Use error.issues instead of error.errors
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error adding item to cart:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to add item to cart', details: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/cart - Update cart item
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    const body = await request.json();
    const validatedData = UpdateCartItemSchema.parse(body);

    if (!carts[userId]) {
      return NextResponse.json(
        { error: 'Cart not found' },
        { status: 404 }
      );
    }

    const itemIndex = carts[userId].findIndex(
      (item) => item.productId === validatedData.productId
    );

    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found in cart' },
        { status: 404 }
      );
    }

    if (validatedData.quantity === 0) {
      carts[userId].splice(itemIndex, 1);
    } else {
      carts[userId][itemIndex].quantity = validatedData.quantity;
    }

    return NextResponse.json({
      message: 'Cart item updated successfully',
      item: validatedData,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues }, // Use error.issues
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating cart item:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update cart item', details: errorMessage },
      { status: 500 }
    );
  }
}


// DELETE /api/cart - Remove item from cart
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';
    const validatedData = DeleteCartItemSchema.parse({
      itemId: searchParams.get('itemId'),
    });

    if (!carts[userId]) {
      return NextResponse.json(
        { error: 'Cart not found' },
        { status: 404 }
      );
    }

    const itemIndex = carts[userId].findIndex(
      (item) => item.productId === validatedData.itemId
    );

    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found in cart' },
        { status: 404 }
      );
    }

    carts[userId].splice(itemIndex, 1);

    return NextResponse.json({
      message: 'Item removed from cart successfully',
      itemId: validatedData.itemId,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues }, // Use error.issues
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error removing cart item:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to remove item from cart', details: errorMessage },
      { status: 500 }
    );
  }
}

// Future implementation notes:
// - Session management for user carts (using NextAuth.js or similar)
// - Database integration patterns (Prisma, Drizzle, or raw SQL)
// - Cart persistence strategies:
//   * Guest carts: Store in localStorage/cookies with optional merge on login
//   * User carts: Store in database with user ID association
//   * Hybrid approach: localStorage for guests, database for authenticated users
// - Security considerations:
//   * Validate user ownership of cart items
//   * Sanitize input data
//   * Rate limiting to prevent abuse
// - Performance optimizations:
//   * Cache frequently accessed cart data
//   * Batch operations for multiple item updates
//   * Implement optimistic updates on the frontend

// Example future database integration:
// import { db } from '@/lib/database';
// import { getServerSession } from 'next-auth';
// 
// export async function GET() {
//   const session = await getServerSession();
//   if (!session?.user?.id) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }
//   
//   try {
//     const cartItems = await db.cartItem.findMany({
//       where: { userId: session.user.id },
//       include: { book: true }
//     });
//     
//     return NextResponse.json(cartItems);
//   } catch (error) {
//     return NextResponse.json(
//       { error: 'Failed to fetch cart items' },
//       { status: 500 }
//     );
//   }
// }