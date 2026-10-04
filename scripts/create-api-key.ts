/**
 * Creates an ArthaBench API key.
 *
 *   npx tsx scripts/create-api-key.ts
 *
 * Prints the key (give it to the user; it is not stored anywhere) and its SHA-256 hash. Append the hash to
 * API_V1_KEY_HASHES (comma-separated) in the server environment, then redeploy.
 */
import { newApiKey } from '../server/v1/auth';

const { key, hash } = newApiKey();
console.log(`API key (share once, store securely): ${key}`);
console.log(`Hash for API_V1_KEY_HASHES:           ${hash}`);
