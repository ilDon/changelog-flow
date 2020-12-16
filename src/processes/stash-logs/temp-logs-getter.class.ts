import { Storer } from 'changelog-flow/processes/common-ops/storer.class';
import { ChangeItems } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';
import { ADD_TEMP_TO_RELEASE } from 'changelog-flow/questions/temp-logs/add-temp-to-release.constant';

export class TempLogsGetter extends Storer {

  private tempChanges: Array<ChangeItems> = [];

  public async get(): Promise<Array<ChangeItems>> {
    this.loadChangelogger();

    if (this.changeLogger.temp && this.changeLogger.temp.length)
      await this.askIfShouldAddTemp();

    return this.tempChanges;
  }

  private async askIfShouldAddTemp(): Promise<void> {
    const answer = await questionMaker([ADD_TEMP_TO_RELEASE]);

    if (!answer.choice)
      return;

    this.addTemp();
    this.cleanAndSave();
  }

  private addTemp(): void {
    this.changeLogger.temp.forEach(temp => this.tempChanges.push(temp));
  }

  private cleanAndSave(): void {
    this.changeLogger.temp.length = 0;
    this.doStoreChanges();
  }

}
