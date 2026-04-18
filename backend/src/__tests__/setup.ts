// Provide required env vars so env.ts doesn't call process.exit during tests.
process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.JWT_SECRET = "test_secret_that_is_at_least_32_characters_long_xx";
