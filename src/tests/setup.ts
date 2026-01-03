// Test setup file
// Configure test environment before running tests

beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/volunteer_signup_test';
  process.env.DISABLE_EMAIL_SENDING = 'true';
  process.env.DISABLE_SHEETS_SYNC = 'true';
});

afterAll(() => {
  // Cleanup
});
