const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zonas_aforo';
  await mongoose.connect(uri);
  const hash = await bcrypt.hash('123456', 10);
  const result = await mongoose.connection.db.collection('edificios').updateOne(
    { email: 'juanskate326@gmail.com' },
    {
      $set: {
        nombre: 'Edificio Residencial Parque Central',
        email: 'juanskate326@gmail.com',
        password: hash,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log('USER SEEDED SUCCESSFULLY', result);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
