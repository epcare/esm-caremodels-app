import Ajv from 'ajv/dist/2020';
import definitionSchema from './schemas/model-definition.schema.json';
import dataSourceSchema from './schemas/data-source.schema.json';
import ruleSchema from './schemas/rule-expression.schema.json';
import formSchema from './schemas/form-ref.schema.json';
import actionSchema from './schemas/action.schema.json';
import { parseTree, findNodeAtLocation, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { widgetPropertyErrors } from '../../../widgets/widget-properties';
import type { ModelDefinition } from '../../../types/caremodels';

// Exact copies of the module's schemas. Backend semantic/resource validation is still required.
const ajv = new Ajv({ allErrors: true, strict: false });
for (const schema of [dataSourceSchema, ruleSchema, formSchema, actionSchema]) ajv.addSchema(schema);
const validate = ajv.compile<ModelDefinition>(definitionSchema);
export function parseDefinitionJson(text: string): { definition?: ModelDefinition; errors: Array<string> } {
  const syntaxErrors: Array<ParseError> = [];
  const tree = parseTree(text, syntaxErrors, { disallowComments: true, allowTrailingComma: false });
  const location = (offset: number) => {
    const lines = text.slice(0, offset).split('\n');
    return `line ${lines.length}, column ${lines[lines.length - 1].length + 1}`;
  };
  if (syntaxErrors.length || !tree)
    return {
      errors: syntaxErrors.length
        ? syntaxErrors.map((error) => `${location(error.offset)}: ${printParseErrorCode(error.error)}`)
        : ['line 1, column 1: JSON document is required'],
    };
  const value: unknown = JSON.parse(text);
  if (validate(value)) {
    const errors = value.workspace.tabs.flatMap((tab, tabIndex) =>
      tab.widgets.flatMap((widget, widgetIndex) => {
        const node =
          findNodeAtLocation(tree, ['workspace', 'tabs', tabIndex, 'widgets', widgetIndex, 'properties']) ?? tree;
        return widgetPropertyErrors(widget).map(
          (error) =>
            `/workspace/tabs/${tabIndex}/widgets/${widgetIndex}/properties (${location(node.offset)}): ${error}`,
        );
      }),
    );
    return errors.length ? { errors } : { definition: value, errors: [] };
  }
  return {
    errors: (validate.errors ?? []).map((error) => {
      const path = error.instancePath
        .split('/')
        .slice(1)
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
        .map((part) => (/^(0|[1-9]\d*)$/.test(part) ? Number(part) : part));
      const node = findNodeAtLocation(tree, path) ?? tree;
      return `${error.instancePath || '/'} (${location(node.offset)}): ${error.message}`;
    }),
  };
}
