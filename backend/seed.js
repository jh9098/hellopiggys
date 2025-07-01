import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync(process.env.SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const data = JSON.parse(fs.readFileSync('./dummyData.json', 'utf8'));
async function run() {
  for (const review of data.reviews) {
    await db.collection('reviews').add(review);
    console.log('Added review:', review.title);
  }
  console.log('Seed completed');
  process.exit(0);
}

run();