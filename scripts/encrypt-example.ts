#!/usr/bin/env npx ts-node

import { createEncryptedToken } from './encrypt-token';

// Get the argument from command line
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Please provide a string to encrypt');
  console.log('Usage: npx ts-node scripts/encrypt-example.ts "your-secret-string"');
  process.exit(1);
}

const plainText = args[0];
const encryptedToken = createEncryptedToken(plainText);

console.log(`Original text: ${plainText}`);
console.log(`Encrypted token: ${encryptedToken}`);
