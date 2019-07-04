import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { Git } from 'git-interface';
import * as gitState from 'git-state';

export class FlowBase {

  protected currentBranch: string;
  protected git: Git;

  protected init(): void {
    this.setGit();
    this.getCurrentBranch();
  }

  protected setGit(): void {
    this.git = new Git({
      dir: DIRS.gitPath
    });
  }

  protected getCurrentBranch(): void {
    this.currentBranch = gitState.checkSync(DIRS.gitPath).branch;
  }

  protected async checkoutToBranch(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  protected async pushCurrent(): Promise<void> {
    await this.git.push();
  }

  protected async createBranch(name: string): Promise<void> {
    await this.git.createBranch(name);
  }

}
