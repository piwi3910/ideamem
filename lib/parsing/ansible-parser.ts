import { BaseParser, SemanticChunk, ParseResult } from './types';
import * as yaml from 'js-yaml';

export class AnsibleParser extends BaseParser {
  language = 'ansible';
  fileExtensions: string[] = []; // Don't auto-register for file extensions, use content detection

  parse(content: string, source?: string): ParseResult {
    try {
      // Only parse if it looks like Ansible content
      if (!this.isAnsibleContent(content, source)) {
        return {
          chunks: [],
          success: false,
          error: 'Not Ansible content',
        };
      }

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
            name: source ? source.replace(/.*\//, '').replace(/\.ya?ml$/, '') : 'ansible-content',
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
        error: error instanceof Error ? error.message : 'Ansible parsing failed',
        fallbackUsed: true,
      };
    }
  }

  private isAnsibleContent(content: string, source?: string): boolean {
    // Check file path indicators
    if (source) {
      if (
        source.includes('playbook') ||
        source.includes('ansible') ||
        source.includes('roles/') ||
        source.includes('tasks/') ||
        source.includes('handlers/') ||
        source.includes('vars/') ||
        source.includes('defaults/') ||
        source.includes('meta/')
      ) {
        return true;
      }
    }

    // Check content indicators
    const ansibleKeywords = [
      'hosts:',
      'become:',
      'tasks:',
      'handlers:',
      'vars:',
      'defaults:',
      'roles:',
      'name:',
      'ansible_',
      'gather_facts:',
      'remote_user:',
      'connection:',
      'strategy:',
      'serial:',
      'max_fail_percentage:',
    ];

    const lowerContent = content.toLowerCase();
    return ansibleKeywords.some((keyword) => lowerContent.includes(keyword));
  }

  private extractSemanticChunks(
    obj: any,
    originalContent: string,
    source?: string
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = originalContent.split('\n');

    // Determine Ansible file type and parse accordingly
    if (source?.includes('main.yml') && source.includes('tasks/')) {
      chunks.push(...this.parseTasksFile(obj, lines));
    } else if (source?.includes('main.yml') && source.includes('handlers/')) {
      chunks.push(...this.parseHandlersFile(obj, lines));
    } else if (source?.includes('main.yml') && source.includes('meta/')) {
      chunks.push(...this.parseMetaFile(obj, lines));
    } else if (
      source?.includes('main.yml') &&
      (source.includes('vars/') || source.includes('defaults/'))
    ) {
      chunks.push(...this.parseVarsFile(obj, lines));
    } else if (Array.isArray(obj)) {
      // Playbook file
      chunks.push(...this.parsePlaybook(obj, lines));
    } else if (obj && typeof obj === 'object') {
      // Inventory or other structured file
      chunks.push(...this.parseInventoryOrConfig(obj, lines));
    }

    return chunks;
  }

  private parsePlaybook(playbook: any[], lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    playbook.forEach((play, playIndex) => {
      if (play && typeof play === 'object') {
        const playName = play.name || `play-${playIndex}`;
        const playStart = this.findPlayStart(lines, play, playIndex);
        const playEnd = this.findPlayEnd(lines, playStart, playIndex, playbook.length);

        const playContent = this.extractPlayContent(play);

        chunks.push(
          this.createChunk('play', playName, playContent, playStart, playEnd, {
            dependencies: this.extractPlayDependencies(play),
            exports: [playName],
          })
        );

        // Parse tasks within the play
        if (play.tasks) {
          chunks.push(...this.parseTasksList(play.tasks, playStart, playName, 'tasks'));
        }

        // Parse pre_tasks
        if (play.pre_tasks) {
          chunks.push(...this.parseTasksList(play.pre_tasks, playStart, playName, 'pre_tasks'));
        }

        // Parse post_tasks
        if (play.post_tasks) {
          chunks.push(...this.parseTasksList(play.post_tasks, playStart, playName, 'post_tasks'));
        }

        // Parse handlers
        if (play.handlers) {
          chunks.push(...this.parseTasksList(play.handlers, playStart, playName, 'handlers'));
        }

        // Parse vars
        if (play.vars) {
          chunks.push(
            this.createChunk(
              'variable',
              `${playName}-vars`,
              yaml.dump({ vars: play.vars }, { indent: 2 }),
              playStart + 5,
              playStart + 10,
              {
                parent: playName,
                exports: Object.keys(play.vars),
              }
            )
          );
        }
      }
    });

    return chunks;
  }

