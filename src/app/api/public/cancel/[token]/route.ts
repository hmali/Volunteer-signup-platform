import { NextRequest, NextResponse } from 'next/server';
import { cancelSignup, SignupError } from '@/lib/signup';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Cancel signup
    const signup = await cancelSignup(token);

    return NextResponse.json({
      message: 'Your signup has been cancelled successfully.',
      signup: {
        id: signup.id,
        name: signup.name,
        date: signup.slot.day.date.toISOString().substring(0, 10),
        sevaName: signup.slot.sevaType.name,
        status: signup.status,
        cancelledAt: signup.cancelledAt?.toISOString(),
      },
    });

  } catch (error) {
    console.error('[API] Cancel error:', error);

    if (error instanceof SignupError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to cancel signup' },
      { status: 500 }
    );
  }
}
