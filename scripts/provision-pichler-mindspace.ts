/**
 * Pichler-Mindspace Brain Provisioning
 *
 * Creates Qdrant collection 'pichler-mindspace' and verifies brain API health.
 * Idempotent — safe to run multiple times.
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';

async function provision() {
  console.log('=== Pichler-Mindspace Brain Provisioning ===');

  // 1. Verify brain API health
  console.log('\n1. Checking brain API health...');
  try {
    const healthRes = await fetch(`${BRAIN_API_URL}/api/v1/health`);
    if (healthRes.ok) {
      console.log('   Brain API: healthy');
    } else {
      console.warn(`   Brain API health check returned ${healthRes.status}`);
    }
  } catch (err) {
    console.warn('   Brain API unreachable — continuing with Qdrant setup');
  }

  // 2. Create pichler-mindspace collection in Qdrant
  console.log('\n2. Creating pichler-mindspace collection...');
  try {
    const createRes = await fetch(`${QDRANT_URL}/collections/pichler-mindspace`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: 1536,
          distance: 'Cosine'
        }
      })
    });

    if (createRes.ok) {
      console.log('   Collection created successfully');
    } else {
      const body = await createRes.json().catch(() => ({}));
      // Already exists is fine (idempotent)
      if (createRes.status === 409 || JSON.stringify(body).includes('already exists')) {
        console.log('   Collection already exists (idempotent — OK)');
      } else {
        console.warn(`   Qdrant returned ${createRes.status}: ${JSON.stringify(body)}`);
      }
    }
  } catch (err) {
    console.error(`   Failed to create collection: ${err}`);
  }

  // 3. Verify collection exists
  console.log('\n3. Verifying collection...');
  try {
    const verifyRes = await fetch(`${QDRANT_URL}/collections/pichler-mindspace`);
    if (verifyRes.ok) {
      const info = await verifyRes.json() as any;
      console.log(`   Collection verified: ${info.result?.status || 'exists'}`);
    } else {
      console.error('   Collection verification failed');
    }
  } catch (err) {
    console.error(`   Verification error: ${err}`);
  }

  console.log('\n=== Provisioning complete ===');
}

provision().catch(console.error);
