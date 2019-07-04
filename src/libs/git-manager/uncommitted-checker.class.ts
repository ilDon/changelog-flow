import { errorHandler } from '@bohr/changelogger/libs/errors//error-handler.function';
import { fatalErrors } from '@bohr/changelogger/libs/errors//errors.enum';
import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { Git } from 'git-interface';
import * as gitState from 'git-state';
import * as cmd from 'node-cmd';
import { promisify } from 'util';

export interface FilesToCommit {
  untracked: Array<string>;
  uncommitted: Array<string>;
}

export class UncommittedChecker {

  private isRepository: boolean;
  private git: Git;
  private filesToCommit: FilesToCommit = {
    untracked: [],
    uncommitted: []
  };

  public async exist(): Promise<FilesToCommit> {
    this.isGit();

    if (!this.isRepository)
      errorHandler(fatalErrors.notARepository);

    this.setGit();
    await this.getUntracked();
    await this.getUncommitted();
    return this.filesToCommit;
  }

  private isGit(): void {
    this.isRepository = gitState.isGitSync(DIRS.gitPath) as boolean;
  }

  private setGit(): void {
    this.git = new Git({
      dir: DIRS.gitPath
    });
  }

  private async getUntracked(): Promise<void> {
    const untrackedString = await promisify(cmd.get)('git ls-files --others --exclude-standard');
    this.filesToCommit.untracked = untrackedString.split('\n').filter(filename => filename !== '');
  }

  private async getUncommitted(): Promise<void> {
    this.filesToCommit.uncommitted = await this.git.getUncommittedList();
  }

}
