import { BaseParser, SemanticChunk, ParseResult } from './types';

export class DockerfileParser extends BaseParser {
  language = 'dockerfile';
  fileExtensions = ['Dockerfile', '.dockerfile'];

  parse(content: string, source?: string): ParseResult {
    try {
      const chunks = this.extractSemanticChunks(content, source);

      return {
        chunks,
        success: true,
      };
    } catch (error) {
      return {
        chunks: [
          {
            type: 'config',
            name: source ? source.replace(/.*\//, '') : 'dockerfile',
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
        error: error instanceof Error ? error.message : 'Dockerfile parsing failed',
        fallbackUsed: true,
      };
    }
  }

  private extractSemanticChunks(content: string, source?: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = content.split('\n');

    // Parse multi-stage builds
    const stages = this.parseMultiStageBuilds(lines);
    if (stages.length > 1) {
      chunks.push(...stages);
    } else {
      // Single stage build - parse by instruction types
      chunks.push(...this.parseInstructions(lines));
    }

    return chunks;
  }

  private parseMultiStageBuilds(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const stages: Array<{ name: string; start: number; end: number; lines: string[] }> = [];
    let currentStage: { name: string; start: number; lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.toUpperCase().startsWith('FROM ')) {
        // End previous stage
        if (currentStage) {
          stages.push({
            ...currentStage,
            end: i,
            lines: currentStage.lines,
          });
        }

        // Start new stage
        const fromMatch = line.match(/FROM\s+[\w.:/-]+(?:\s+AS\s+(\w+))?/i);
        const stageName = fromMatch?.[1] || `stage-${stages.length}`;

        currentStage = {
          name: stageName,
          start: i + 1,
          lines: [lines[i]],
        };
      } else if (currentStage) {
        currentStage.lines.push(lines[i]);
      }
    }

    // Add final stage
    if (currentStage) {
      stages.push({
        ...currentStage,
        end: lines.length,
        lines: currentStage.lines,
      });
    }

    // Create chunks for each stage
    for (const stage of stages) {
      chunks.push(
        this.createChunk('stage', stage.name, stage.lines.join('\n'), stage.start, stage.end, {
          exports: [stage.name],
          dependencies: this.extractStageDependencies(stage.lines),
        })
      );

      // Parse instructions within each stage
      chunks.push(...this.parseStageInstructions(stage.lines, stage.start, stage.name));
    }

    return chunks;
  }

  private parseInstructions(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Group related instructions
    const instructionGroups = this.groupInstructions(lines);

    for (const group of instructionGroups) {
      chunks.push(
        this.createChunk(
          this.getInstructionType(group.type),
          group.name,
          group.content,
          group.startLine,
          group.endLine,
          {
            dependencies: group.dependencies,
            exports: group.exports,
          }
        )
      );
    }

    return chunks;
  }

  private parseStageInstructions(
    stageLines: string[],
    stageStartLine: number,
    stageName: string
  ): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const instructionGroups = this.groupInstructions(stageLines);

    for (const group of instructionGroups) {
      chunks.push(
        this.createChunk(
          this.getInstructionType(group.type),
          `${stageName}-${group.name}`,
          group.content,
          stageStartLine + group.startLine - 1,
          stageStartLine + group.endLine - 1,
          {
            parent: stageName,
            dependencies: group.dependencies,
            exports: group.exports,
          }
        )
      );
    }

    return chunks;
  }

  private groupInstructions(lines: string[]): Array<{
    type: string;
    name: string;
    content: string;
    startLine: number;
    endLine: number;
    dependencies: string[];
    exports: string[];
  }> {
    const groups: Array<{
      type: string;
      name: string;
      content: string;
      startLine: number;
      endLine: number;
      dependencies: string[];
      exports: string[];
    }> = [];

    let currentGroup: {
      type: string;
      name: string;
      lines: string[];
      startLine: number;
      dependencies: string[];
      exports: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '' || trimmed.startsWith('#')) {
        if (currentGroup) {
          currentGroup.lines.push(line);
        }
        continue;
      }

      const instruction = this.parseDockerInstruction(trimmed);
      if (instruction) {
        // Start new group for different instruction types or key instructions
        if (!currentGroup || this.shouldStartNewGroup(currentGroup.type, instruction.type)) {
          if (currentGroup) {
            groups.push({
              ...currentGroup,
              content: currentGroup.lines.join('\n'),
              endLine: i,
            });
          }

          currentGroup = {
            type: instruction.type,
            name: this.getGroupName(instruction),
            lines: [line],
            startLine: i + 1,
            dependencies: instruction.dependencies,
            exports: instruction.exports,
          };
        } else {
          // Add to current group
          currentGroup.lines.push(line);
          currentGroup.dependencies.push(...instruction.dependencies);
          currentGroup.exports.push(...instruction.exports);
        }
      } else if (currentGroup) {
        currentGroup.lines.push(line);
      }
    }

    // Add final group
    if (currentGroup) {
      groups.push({
        ...currentGroup,
        content: currentGroup.lines.join('\n'),
        endLine: lines.length,
      });
    }

    return groups;
  }

