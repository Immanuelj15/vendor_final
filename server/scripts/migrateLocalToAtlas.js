import { MongoClient } from 'mongodb';

const LOCAL_URI = 'mongodb://127.0.0.1:27017/fairkart';
const ATLAS_URI = 'mongodb+srv://baapoomartsales_db_user:SkzWn1KSc0HiDMYU@cluster0.hmbpno5.mongodb.net/baapoomart?retryWrites=true&w=majority';

async function migrateData() {
  console.log('====================================================');
  console.log('  MONGODB LOCAL TO ATLAS DATA MIGRATION');
  console.log('====================================================\n');

  console.log('1. Connecting to Local MongoDB...');
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db('fairkart');
  console.log('   ✅ Connected to Local MongoDB.');

  console.log('\n2. Connecting to MongoDB Atlas...');
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db('baapoomart');
  console.log('   ✅ Connected to MongoDB Atlas.\n');

  console.log('3. Fetching collections from Local MongoDB...');
  const collections = await localDb.listCollections().toArray();
  console.log(`   Found ${collections.length} collections.\n`);

  let totalMigratedDocs = 0;
  let migratedCollections = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;
    // Skip internal system collections
    if (colName.startsWith('system.')) continue;

    const localCol = localDb.collection(colName);
    const count = await localCol.countDocuments();

    if (count === 0) {
      // Still ensure collection exists in Atlas
      await atlasDb.createCollection(colName).catch(() => {});
      continue;
    }

    console.log(`➡️  Migrating collection [${colName}] (${count} documents)...`);
    const atlasCol = atlasDb.collection(colName);

    // Fetch documents
    const cursor = localCol.find({});
    const batchSize = 500;
    let batch = [];
    let colDocs = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length >= batchSize) {
        try {
          await atlasCol.insertMany(batch, { ordered: false });
        } catch (err) {
          // If duplicate key error on re-run, ignore duplicates
          if (err.code !== 11000 && !err.writeErrors?.every(e => e.code === 11000)) {
            console.warn(`   ⚠️ Warning during batch insert in ${colName}:`, err.message);
          }
        }
        colDocs += batch.length;
        totalMigratedDocs += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      try {
        await atlasCol.insertMany(batch, { ordered: false });
      } catch (err) {
        if (err.code !== 11000 && !err.writeErrors?.every(e => e.code === 11000)) {
          console.warn(`   ⚠️ Warning during final batch insert in ${colName}:`, err.message);
        }
      }
      colDocs += batch.length;
      totalMigratedDocs += batch.length;
    }

    // Copy indexes
    try {
      const indexes = await localCol.indexes();
      for (const idx of indexes) {
        if (idx.name === '_id_') continue;
        const key = idx.key;
        const options = {
          name: idx.name,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
        };
        if (idx.expireAfterSeconds !== undefined) {
          options.expireAfterSeconds = idx.expireAfterSeconds;
        }
        await atlasCol.createIndex(key, options).catch(() => {});
      }
    } catch {
      // Non-critical if index fails
    }

    const atlasCount = await atlasCol.countDocuments();
    console.log(`   ✅ Migrated [${colName}]: Local ${count} ➔ Atlas ${atlasCount}`);
    migratedCollections++;
  }

  console.log('\n====================================================');
  console.log(` MIGRATION COMPLETE!`);
  console.log(` Collections with data migrated: ${migratedCollections}`);
  console.log(` Total documents transferred: ${totalMigratedDocs}`);
  console.log('====================================================\n');

  await localClient.close();
  await atlasClient.close();
}

migrateData().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
