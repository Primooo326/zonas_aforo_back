export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  mongodb: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '7d',
  },
});
