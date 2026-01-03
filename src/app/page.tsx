import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            🙏 Volunteer Signup Platform
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            Production-ready volunteer sign-up system for recurring temple and event volunteering
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Link 
              href="/admin"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-8 rounded-lg shadow-lg transition-colors"
            >
              <div className="text-3xl mb-2">👨‍💼</div>
              <div className="text-xl mb-2">Admin Dashboard</div>
              <div className="text-sm opacity-90">Manage events, sevas, and rosters</div>
            </Link>
            
            <Link 
              href="/signup/sample-event-2026-01"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6 px-8 rounded-lg shadow-lg transition-colors"
            >
              <div className="text-3xl mb-2">📅</div>
              <div className="text-xl mb-2">Public Signup</div>
              <div className="text-sm opacity-90">View sample volunteer calendar</div>
            </Link>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-8 text-left">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Features</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Calendar-based monthly scheduling (auto-excludes Thu/Fri)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Admin-defined seva types (NOT hard-coded)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Race-safe capacity enforcement with DB locking</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Email confirmations via AWS SES</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Add-to-calendar (ICS download + Google Calendar)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Secure cancellation via tokenized links</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>S3 JSON mirror for every signup (durable backup)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Google Sheets auto-sync (async via SQS worker)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Background worker with retry + exponential backoff</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Docker deployment with Nginx + HTTPS</span>
              </li>
            </ul>
          </div>
          
          <div className="mt-12 text-gray-600">
            <p className="mb-2">
              <strong>Tech Stack:</strong> Next.js 14, TypeScript, Prisma, PostgreSQL, AWS (S3, SQS, SES), Google Sheets API
            </p>
            <p>
              <strong>Deployment:</strong> AWS EC2 + Docker + Nginx + Let's Encrypt
            </p>
          </div>
          
          <div className="mt-8 flex gap-4 justify-center">
            <a 
              href="https://github.com/yourusername/volunteer-signup-platform" 
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              📚 Documentation
            </a>
            <a 
              href="/api/health" 
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              ❤️ Health Check
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
