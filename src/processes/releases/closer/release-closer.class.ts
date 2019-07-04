import { BranchCloser } from '@bohr/changelogger/libs/git-manager/branch-closer.class';
import { TagCreator } from '@bohr/changelogger/libs/git-manager/tag-creator.class';
import { handleUncommittedChanges } from '@bohr/changelogger/processes/common-ops/handle-uncommitted-changes.function';
import { questionMaker } from '@bohr/changelogger/questions/question-maker.function';
import { SHOULD_ADD_TAG } from '@bohr/changelogger/questions/tags/should-add-tag.constant';

export class ReleaseCloser {

  private branchName: string;

  public async close(): Promise<void> {
    await handleUncommittedChanges();
    await this.mergeOnDevelop();
    await this.mergeOnMaster();

    if (await this.askShouldAddTag())
      await this.callAddTag();
  }

  private async mergeOnDevelop(): Promise<void> {
    await new BranchCloser('release', 'develop', false).close();
  }

  private async mergeOnMaster(): Promise<void> {
    this.branchName = await new BranchCloser('release', 'master', true).close();
  }

  private async askShouldAddTag(): Promise<boolean> {
    const res = await questionMaker(SHOULD_ADD_TAG);
    return res.choice;
  }

  private async callAddTag(): Promise<void> {
    const tagName = this.tagFromBranchName();
    new TagCreator(tagName).create();
  }

  private tagFromBranchName(): string {
    return `v${this.branchName.split('/')[1]}`;
  }

}
