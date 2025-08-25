import { BaseParser, SemanticChunk, ParseResult } from './types';
import * as yaml from 'js-yaml';

export class YAMLParser extends BaseParser {
  language = 'yaml';
  fileExtensions = ['.yml', '.yaml'];

  parse(content: string, source?: string): ParseResult {
    try {
      const parsed = yaml.load(content) as any;
      const chunks = this.extractSemanticChunks(parsed, content, source);

      return {
        chunks,
        success: true,
      };
    } catch (error) {
      return {
        chunks: [
          {
            type: 'config',
            name: source ? `${source} (parse error)` : 'yaml-content',
            content,
            startLine: 1,
            endLine: content.split('\n').length,
            metadata: {
              language: this.language,
              dependencies: [],
            },
          },
        ],
        success: false,
        error: error instanceof Error ? error.message : 'YAML parsing failed',
        fallbackUsed: true,
      };
    }
  }

  private extractSemanticChunks(
    obj: any,
    originalContent: string,
    source?: string
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = originalContent.split('\n');

    // Handle specific YAML file types
    if (source?.includes('docker-compose')) {
      chunks.push(...this.parseDockerCompose(obj, lines));
    } else if (source?.includes('ansible') || source?.includes('playbook')) {
      chunks.push(...this.parseAnsiblePlaybook(obj, lines));
    } else if (source?.includes('github/workflows') || source?.includes('.github')) {
      chunks.push(...this.parseGitHubWorkflow(obj, lines));
    } else if (source?.includes('kubernetes') || source?.includes('k8s')) {
      chunks.push(...this.parseKubernetes(obj, lines));
    } else if (source?.includes('openapi') || source?.includes('swagger')) {
      chunks.push(...this.parseOpenAPI(obj, lines));
    } else {
      // Generic YAML parsing
      chunks.push(...this.parseGenericYaml(obj, lines));
    }

    return chunks;
  }

  private parseDockerCompose(compose: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Version and basic info
    if (compose.version) {
      chunks.push(
        this.createChunk('config', 'compose-version', `version: "${compose.version}"`, 1, 3, {
          exports: ['version'],
        })
      );
    }

    // Services
    if (compose.services) {
      Object.entries(compose.services).forEach(([serviceName, service]: [string, any]) => {
        const serviceYaml = yaml.dump({ [serviceName]: service }, { indent: 2 });
        chunks.push(
          this.createChunk(
            'service',
            `service-${serviceName}`,
            serviceYaml,
            this.findLineContaining(lines, serviceName),
            this.findLineContaining(lines, serviceName) + serviceYaml.split('\n').length,
            {
              dependencies: service.depends_on || [],
              exports: [serviceName],
            }
          )
        );
      });
    }

    // Networks
    if (compose.networks) {
      const networksYaml = yaml.dump({ networks: compose.networks }, { indent: 2 });
      chunks.push(
        this.createChunk(
          'config',
          'networks',
          networksYaml,
          this.findLineContaining(lines, 'networks:'),
          this.findLineContaining(lines, 'networks:') + Object.keys(compose.networks).length * 3,
          { exports: Object.keys(compose.networks) }
        )
      );
    }

    // Volumes
    if (compose.volumes) {
      const volumesYaml = yaml.dump({ volumes: compose.volumes }, { indent: 2 });
      chunks.push(
        this.createChunk(
          'resource',
          'volumes',
          volumesYaml,
          this.findLineContaining(lines, 'volumes:'),
          this.findLineContaining(lines, 'volumes:') + Object.keys(compose.volumes).length * 3,
          { exports: Object.keys(compose.volumes) }
        )
      );
    }

    return chunks;
  }

  private parseAnsiblePlaybook(playbook: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (Array.isArray(playbook)) {
      playbook.forEach((play, index) => {
        const playYaml = yaml.dump(play, { indent: 2 });
        chunks.push(
          this.createChunk(
            'play',
            play.name || `play-${index}`,
            playYaml,
            this.findPlayStart(lines, play, index),
            this.findPlayStart(lines, play, index) + playYaml.split('\n').length,
            {
              dependencies: play.roles || [],
              exports: [play.name || `play-${index}`],
            }
          )
        );

        // Extract tasks
        if (play.tasks) {
          play.tasks.forEach((task: any, taskIndex: number) => {
            const taskYaml = yaml.dump(task, { indent: 2 });
            chunks.push(
              this.createChunk(
                'task',
                task.name || `task-${taskIndex}`,
                taskYaml,
                this.findLineContaining(lines, task.name || 'tasks:') + taskIndex * 3,
                this.findLineContaining(lines, task.name || 'tasks:') +
                  taskIndex * 3 +
                  taskYaml.split('\n').length,
                {
                  parent: play.name || `play-${index}`,
                  exports: [task.name || `task-${taskIndex}`],
                }
              )
            );
          });
        }
      });
    }

    return chunks;
  }

