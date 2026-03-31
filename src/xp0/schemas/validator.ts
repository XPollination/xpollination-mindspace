import AjvModule, { type ErrorObject } from 'ajv';
const Ajv = AjvModule.default || AjvModule;

const ajv = new Ajv({ allErrors: true, validateSchema: false });

export function validateAgainstSchema(
  content: Record<string, unknown>,
  schema: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const validate = ajv.compile(schema);
  const valid = validate(content) as boolean;

  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors || []).map((err: ErrorObject) => {
    const path = err.instancePath || '';
    if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
      return `${path}/${err.params.missingProperty}: ${err.message}`;
    }
    return `${path}: ${err.message}`;
  });

  return { valid: false, errors };
}
