'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Calendar from '@/components/Calendar';
import SignupModal from '@/components/SignupModal';

export default function PublicSignupPage() {
  const params = useParams();
  const publicId = params?.publicId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    slotId: string;
    date: string;
    sevaName: string;
  } | null>(null);

  useEffect(() => {
    if (publicId) {
      fetchEventInfo();
    }
  }, [publicId]);

  const fetchEventInfo = async () => {
    try {
      // Fetch basic event info for header
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const response = await fetch(`/api/public/events/${publicId}/calendar?month=${month}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const data = await response.json();
      setEvent(data.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slotId: string, date: string, sevaName: string) => {
    setSelectedSlot({ slotId, date, sevaName });
  };

  const handleCloseModal = () => {
    setSelectedSlot(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <div className="text-red-600 text-5xl mb-4 text-center">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Event Not Found</h2>
          <p className="text-gray-600 mb-6 text-center">{error}</p>
          <Link href="/" className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Link href="/" className="text-white hover:text-blue-200 text-sm mb-4 inline-block transition-colors">
              ← Back to Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.name}</h1>
            <p className="text-blue-100 text-lg">{event.shiftLabel}</p>
            <div className="flex items-center gap-4 mt-3 text-blue-200 text-sm">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.timezone}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Thu & Fri excluded
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Important Notice */}
          <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Volunteering is not available on Thursdays and Fridays per temple policy. 
                  After signing up, you'll receive a confirmation email with a calendar invite and cancellation link.
                </p>
              </div>
            </div>
          </div>

          {/* Calendar Component */}
          <Calendar
            eventName={event.name}
            publicId={publicId}
            timezone={event.timezone}
            onSlotSelect={handleSlotSelect}
          />

          {/* API Demo */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🔌 Developer API Integration
            </h3>
            <p className="text-gray-600 mb-4">
              This page demonstrates the public API. Integrate this signup system into your own application:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg text-sm font-mono overflow-x-auto space-y-2">
              <p className="text-gray-700">
                <span className="text-green-600">GET</span> /api/public/events/<span className="text-blue-600">{publicId}</span>/calendar?month=2026-01
              </p>
              <p className="text-gray-700">
                <span className="text-green-600">GET</span> /api/public/events/<span className="text-blue-600">{publicId}</span>/days/2026-01-15/slots
              </p>
              <p className="text-gray-700">
                <span className="text-orange-600">POST</span> /api/public/slots/<span className="text-blue-600">{'{slotId}'}</span>/signup
              </p>
              <p className="text-gray-700">
                <span className="text-green-600">GET</span> /api/public/signups/<span className="text-blue-600">{'{signupId}'}</span>/calendar.ics
              </p>
              <p className="text-gray-700">
                <span className="text-red-600">DELETE</span> /api/public/cancel/<span className="text-blue-600">{'{token}'}</span>
              </p>
            </div>
            <Link
              href="/API.md"
              target="_blank"
              className="inline-block mt-4 text-blue-600 hover:text-blue-800 underline text-sm font-medium transition-colors"
            >
              → View Full API Documentation
            </Link>
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      {selectedSlot && (
        <SignupModal
          isOpen={true}
          onClose={handleCloseModal}
          slotId={selectedSlot.slotId}
          date={selectedSlot.date}
          sevaName={selectedSlot.sevaName}
          eventName={event.name}
        />
      )}
    </div>
  );
}