  private parseGitHubWorkflow(workflow: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Workflow metadata
    chunks.push(
      this.createChunk(
        'config',
        'workflow-info',
        yaml.dump(
          {
            name: workflow.name,
            on: workflow.on,
            env: workflow.env,
          },
          { indent: 2 }
        ),
        1,
        10,
        { exports: ['name'] }
      )
    );

    // Jobs
    if (workflow.jobs) {
      Object.entries(workflow.jobs).forEach(([jobName, job]: [string, any]) => {
        const jobYaml = yaml.dump({ [jobName]: job }, { indent: 2 });
        chunks.push(
          this.createChunk(
            'task',
            `job-${jobName}`,
            jobYaml,
            this.findLineContaining(lines, jobName),
            this.findLineContaining(lines, jobName) + jobYaml.split('\n').length,
            {
              dependencies: job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [],
              exports: [jobName],
            }
          )
        );
      });
    }

    return chunks;
  }

  private parseKubernetes(k8s: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Resource metadata
    if (k8s.metadata) {
      chunks.push(
        this.createChunk(
          'config',
          'metadata',
          yaml.dump({ metadata: k8s.metadata }, { indent: 2 }),
          this.findLineContaining(lines, 'metadata:'),
          this.findLineContaining(lines, 'metadata:') + 5,
          { exports: [k8s.metadata.name] }
        )
      );
    }

    // Spec
    if (k8s.spec) {
      const specYaml = yaml.dump({ spec: k8s.spec }, { indent: 2 });
      chunks.push(
        this.createChunk(
          'config',
          'spec',
          specYaml,
          this.findLineContaining(lines, 'spec:'),
          this.findLineContaining(lines, 'spec:') + specYaml.split('\n').length,
          {}
        )
      );
    }

    return chunks;
  }

  private parseOpenAPI(api: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // API Info
    if (api.info) {
      chunks.push(
        this.createChunk(
          'config',
          'api-info',
          yaml.dump({ info: api.info }, { indent: 2 }),
          1,
          10,
          { exports: [api.info.title] }
        )
      );
    }

    // Paths
    if (api.paths) {
      Object.entries(api.paths).forEach(([path, methods]: [string, any]) => {
        const pathYaml = yaml.dump({ [path]: methods }, { indent: 2 });
        chunks.push(
          this.createChunk(
            'resource',
            `path-${path.replace(/[{}\/]/g, '-')}`,
            pathYaml,
            this.findLineContaining(lines, path),
            this.findLineContaining(lines, path) + pathYaml.split('\n').length,
            { exports: [path] }
          )
        );
      });
    }

    // Components/Schemas
    if (api.components?.schemas) {
      Object.entries(api.components.schemas).forEach(([schemaName, schema]) => {
        const schemaYaml = yaml.dump({ [schemaName]: schema }, { indent: 2 });
        chunks.push(
          this.createChunk(
            'type',
            `schema-${schemaName}`,
            schemaYaml,
            this.findLineContaining(lines, schemaName),
            this.findLineContaining(lines, schemaName) + schemaYaml.split('\n').length,
            { exports: [schemaName] }
          )
        );
      });
    }

    return chunks;
  }

  private parseGenericYaml(obj: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const chunkContent = yaml.dump({ [key]: value }, { indent: 2 });
          const startLine = this.findLineContaining(lines, `${key}:`);

          chunks.push(
            this.createChunk(
              Array.isArray(value) ? 'array_section' : 'config',
              key,
              chunkContent,
              startLine,
              startLine + chunkContent.split('\n').length,
              {}
            )
          );
        }
      });

      // If no complex objects found, treat as single config
      if (chunks.length === 0) {
        chunks.push(
          this.createChunk(
            'config',
            'yaml-config',
            yaml.dump(obj, { indent: 2 }),
            1,
            lines.length,
            { exports: Object.keys(obj) }
          )
        );
      }
    }

    return chunks;
  }

  private findLineContaining(lines: string[], text: string): number {
    const lineIndex = lines.findIndex((line) => line.includes(text));
    return lineIndex >= 0 ? lineIndex + 1 : 1;
  }

  private findPlayStart(lines: string[], play: any, index: number): number {
    if (play.name) {
      const nameLineIndex = lines.findIndex((line) => line.includes(play.name));
      if (nameLineIndex >= 0) return nameLineIndex + 1;
    }
    // Fallback: estimate based on play index
    return Math.max(1, index * 20);
  }
}