  private parseTasksFile(tasks: any[], lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (Array.isArray(tasks)) {
      chunks.push(...this.parseTasksList(tasks, 1, 'tasks', 'tasks'));
    }

    return chunks;
  }

  private parseHandlersFile(handlers: any[], lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (Array.isArray(handlers)) {
      chunks.push(...this.parseTasksList(handlers, 1, 'handlers', 'handlers'));
    }

    return chunks;
  }

  private parseMetaFile(meta: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (meta.galaxy_info) {
      chunks.push(
        this.createChunk(
          'config',
          'galaxy-info',
          yaml.dump({ galaxy_info: meta.galaxy_info }, { indent: 2 }),
          1,
          15,
          { exports: ['galaxy_info'] }
        )
      );
    }

    if (meta.dependencies) {
      chunks.push(
        this.createChunk(
          'config',
          'role-dependencies',
          yaml.dump({ dependencies: meta.dependencies }, { indent: 2 }),
          this.findLineContaining(lines, 'dependencies:'),
          this.findLineContaining(lines, 'dependencies:') + meta.dependencies.length + 2,
          {
            dependencies: Array.isArray(meta.dependencies)
              ? meta.dependencies.map((dep: any) =>
                  typeof dep === 'string' ? dep : dep.name || dep.role
                )
              : [],
          }
        )
      );
    }

    return chunks;
  }

  private parseVarsFile(vars: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (vars && typeof vars === 'object') {
      Object.entries(vars).forEach(([key, value]) => {
        const varStart = this.findLineContaining(lines, `${key}:`);
        const varContent =
          typeof value === 'object'
            ? yaml.dump({ [key]: value }, { indent: 2 })
            : `${key}: ${value}`;

        chunks.push(
          this.createChunk(
            'variable',
            key,
            varContent,
            varStart,
            varStart + (typeof value === 'object' ? 5 : 1),
            { exports: [key] }
          )
        );
      });
    }

    return chunks;
  }

