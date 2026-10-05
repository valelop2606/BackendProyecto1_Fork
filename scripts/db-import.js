// Importa los archivos de database/*.json a la base indicada en MONGODB_URI
// Uso: npm run db:import          (reemplaza el contenido de cada coleccion)
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const fs = require('fs');
const path = require('path');

const IN_DIR = path.join(__dirname, '..', 'database');

(async () => {
  const files = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) throw new Error('No hay archivos .json en ' + IN_DIR);

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();

  for (const file of files) {
    const name = path.basename(file, '.json');
    const docs = EJSON.parse(fs.readFileSync(path.join(IN_DIR, file), 'utf8'));
    await db.collection(name).deleteMany({});
    // Insercion no ordenada: un duplicado se reporta y se omite sin abortar la siembra
    if (docs.length > 0) {
      try {
        await db.collection(name).insertMany(docs, { ordered: false });
      } catch (e) {
        const skipped = e.writeErrors?.length ?? 0;
        console.error(name.padEnd(12), 'duplicados omitidos:', skipped, '-', e.message);
      }
    }
    const total = await db.collection(name).countDocuments();
    console.log(name.padEnd(12), total, 'documentos importados');
  }
  await client.close();
  console.log('Importacion terminada en la base:', db.databaseName);
})().catch((e) => { console.error(e.message); process.exit(1); });
