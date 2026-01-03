import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <Link href="/" className="text-white hover:text-blue-200">
              ← Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Note:</strong> Admin authentication (AWS Cognito) is not yet implemented in this demo. In production, all routes under /admin would be protected.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Events</h3>
              <p className="text-3xl font-bold text-blue-600">1</p>
              <p className="text-sm text-gray-500 mt-2">Active events</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Signups</h3>
              <p className="text-3xl font-bold text-green-600">4</p>
              <p className="text-sm text-gray-500 mt-2">Confirmed volunteers</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Fill Rate</h3>
              <p className="text-3xl font-bold text-purple-600">18%</p>
              <p className="text-sm text-gray-500 mt-2">Average capacity</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <a href="/api/admin/events" className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors">
                  📋 View All Events (API)
                </a>
                <a href="/api/admin/events/sample-event-id/sevas" className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors">
                  🙏 Manage Sevas (API)
                </a>
                <a href="/api/admin/events/sample-event-id/roster?month=2026-01" className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors">
                  📊 View Roster (API)
                </a>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">API Endpoints</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">POST /api/admin/events</code>
                  <span className="text-gray-600 ml-2">Create event</span>
                </div>
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">POST /api/admin/events/:id/sevas</code>
                  <span className="text-gray-600 ml-2">Create seva</span>
                </div>
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">POST /api/admin/events/:id/generate-schedule</code>
                  <span className="text-gray-600 ml-2">Generate month</span>
                </div>
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">GET /api/admin/events/:id/roster</code>
                  <span className="text-gray-600 ml-2">View roster</span>
                </div>
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">PATCH /api/admin/days/:id</code>
                  <span className="text-gray-600 ml-2">Close day</span>
                </div>
                <div className="flex items-start">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs flex-1">PATCH /api/admin/slots/:id</code>
                  <span className="text-gray-600 ml-2">Update capacity</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <a href="/API.md" target="_blank" className="text-blue-600 hover:text-blue-800 text-sm underline">
                  → View Full API Documentation
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sample Workflow</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700">
              <li>
                <strong>Create Event:</strong> POST to <code className="bg-gray-100 px-2 py-1 rounded text-xs">/api/admin/events</code>
                <pre className="bg-gray-50 p-3 rounded mt-2 text-xs overflow-x-auto">
{`{
  "name": "Temple Volunteering - February 2026",
  "startDate": "2026-02-01",
  "endDate": "2026-02-28",
  "timezone": "America/New_York",
  "shiftLabel": "6:30 PM – 8:30 PM"
}`}
                </pre>
              </li>
              <li>
                <strong>Define Sevas:</strong> POST to <code className="bg-gray-100 px-2 py-1 rounded text-xs">/api/admin/events/:eventId/sevas</code>
                <pre className="bg-gray-50 p-3 rounded mt-2 text-xs overflow-x-auto">
{`{
  "name": "Kitchen Seva",
  "description": "Help prepare prasad",
  "defaultCapacity": 4,
  "icon": "🍽️",
  "color": "#3B82F6"
}`}
                </pre>
              </li>
              <li>
                <strong>Generate Schedule:</strong> POST to <code className="bg-gray-100 px-2 py-1 rounded text-xs">/api/admin/events/:eventId/generate-schedule?month=2026-02</code>
                <p className="text-sm text-gray-600 mt-1">This creates Day and Slot records for the entire month (excluding Thu/Fri)</p>
              </li>
              <li>
                <strong>Share Link:</strong> Copy the <code className="bg-gray-100 px-2 py-1 rounded text-xs">publicId</code> from step 1
                <p className="text-sm text-gray-600 mt-1">Public URL: <code className="bg-gray-100 px-2 py-1 rounded text-xs">https://yourdomain.com/signup/{publicId}</code></p>
              </li>
              <li>
                <strong>Monitor:</strong> View roster, export CSV, check Google Sheets sync status
              </li>
            </ol>
          </div>

          <div className="mt-8 text-center text-gray-600">
            <p>For full UI implementation, see the <a href="/ARCHITECTURE.md" className="text-blue-600 hover:underline">Architecture</a> and <a href="/DEPLOYMENT.md" className="text-blue-600 hover:underline">Deployment</a> documentation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
