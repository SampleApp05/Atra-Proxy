import * as crypto from 'crypto';

/**
 * Encrypt Token Utility
 * 
 * Provides AES-256-GCM encryption functionality for creating secure tokens.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Generate a random encryption key
 */
function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Encrypt text using AES-256-GCM with the provided key
 */
function encrypt(text: string, key: Buffer): { encrypted: string, iv: string, tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from('atra-proxy-auth', 'utf8'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Create an encrypted token from plain text
 * Returns a base64-encoded token containing all necessary decryption data
 */
function createEncryptedToken(plainText: string): string {
  const key = generateKey();
  const { encrypted, iv, tag } = encrypt(plainText, key);
  
  // Combine key, iv, tag, and encrypted data into a single token
  const tokenData = {
    key: key.toString('hex'),
    iv,
    tag,
    encrypted
  };
  
  // Base64 encode the JSON for easy storage
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

export { generateKey, encrypt, createEncryptedToken };

// CLI functionality - only runs when script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Please provide a string to encrypt');
    console.log('Usage: npx ts-node scripts/encrypt-token.ts "your-secret-string"');
    process.exit(1);
  }
  
  const plainText = args[0];
  const encryptedToken = createEncryptedToken(plainText);
  
  console.log(`Original text: ${plainText}`);
  console.log(`Encrypted token: ${encryptedToken}`);
}
