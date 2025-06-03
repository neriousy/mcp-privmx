/**
 * Content Validator
 * Validates parsed content from JSON and MDX parsers
 */

import type {
  ParsedContent,
  ChunkMetadata,
  CodeExample,
  Parameter,
  ReturnValue,
  Workflow,
  WorkflowStep,
  DocumentChunk,
} from '@privmx/shared';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export class ContentValidator {
  /**
   * Validate ParsedContent array
   */
  validateParsedContent(content: ParsedContent[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(content)) {
      result.errors.push({
        field: 'content',
        message: 'Content must be an array',
        severity: 'critical',
      });
      result.isValid = false;
      return result;
    }

    content.forEach((item, index) => {
      const itemResult = this.validateSingleContent(item, index);
      result.errors.push(...itemResult.errors);
      result.warnings.push(...itemResult.warnings);
      if (!itemResult.isValid) {
        result.isValid = false;
      }
    });

    return result;
  }

  /**
   * Validate single ParsedContent item
   */
  validateSingleContent(
    content: ParsedContent,
    index?: number
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const prefix = index !== undefined ? `[${index}]` : '';

    // Required fields validation
    if (!content.name || typeof content.name !== 'string') {
      result.errors.push({
        field: `${prefix}.name`,
        message: 'Name is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!content.type || !this.isValidContentType(content.type)) {
      result.errors.push({
        field: `${prefix}.type`,
        message: 'Type must be one of: method, class, type, example',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!content.description || typeof content.description !== 'string') {
      result.errors.push({
        field: `${prefix}.description`,
        message: 'Description is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!content.content || typeof content.content !== 'string') {
      result.errors.push({
        field: `${prefix}.content`,
        message: 'Content is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    // Content quality validation
    if (content.name && content.name.length < 2) {
      result.warnings.push({
        field: `${prefix}.name`,
        message: 'Name is too short',
        suggestion: 'Names should be at least 2 characters long',
      });
    }

    if (content.description && content.description.length < 10) {
      result.warnings.push({
        field: `${prefix}.description`,
        message: 'Description is very short',
        suggestion: 'Consider adding more descriptive information',
      });
    }

    if (content.content && content.content.length < 20) {
      result.warnings.push({
        field: `${prefix}.content`,
        message: 'Content is very short',
        suggestion: 'Content should provide substantial information',
      });
    }

    // Validate metadata
    if (!content.metadata) {
      result.errors.push({
        field: `${prefix}.metadata`,
        message: 'Metadata is required',
        severity: 'critical',
      });
      result.isValid = false;
    } else {
      const metadataResult = this.validateMetadata(
        content.metadata,
        `${prefix}.metadata`
      );
      result.errors.push(...metadataResult.errors);
      result.warnings.push(...metadataResult.warnings);
      if (!metadataResult.isValid) {
        result.isValid = false;
      }
    }

    // Validate optional fields
    if (content.examples) {
      const examplesResult = this.validateExamples(
        content.examples,
        `${prefix}.examples`
      );
      result.errors.push(...examplesResult.errors);
      result.warnings.push(...examplesResult.warnings);
      if (!examplesResult.isValid) {
        result.isValid = false;
      }
    }

    if (content.parameters) {
      const paramsResult = this.validateParameters(
        content.parameters,
        `${prefix}.parameters`
      );
      result.errors.push(...paramsResult.errors);
      result.warnings.push(...paramsResult.warnings);
      if (!paramsResult.isValid) {
        result.isValid = false;
      }
    }

    if (content.returns) {
      const returnsResult = this.validateReturns(
        content.returns,
        `${prefix}.returns`
      );
      result.errors.push(...returnsResult.errors);
      result.warnings.push(...returnsResult.warnings);
      if (!returnsResult.isValid) {
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate ChunkMetadata
   */
  validateMetadata(
    metadata: ChunkMetadata,
    prefix: string = 'metadata'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Required fields
    if (!metadata.type || !this.isValidChunkType(metadata.type)) {
      result.errors.push({
        field: `${prefix}.type`,
        message:
          'Type must be one of: method, class, example, tutorial, troubleshooting',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!metadata.namespace || typeof metadata.namespace !== 'string') {
      result.errors.push({
        field: `${prefix}.namespace`,
        message: 'Namespace is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!metadata.importance || !this.isValidImportance(metadata.importance)) {
      result.errors.push({
        field: `${prefix}.importance`,
        message: 'Importance must be one of: critical, high, medium, low',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!Array.isArray(metadata.tags)) {
      result.errors.push({
        field: `${prefix}.tags`,
        message: 'Tags must be an array',
        severity: 'high',
      });
      result.isValid = false;
    } else if (metadata.tags.length === 0) {
      result.warnings.push({
        field: `${prefix}.tags`,
        message: 'No tags provided',
        suggestion: 'Adding tags improves searchability',
      });
    }

    if (!metadata.sourceFile || typeof metadata.sourceFile !== 'string') {
      result.errors.push({
        field: `${prefix}.sourceFile`,
        message: 'Source file is required and must be a string',
        severity: 'high',
      });
      result.isValid = false;
    }

    // Conditional validation
    if (metadata.type === 'method' && !metadata.className) {
      result.warnings.push({
        field: `${prefix}.className`,
        message: 'Method should have associated className',
        suggestion: 'Specify the class this method belongs to',
      });
    }

    if (metadata.type === 'method' && !metadata.methodName) {
      result.warnings.push({
        field: `${prefix}.methodName`,
        message: 'Method metadata should have methodName',
        suggestion: 'Specify the method name for better organization',
      });
    }

    // Array field validation
    if (metadata.relatedMethods && !Array.isArray(metadata.relatedMethods)) {
      result.errors.push({
        field: `${prefix}.relatedMethods`,
        message: 'Related methods must be an array',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (metadata.dependencies && !Array.isArray(metadata.dependencies)) {
      result.errors.push({
        field: `${prefix}.dependencies`,
        message: 'Dependencies must be an array',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (metadata.commonMistakes && !Array.isArray(metadata.commonMistakes)) {
      result.errors.push({
        field: `${prefix}.commonMistakes`,
        message: 'Common mistakes must be an array',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (metadata.useCases && !Array.isArray(metadata.useCases)) {
      result.errors.push({
        field: `${prefix}.useCases`,
        message: 'Use cases must be an array',
        severity: 'high',
      });
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate code examples
   */
  validateExamples(
    examples: CodeExample[],
    prefix: string = 'examples'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(examples)) {
      result.errors.push({
        field: prefix,
        message: 'Examples must be an array',
        severity: 'high',
      });
      result.isValid = false;
      return result;
    }

    examples.forEach((example, index) => {
      const examplePrefix = `${prefix}[${index}]`;

      if (!example.language || typeof example.language !== 'string') {
        result.errors.push({
          field: `${examplePrefix}.language`,
          message: 'Example language is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (!example.code || typeof example.code !== 'string') {
        result.errors.push({
          field: `${examplePrefix}.code`,
          message: 'Example code is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (!example.explanation || typeof example.explanation !== 'string') {
        result.errors.push({
          field: `${examplePrefix}.explanation`,
          message: 'Example explanation is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (example.code && example.code.length < 10) {
        result.warnings.push({
          field: `${examplePrefix}.code`,
          message: 'Code example is very short',
          suggestion: 'Consider providing more comprehensive examples',
        });
      }

      if (example.explanation && example.explanation.length < 10) {
        result.warnings.push({
          field: `${examplePrefix}.explanation`,
          message: 'Example explanation is very short',
          suggestion: 'Provide detailed explanation of what the code does',
        });
      }
    });

    return result;
  }

  /**
   * Validate parameters
   */
  validateParameters(
    parameters: Parameter[],
    prefix: string = 'parameters'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(parameters)) {
      result.errors.push({
        field: prefix,
        message: 'Parameters must be an array',
        severity: 'high',
      });
      result.isValid = false;
      return result;
    }

    parameters.forEach((param, index) => {
      const paramPrefix = `${prefix}[${index}]`;

      if (!param.name || typeof param.name !== 'string') {
        result.errors.push({
          field: `${paramPrefix}.name`,
          message: 'Parameter name is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (!param.description || typeof param.description !== 'string') {
        result.errors.push({
          field: `${paramPrefix}.description`,
          message: 'Parameter description is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (!param.type || !this.validateTypeInfo(param.type)) {
        result.errors.push({
          field: `${paramPrefix}.type`,
          message: 'Parameter type information is invalid',
          severity: 'high',
        });
        result.isValid = false;
      }
    });

    return result;
  }

  /**
   * Validate return values
   */
  validateReturns(
    returns: ReturnValue[],
    prefix: string = 'returns'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(returns)) {
      result.errors.push({
        field: prefix,
        message: 'Returns must be an array',
        severity: 'high',
      });
      result.isValid = false;
      return result;
    }

    returns.forEach((returnValue, index) => {
      const returnPrefix = `${prefix}[${index}]`;

      if (
        !returnValue.description ||
        typeof returnValue.description !== 'string'
      ) {
        result.errors.push({
          field: `${returnPrefix}.description`,
          message: 'Return value description is required and must be a string',
          severity: 'high',
        });
        result.isValid = false;
      }

      if (!returnValue.type || !this.validateTypeInfo(returnValue.type)) {
        result.errors.push({
          field: `${returnPrefix}.type`,
          message: 'Return value type information is invalid',
          severity: 'high',
        });
        result.isValid = false;
      }
    });

    return result;
  }

  /**
   * Validate DocumentChunk
   */
  validateDocumentChunk(chunk: DocumentChunk): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!chunk.id || typeof chunk.id !== 'string') {
      result.errors.push({
        field: 'id',
        message: 'Chunk ID is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!chunk.content || typeof chunk.content !== 'string') {
      result.errors.push({
        field: 'content',
        message: 'Chunk content is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    const metadataResult = this.validateMetadata(chunk.metadata, 'metadata');
    result.errors.push(...metadataResult.errors);
    result.warnings.push(...metadataResult.warnings);
    if (!metadataResult.isValid) {
      result.isValid = false;
    }

    if (chunk.embedding && !Array.isArray(chunk.embedding)) {
      result.errors.push({
        field: 'embedding',
        message: 'Embedding must be an array of numbers',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (
      chunk.embedding &&
      chunk.embedding.some((val) => typeof val !== 'number')
    ) {
      result.errors.push({
        field: 'embedding',
        message: 'All embedding values must be numbers',
        severity: 'high',
      });
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate Workflow
   */
  validateWorkflow(workflow: Workflow): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!workflow.id || typeof workflow.id !== 'string') {
      result.errors.push({
        field: 'id',
        message: 'Workflow ID is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!workflow.title || typeof workflow.title !== 'string') {
      result.errors.push({
        field: 'title',
        message: 'Workflow title is required and must be a string',
        severity: 'critical',
      });
      result.isValid = false;
    }

    if (!Array.isArray(workflow.steps)) {
      result.errors.push({
        field: 'steps',
        message: 'Workflow steps must be an array',
        severity: 'critical',
      });
      result.isValid = false;
    } else {
      workflow.steps.forEach((step, index) => {
        const stepResult = this.validateWorkflowStep(step, `steps[${index}]`);
        result.errors.push(...stepResult.errors);
        result.warnings.push(...stepResult.warnings);
        if (!stepResult.isValid) {
          result.isValid = false;
        }
      });
    }

    if (!Array.isArray(workflow.tags)) {
      result.warnings.push({
        field: 'tags',
        message: 'Workflow should have tags for better organization',
        suggestion: 'Add relevant tags to improve discoverability',
      });
    }

    return result;
  }

  /**
   * Validate WorkflowStep
   */
  validateWorkflowStep(
    step: WorkflowStep,
    prefix: string = 'step'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (typeof step.step !== 'number' || step.step < 1) {
      result.errors.push({
        field: `${prefix}.step`,
        message: 'Step number must be a positive number',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (!step.title || typeof step.title !== 'string') {
      result.errors.push({
        field: `${prefix}.title`,
        message: 'Step title is required and must be a string',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (!step.description || typeof step.description !== 'string') {
      result.errors.push({
        field: `${prefix}.description`,
        message: 'Step description is required and must be a string',
        severity: 'high',
      });
      result.isValid = false;
    }

    if (step.code) {
      const codeResult = this.validateExamples([step.code], `${prefix}.code`);
      result.errors.push(...codeResult.errors);
      result.warnings.push(...codeResult.warnings);
      if (!codeResult.isValid) {
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Helper methods for type validation
   */
  private isValidContentType(type: string): type is ParsedContent['type'] {
    return ['method', 'class', 'type', 'example'].includes(type);
  }

  private isValidChunkType(type: string): type is ChunkMetadata['type'] {
    return [
      'method',
      'class',
      'example',
      'tutorial',
      'troubleshooting',
    ].includes(type);
  }

  private isValidImportance(
    importance: string
  ): importance is ChunkMetadata['importance'] {
    return ['critical', 'high', 'medium', 'low'].includes(importance);
  }

  private validateTypeInfo(typeInfo: any): boolean {
    return (
      typeInfo &&
      typeof typeInfo.name === 'string' &&
      typeof typeInfo.optional === 'boolean'
    );
  }

  /**
   * Batch validation utilities
   */
  validateBatch(
    items: any[],
    validationType: 'content' | 'chunk' | 'workflow'
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!Array.isArray(items)) {
      result.errors.push({
        field: 'batch',
        message: 'Items must be an array',
        severity: 'critical',
      });
      result.isValid = false;
      return result;
    }

    items.forEach((item, index) => {
      let itemResult: ValidationResult;

      switch (validationType) {
        case 'content':
          itemResult = this.validateSingleContent(item, index);
          break;
        case 'chunk':
          itemResult = this.validateDocumentChunk(item);
          break;
        case 'workflow':
          itemResult = this.validateWorkflow(item);
          break;
        default:
          itemResult = {
            isValid: false,
            errors: [
              {
                field: `[${index}]`,
                message: 'Unknown validation type',
                severity: 'critical',
              },
            ],
            warnings: [],
          };
      }

      result.errors.push(...itemResult.errors);
      result.warnings.push(...itemResult.warnings);
      if (!itemResult.isValid) {
        result.isValid = false;
      }
    });

    return result;
  }

  /**
   * Get validation summary
   */
  getValidationSummary(result: ValidationResult): string {
    const { errors, warnings } = result;
    const criticalErrors = errors.filter(
      (e) => e.severity === 'critical'
    ).length;
    const highErrors = errors.filter((e) => e.severity === 'high').length;

    let summary = `Validation ${result.isValid ? 'passed' : 'failed'}. `;

    if (criticalErrors > 0) {
      summary += `${criticalErrors} critical error(s), `;
    }

    if (highErrors > 0) {
      summary += `${highErrors} high severity error(s), `;
    }

    if (warnings.length > 0) {
      summary += `${warnings.length} warning(s)`;
    }

    return summary.replace(/, $/, '');
  }
}

export const contentValidator = new ContentValidator();
