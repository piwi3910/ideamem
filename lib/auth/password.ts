import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const iterations = 10000;
  const keyLength = 64;
  
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else {
        // Format: algorithm$iterations$salt$hash
        resolve(`pbkdf2$${iterations}$${salt}$${derivedKey.toString('hex')}`);
      }
    });
  });
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, iterationsStr, salt, hashValue] = hash.split('$');
  
  if (algorithm !== 'pbkdf2') {
    throw new Error('Unsupported hash algorithm');
  }
  
  const iterations = parseInt(iterationsStr, 10);
  const keyLength = Buffer.from(hashValue, 'hex').length;
  
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else {
        const hashBuffer = Buffer.from(hashValue, 'hex');
        resolve(timingSafeEqual(hashBuffer, derivedKey));
      }
    });
  });
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}