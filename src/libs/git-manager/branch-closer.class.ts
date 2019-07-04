import { BranchDeletor } from '@bohr/changelogger/libs/git-manager/branch-deletor.class';
import * as cmd from 'node-cmd';
import { promisify } from 'util';

export class BranchCloser extends BranchDeletor {

  constructor(
    private scope: 'feature' | 'release',
    private destinationBranch: 'develop' | 'master',
    private shouldDeleteBranch: boolean
  ) {
    super();
  }

  public async close(): Promise<string> {
    this.init();

    if (!this.isCurrentInScope())
      return;

    this.logStartClosing();

    await this.checkoutToBranch(this.destinationBranch);
    await this.mergeBranchOnDestination();
    await this.pushCurrent();

    await this.afterMergeAction();

    return this.currentBranch;
  }

  private isCurrentInScope(): boolean {
    return this.currentBranch.startsWith(`${this.scope}/`);
  }

  private logStartClosing(): void {
    if (this.shouldDeleteBranch)
      console.log(`Closing branch ${this.currentBranch}\n`);
  }

  private async mergeBranchOnDestination(): Promise<void> {
    await promisify(cmd.get)(`git merge ${this.currentBranch}`);
  }

  private async afterMergeAction(): Promise<void> {
    if (!this.shouldDeleteBranch)
      return this.checkoutToBranch(this.currentBranch);

    await this.delete();

    console.log(`Branch ${this.currentBranch} closed\n`);
  }

}
