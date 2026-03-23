/**
 * SpiceDB client wrapper — dual-write with feature flag
 * Uses @authzed/authzed-node for gRPC communication with SpiceDB
 */

const SPICEDB_ENABLED = process.env.SPICEDB_ENABLED === 'true';
const SPICEDB_ENDPOINT = process.env.SPICEDB_ENDPOINT || 'localhost:50051';
const SPICEDB_TOKEN = process.env.SPICEDB_PRESHARED_KEY || 'xpollination-dev-key';

/**
 * Create a SpiceDB client instance
 */
export function createClient() {
  if (!SPICEDB_ENABLED) {
    return createNoopClient();
  }

  // Dynamic import to avoid requiring @authzed/authzed-node when disabled
  let v1;
  try {
    const authzed = await import('@authzed/authzed-node');
    v1 = authzed.v1;
  } catch (err) {
    console.warn('SpiceDB client: @authzed/authzed-node not available, using noop client');
    return createNoopClient();
  }

  const client = v1.NewClient(SPICEDB_TOKEN, SPICEDB_ENDPOINT, v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);

  return {
    async checkPermission(resourceType, resourceId, permission, subjectType, subjectId) {
      const response = await client.checkPermission(
        v1.CheckPermissionRequest.create({
          resource: v1.ObjectReference.create({ objectType: resourceType, objectId: resourceId }),
          permission,
          subject: v1.SubjectReference.create({
            object: v1.ObjectReference.create({ objectType: subjectType, objectId: subjectId })
          })
        })
      );
      return response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
    },

    async writeRelationship(resourceType, resourceId, relation, subjectType, subjectId) {
      await client.writeRelationships(
        v1.WriteRelationshipsRequest.create({
          updates: [
            v1.RelationshipUpdate.create({
              operation: v1.RelationshipUpdate_Operation.TOUCH,
              relationship: v1.Relationship.create({
                resource: v1.ObjectReference.create({ objectType: resourceType, objectId: resourceId }),
                relation,
                subject: v1.SubjectReference.create({
                  object: v1.ObjectReference.create({ objectType: subjectType, objectId: subjectId })
                })
              })
            })
          ]
        })
      );
    }
  };
}

/**
 * Noop client when SpiceDB is disabled — allows graceful fallback
 */
function createNoopClient() {
  return {
    async checkPermission() { return true; },
    async writeRelationship() { /* noop */ }
  };
}

export { SPICEDB_ENABLED };
