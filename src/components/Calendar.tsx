'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  isClosed: boolean;
  notes?: string;
  filledSlots: number;
  availableSlots: number;
  slots: SlotInfo[];
}

interface SlotInfo {
  id: string;
  sevaName: string;
  capacity: number;
  filledCount: number;
  status: 'AVAILABLE' | 'FULL';
}

interface CalendarProps {
  eventName: string;
  publicId: string;
  timezone: string;
  onSlotSelect: (slotId: string, date: string, sevaName: string) => void;
}

export default function Calendar({ eventName, publicId, timezone, onSlotSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/events/${publicId}/calendar?month=${month}`);
      if (!response.ok) throw new Error('Failed to load calendar');
      const data = await response.json();
      setDays(data.days || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
    fetchCalendar(newMonth);
  };

  // Load initial calendar
  useState(() => {
    fetchCalendar(currentMonth);
  });

  const monthName = new Date(currentMonth + '-01').toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const openDays = days.filter(d => !d.isClosed);
  const totalCapacity = openDays.reduce((sum, d) => sum + d.slots.reduce((s, slot) => s + slot.capacity, 0), 0);
  const totalFilled = openDays.reduce((sum, d) => sum + d.filledSlots, 0);

  return (
    <div className="space-y-6">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6">
          <p className="text-blue-100 text-sm font-medium mb-1">Total Spots</p>
          <p className="text-4xl font-bold">{totalCapacity}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6">
          <p className="text-green-100 text-sm font-medium mb-1">Filled</p>
          <p className="text-4xl font-bold">{totalFilled}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
          <p className="text-purple-100 text-sm font-medium mb-1">Available</p>
          <p className="text-4xl font-bold">{totalCapacity - totalFilled}</p>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => handleMonthChange('prev')}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>
          
          <button
            onClick={() => handleMonthChange('next')}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => fetchCalendar(currentMonth)}
              className="mt-2 text-red-600 hover:text-red-800 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Calendar Days */}
        {!loading && !error && (
          <div className="space-y-3">
            {days.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No volunteer opportunities this month</p>
            ) : (
              days.map((day) => (
                <DayCard
                  key={day.date}
                  day={day}
                  onSlotSelect={onSlotSelect}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({ day, onSlotSelect }: { day: CalendarDay; onSlotSelect: (slotId: string, date: string, sevaName: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  
  const dateObj = new Date(day.date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });

  if (day.isClosed) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{formattedDate}</h3>
            {day.notes && <p className="text-sm text-gray-600 mt-1">{day.notes}</p>}
          </div>
          <span className="inline-block bg-gray-400 text-white px-4 py-1.5 rounded-full text-sm font-medium">
            Closed
          </span>
        </div>
      </div>
    );
  }

  const isFull = day.availableSlots === 0;
  
  return (
    <div 
      className={`border rounded-lg overflow-hidden transition-all ${
        isFull 
          ? 'border-red-300 bg-red-50' 
          : 'border-green-300 bg-green-50 hover:shadow-md'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{formattedDate}</h3>
            {day.notes && <p className="text-sm text-gray-600 mt-1">{day.notes}</p>}
          </div>
          <div className="flex items-center gap-3">
            {isFull ? (
              <span className="inline-block bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                Full
              </span>
            ) : (
              <span className="inline-block bg-green-500 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                {day.availableSlots} {day.availableSlots === 1 ? 'spot' : 'spots'} left
              </span>
            )}
            <ChevronRight 
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} 
            />
          </div>
        </div>
      </button>

      {expanded && day.slots.length > 0 && (
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3">
          {day.slots.map((slot) => (
            <div 
              key={slot.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{slot.sevaName}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {slot.filledCount}/{slot.capacity} filled
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  slot.status === 'FULL' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {slot.status === 'FULL' ? 'FULL' : `${slot.capacity - slot.filledCount} left`}
                </span>
              </div>
              
              {slot.status !== 'FULL' && (
                <button
                  onClick={() => onSlotSelect(slot.id, day.date, slot.sevaName)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Sign Up
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