  private parseInventoryOrConfig(config: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    Object.entries(config).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const configContent = yaml.dump({ [key]: value }, { indent: 2 });

        chunks.push(
          this.createChunk(
            'config',
            key,
            configContent,
            this.findLineContaining(lines, `${key}:`),
            this.findLineContaining(lines, `${key}:`) + configContent.split('\n').length,
            { exports: [key] }
          )
        );
      }
    });

    return chunks;
  }

  private parseTasksList(
    tasks: any[],
    baseLineStart: number,
    parentName: string,
    type: string
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (!Array.isArray(tasks)) return chunks;

    tasks.forEach((task, taskIndex) => {
      if (task && typeof task === 'object') {
        const taskName = task.name || `${type}-${taskIndex}`;
        const taskContent = this.extractTaskContent(task);
        const taskStart = baseLineStart + taskIndex * 8; // Rough estimate

        chunks.push(
          this.createChunk(
            'task',
            taskName,
            taskContent,
            taskStart,
            taskStart + taskContent.split('\n').length,
            {
              parent: parentName,
              dependencies: this.extractTaskDependencies(task),
              exports: [taskName],
            }
          )
        );

        // Parse blocks within tasks
        if (task.block) {
          chunks.push(...this.parseTasksList(task.block, taskStart + 2, taskName, 'block'));
        }

        if (task.rescue) {
          chunks.push(...this.parseTasksList(task.rescue, taskStart + 2, taskName, 'rescue'));
        }

        if (task.always) {
          chunks.push(...this.parseTasksList(task.always, taskStart + 2, taskName, 'always'));
        }
      }
    });

    return chunks;
  }

  private extractPlayContent(play: any): string {
    const playObj: any = {};

    // Core play attributes
    if (play.name) playObj.name = play.name;
    if (play.hosts) playObj.hosts = play.hosts;
    if (play.become !== undefined) playObj.become = play.become;
    if (play.become_user) playObj.become_user = play.become_user;
    if (play.gather_facts !== undefined) playObj.gather_facts = play.gather_facts;
    if (play.remote_user) playObj.remote_user = play.remote_user;
    if (play.connection) playObj.connection = play.connection;
    if (play.strategy) playObj.strategy = play.strategy;
    if (play.serial) playObj.serial = play.serial;
    if (play.tags) playObj.tags = play.tags;
    if (play.when) playObj.when = play.when;

    return yaml.dump(playObj, { indent: 2 });
  }

  private extractTaskContent(task: any): string {
    const taskObj: any = {};

    // Core task attributes
    if (task.name) taskObj.name = task.name;

    // Find the module being used
    const moduleKeys = Object.keys(task).filter(
      (key) =>
        ![
          'name',
          'when',
          'tags',
          'notify',
          'become',
          'become_user',
          'ignore_errors',
          'changed_when',
          'failed_when',
          'until',
          'retries',
          'delay',
          'vars',
          'environment',
        ].includes(key)
    );

    for (const moduleKey of moduleKeys) {
      taskObj[moduleKey] = task[moduleKey];
    }

    // Add common task attributes
    if (task.when) taskObj.when = task.when;
    if (task.tags) taskObj.tags = task.tags;
    if (task.notify) taskObj.notify = task.notify;
    if (task.become !== undefined) taskObj.become = task.become;
    if (task.vars) taskObj.vars = task.vars;

    return yaml.dump(taskObj, { indent: 2 });
  }

  private extractPlayDependencies(play: any): string[] {
    const dependencies: string[] = [];

    if (play.roles) {
      const roles = Array.isArray(play.roles) ? play.roles : [play.roles];
      for (const role of roles) {
        if (typeof role === 'string') {
          dependencies.push(role);
        } else if (role.name) {
          dependencies.push(role.name);
        } else if (role.role) {
          dependencies.push(role.role);
        }
      }
    }

    if (play.include) {
      dependencies.push(play.include);
    }

    return dependencies;
  }

  private extractTaskDependencies(task: any): string[] {
    const dependencies: string[] = [];

    // Handler notifications
    if (task.notify) {
      const handlers = Array.isArray(task.notify) ? task.notify : [task.notify];
      dependencies.push(...handlers);
    }

    // Include/import statements
    if (task.include_tasks) dependencies.push(task.include_tasks);
    if (task.import_tasks) dependencies.push(task.import_tasks);
    if (task.include_vars) dependencies.push(task.include_vars);
    if (task.include_role) {
      const roleName =
        typeof task.include_role === 'string' ? task.include_role : task.include_role.name;
      if (roleName) dependencies.push(roleName);
    }

    return dependencies;
  }

  private findPlayStart(lines: string[], play: any, playIndex: number): number {
    if (play.name) {
      const nameIndex = lines.findIndex((line) => line.includes(play.name));
      if (nameIndex >= 0) return nameIndex + 1;
    }

    if (play.hosts) {
      const hostsIndex = lines.findIndex((line) => line.includes(`hosts: ${play.hosts}`));
      if (hostsIndex >= 0) return hostsIndex + 1;
    }

    // Fallback: estimate based on play index
    return Math.max(1, playIndex * 50);
  }

  private findPlayEnd(
    lines: string[],
    playStart: number,
    playIndex: number,
    totalPlays: number
  ): number {
    // Simple estimation - could be improved with better YAML parsing
    const estimatedLength = 40;
    const nextPlayStart = playIndex < totalPlays - 1 ? (playIndex + 1) * 50 : lines.length;
    return Math.min(playStart + estimatedLength, nextPlayStart);
  }

  private findLineContaining(lines: string[], text: string): number {
    const lineIndex = lines.findIndex((line) => line.includes(text));
    return lineIndex >= 0 ? lineIndex + 1 : 1;
  }
}
