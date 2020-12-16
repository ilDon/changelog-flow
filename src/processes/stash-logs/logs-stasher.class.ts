import { Committer } from 'changelog-flow/libs/git-manager/committer.class';
import { handleUncommittedChanges } from 'changelog-flow/processes/common-ops/handle-uncommitted-changes.function';
import { StepsHandler } from 'changelog-flow/processes/releases/creator/steps/steps-handler.class';
import { ChangeItems } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { TempStorer } from 'changelog-flow/processes/stash-logs/temp-storer.class';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

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
    this.newChanges.forEach(change => {
      this.commitMessage += `${change.value};`;
    });
    this.commitMessage = this.commitMessage.replace(/;$/, '.');
  }

  private async commitStash(): Promise<void> {
    new Committer(undefined, this.commitMessage).commit();
  }

}
