// Usage (from the server/ folder):
//   node scripts/testUser.js             -> runs the checks and leaves the test user in Atlas
//   node scripts/testUser.js --cleanup   -> runs the checks, then deletes the test user
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

const TEST_EMAIL = 'test.user@educore.local';
const PLAIN_PASSWORD = 'Passw0rd!123';
const NEW_PASSWORD = 'NewPassw0rd!456';
const cleanup = process.argv.includes('--cleanup');

let failures = 0;
const section = (title) => console.log(`\n=== ${title} ===`);
const check = (label, passed) => {
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`);
};

async function run() {
  await connectDB();
  await User.init(); // make sure the unique email index exists before testing duplicates
  await User.deleteOne({ email: TEST_EMAIL });

  // 1. Create the user with a plain-text password
  await User.create({ name: 'Test User', email: TEST_EMAIL, password: PLAIN_PASSWORD });
  console.log(`Created user. Plain-text password used: "${PLAIN_PASSWORD}"`);

  // 2. Raw document exactly as stored in MongoDB (native driver, bypasses Mongoose)
  section('1. Raw stored document');
  const raw = await User.collection.findOne({ email: TEST_EMAIL });
  console.log(raw);
  check('stored password is not the plain-text password', raw.password !== PLAIN_PASSWORD);
  check('stored password looks like a bcrypt hash (starts with $2, 60 chars)',
    /^\$2[aby]\$/.test(raw.password) && raw.password.length === 60);
  check('role defaulted to "student"', raw.role === 'student');
  check('email stored lowercase and trimmed', raw.email === TEST_EMAIL);

  // 3. Default queries must hide the hash
  section('2. Default query hides the password');
  const hidden = await User.findOne({ email: TEST_EMAIL });
  console.log(hidden.toJSON());
  check('password is undefined on a normal query', hidden.password === undefined);

  // 4. comparePassword
  section('3. comparePassword');
  const withPassword = await User.findOne({ email: TEST_EMAIL }).select('+password');
  check('correct password matches', (await withPassword.comparePassword(PLAIN_PASSWORD)) === true);
  check('wrong password does not match', (await withPassword.comparePassword('wrong-password')) === false);

  // 5. Hook must not re-hash when the password was not modified
  section('4. Hook only re-hashes when password changes');
  const hashBefore = withPassword.password;
  withPassword.name = 'Renamed User';
  await withPassword.save();
  const afterRename = await User.findOne({ email: TEST_EMAIL }).select('+password');
  check('hash unchanged after saving a different field', afterRename.password === hashBefore);
  check('old password still works', (await afterRename.comparePassword(PLAIN_PASSWORD)) === true);

  afterRename.password = NEW_PASSWORD;
  await afterRename.save();
  const afterChange = await User.findOne({ email: TEST_EMAIL }).select('+password');
  check('hash changed after setting a new password', afterChange.password !== hashBefore);
  check('new password works', (await afterChange.comparePassword(NEW_PASSWORD)) === true);
  check('old password no longer works', (await afterChange.comparePassword(PLAIN_PASSWORD)) === false);

  // 6. Validation and uniqueness
  section('5. Validation and unique email');
  try {
    await User.create({ name: 'Dup', email: TEST_EMAIL, password: PLAIN_PASSWORD });
    check('duplicate email is rejected', false);
  } catch (err) {
    check('duplicate email is rejected (Mongo code 11000)', err.code === 11000);
  }
  try {
    await User.create({ name: 'Short', email: 'short@educore.local', password: '123' });
    check('short password is rejected', false);
  } catch (err) {
    check('short password is rejected before hashing (ValidationError)', err.name === 'ValidationError');
  }
  try {
    await User.create({ name: 'Bad Role', email: 'role@educore.local', password: PLAIN_PASSWORD, role: 'admin' });
    check('invalid role is rejected', false);
  } catch (err) {
    check('invalid role "admin" is rejected', err.name === 'ValidationError');
  }

  if (cleanup) {
    await User.deleteOne({ email: TEST_EMAIL });
    console.log(`\nTest user deleted (--cleanup).`);
  } else {
    console.log(`\nTest user left in Atlas: ${TEST_EMAIL} (open Browse Collections -> educore -> users).`);
    console.log(`Its current password is "${NEW_PASSWORD}". Run with --cleanup to delete it.`);
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
}

run()
  .catch((err) => {
    console.error('Script error:', err);
    failures += 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
