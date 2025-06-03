/**
 * Jest setup file
 */

// Global test setup
beforeEach(() => {
  // Clear any environment-specific setup before each test
  jest.clearAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
