import { FlowBase } from 'changelog-flow/libs/flow/flow-base.class';
import { BranchCloser } from 'changelog-flow/libs/git-manager/branch-closer.class';
import { TagCreator } from 'changelog-flow/libs/git-manager/tag-creator.class';
import { handleUncommittedChanges } from 'changelog-flow/processes/common-ops/handle-uncommitted-changes.function';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

export class ReleaseCloser extends FlowBase {

  private branchName: string;

  public async close(): Promise<void> {
    await handleUncommittedChanges();
    await this.mergeOnDevelop();
    await this.mergeOnMaster();

    if (!argv.noTag)
      await this.callAddTag();

    this.switchToDevelop();
  }

  private async mergeOnDevelop(): Promise<void> {
    await new BranchCloser('release', 'develop', false).close();
  }

  private async mergeOnMaster(): Promise<void> {
    this.branchName = await new BranchCloser('release', 'master', true).close();
  }

  private async callAddTag(): Promise<void> {
    const tagName = this.tagFromBranchName();
    new TagCreator(tagName).create();
  }

  private tagFromBranchName(): string {
    return `v${this.branchName.split('/')[1]}`;
  }

  private switchToDevelop(): void {
    this.setGit();
    this.checkoutToBranch('develop');
  }

}