  private parseDockerInstruction(line: string): {
    type: string;
    dependencies: string[];
    exports: string[];
  } | null {
    const instructionMatch = line.match(/^([A-Z]+)\s+(.*)$/i);
    if (!instructionMatch) return null;

    const instruction = instructionMatch[1].toUpperCase();
    const args = instructionMatch[2];

    const dependencies: string[] = [];
    const exports: string[] = [];

    switch (instruction) {
      case 'FROM':
        const fromMatch = args.match(/([\w.:/-]+)(?:\s+AS\s+(\w+))?/i);
        if (fromMatch) {
          dependencies.push(fromMatch[1]); // Base image
          if (fromMatch[2]) exports.push(fromMatch[2]); // Stage name
        }
        break;

      case 'COPY':
      case 'ADD':
        const copyMatch = args.match(/--from=(\w+)/);
        if (copyMatch) {
          dependencies.push(copyMatch[1]); // Source stage
        }
        break;

      case 'ENV':
        const envVars = this.parseEnvVariables(args);
        exports.push(...envVars);
        break;

      case 'ARG':
        const argName = args.split('=')[0].trim();
        exports.push(argName);
        break;

      case 'LABEL':
        const labels = this.parseLabels(args);
        exports.push(...labels);
        break;
    }

    return {
      type: instruction,
      dependencies,
      exports,
    };
  }

  private shouldStartNewGroup(currentType: string, newType: string): boolean {
    // Always start new group for these instructions
    const alwaysNewGroup = ['FROM', 'WORKDIR', 'USER', 'ENTRYPOINT', 'CMD'];
    if (alwaysNewGroup.includes(newType)) return true;

    // Group similar instructions together
    const groupable = ['RUN', 'ENV', 'ARG', 'LABEL', 'EXPOSE'];
    if (groupable.includes(currentType) && groupable.includes(newType)) {
      return currentType !== newType;
    }

    return true;
  }

  private getGroupName(instruction: { type: string; exports: string[] }): string {
    switch (instruction.type) {
      case 'FROM':
        return instruction.exports[0] || 'base-image';
      case 'ENV':
        return 'environment';
      case 'ARG':
        return 'arguments';
      case 'LABEL':
        return 'labels';
      case 'EXPOSE':
        return 'ports';
      case 'VOLUME':
        return 'volumes';
      case 'WORKDIR':
        return 'workdir';
      case 'USER':
        return 'user';
      case 'COPY':
      case 'ADD':
        return 'files';
      case 'RUN':
        return 'commands';
      case 'CMD':
        return 'cmd';
      case 'ENTRYPOINT':
        return 'entrypoint';
      default:
        return instruction.type.toLowerCase();
    }
  }

  private getInstructionType(instruction: string): SemanticChunk['type'] {
    switch (instruction) {
      case 'FROM':
        return 'config';
      case 'ENV':
      case 'ARG':
        return 'variable';
      case 'LABEL':
        return 'config';
      case 'EXPOSE':
      case 'VOLUME':
        return 'resource';
      case 'WORKDIR':
      case 'USER':
        return 'config';
      case 'COPY':
      case 'ADD':
        return 'instruction';
      case 'RUN':
        return 'instruction';
      case 'CMD':
      case 'ENTRYPOINT':
        return 'instruction';
      default:
        return 'instruction';
    }
  }

  private parseEnvVariables(args: string): string[] {
    const variables: string[] = [];

    // Handle both KEY=value and KEY value formats
    if (args.includes('=')) {
      const pairs = args.split(/\s+(?=\w+=)/);
      for (const pair of pairs) {
        const [key] = pair.split('=', 1);
        if (key) variables.push(key.trim());
      }
    } else {
      const parts = args.trim().split(/\s+/);
      if (parts.length >= 2) {
        variables.push(parts[0]);
      }
    }

    return variables;
  }

  private parseLabels(args: string): string[] {
    const labels: string[] = [];

    if (args.includes('=')) {
      const pairs = args.split(/\s+(?=[\w.-]+=)/);
      for (const pair of pairs) {
        const [key] = pair.split('=', 1);
        if (key) labels.push(key.trim().replace(/"/g, ''));
      }
    }

    return labels;
  }

  private extractStageDependencies(stageLines: string[]): string[] {
    const dependencies: string[] = [];

    for (const line of stageLines) {
      const trimmed = line.trim();

      // FROM instruction dependencies
      if (trimmed.toUpperCase().startsWith('FROM ')) {
        const fromMatch = trimmed.match(/FROM\s+([\w.:/-]+)/i);
        if (fromMatch) {
          dependencies.push(fromMatch[1]);
        }
      }

      // COPY --from dependencies
      if (trimmed.toUpperCase().startsWith('COPY ')) {
        const copyMatch = trimmed.match(/--from=(\w+)/i);
        if (copyMatch) {
          dependencies.push(copyMatch[1]);
        }
      }
    }

    return dependencies;
  }
}
