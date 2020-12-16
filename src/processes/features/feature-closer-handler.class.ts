import { BranchCloser } from 'changelog-flow/libs/git-manager/branch-closer.class';
import { LogsStasher } from 'changelog-flow/processes/stash-logs/logs-stasher.class';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';
import { ADD_TEMP_AFTER_FEATURE_CLOSED } from 'changelog-flow/questions/temp-logs/add-temp-after-feature-closed.constant';

export class FeatureCloserHandler {

  public async close(): Promise<void> {
    await this.doClose();
    if (await this.wantsToAddTempLogs())
      await this.addTempLogs();
  }

  private async doClose(): Promise<void> {
    await new BranchCloser('feature', 'develop', true).close();
  }

  private async wantsToAddTempLogs(): Promise<boolean> {
    const res = await questionMaker(ADD_TEMP_AFTER_FEATURE_CLOSED);
    return res.choice as boolean;
  }

  private async addTempLogs(): Promise<void> {
    new LogsStasher().init();
  }

}
