import { Committer } from '@bohr/changelogger/libs/git-manager/committer.class';
import { handleUncommittedChanges } from '@bohr/changelogger/processes/common-ops/handle-uncommitted-changes.function';
import { StepsHandler } from '@bohr/changelogger/processes/releases/creator/steps/steps-handler.class';
import { ChangeItems } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';
import { TempStorer } from '@bohr/changelogger/processes/stash-logs/temp-storer.class';
import { argv } from 'yargs';

export class LogsStasher {

  private newChanges: Array<ChangeItems>;
  private commitMessage = 'TL: ';

  public async init(): Promise<void> {
    if (!argv.sg)
      await handleUncommittedChanges();

    await this.getChanges();
    this.storeTempChanges();
    this.addChangesToCommitMessage();
    await this.commitStash();

  }

  private async getChanges(): Promise<void> {
    this.newChanges = await new StepsHandler().start() as Array<ChangeItems>;
  }

  private storeTempChanges(): void {
    new TempStorer(this.newChanges).store();
  }

  private addChangesToCommitMessage(): void {
    this.newChanges.forEach(change => { this.commitMessage += `${change.value};`; });
    this.commitMessage = this.commitMessage.replace(/;$/, '.');
  }

  private async commitStash(): Promise<void> {
    new Committer(undefined, this.commitMessage).commit();
  }

}
