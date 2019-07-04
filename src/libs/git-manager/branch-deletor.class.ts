import { FlowBase } from '@bohr/changelogger/libs/flow//flow-base.class';

export class BranchDeletor extends FlowBase {

  private remoteBranches: Array<string>;

  protected async delete(): Promise<void> {
    await this.deleteBranch();
    await this.getRemoteBranchList();
    await this.remmoveRemote();
  }

  private async deleteBranch(): Promise<void> {
    await this.git.removeLocalBranch(this.currentBranch);
  }

  private async getRemoteBranchList(): Promise<void> {
    this.remoteBranches = await this.git.getRemoteBranchList() as Array<string>;
  }

  private async remmoveRemote(): Promise<void> {
    if (this.remoteBranches && this.remoteBranches.includes(this.currentBranch))
      await this.git.removeRemoteBranch(this.currentBranch);
  }

}
