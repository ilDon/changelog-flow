import { FeatureCloserHandler } from 'changelog-flow/processes/features/feature-closer-handler.class';
import { NewFeatureStarter } from 'changelog-flow/processes/features/new-feature.starter.class';
import { ReleaseCloser } from 'changelog-flow/processes/releases/closer/release-closer.class';
import { NewReleaseMaker } from 'changelog-flow/processes/releases/creator/new-release-maker.class';
import { LogsStasher } from 'changelog-flow/processes/stash-logs/logs-stasher.class';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';
import { START_ACTION_PICKER, SupportedActions } from 'changelog-flow/questions/start-action-picker/start-action-picker';
import { rendererStarter } from 'changelog-flow/renderers/renderer-starter.function';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

export class ActionPicker {

  private actionToPerform: SupportedActions;

  public async get(): Promise<void> {
    this.getFromArgs();

    if (!this.actionToPerform)
      await this.askUser();

    this.startSelectedAction();
  }

  private getFromArgs(): void {
    if (argv.action && Object.keys(SupportedActions).includes(argv.action as SupportedActions))
      this.actionToPerform = argv.action as SupportedActions;
  }

  private async askUser(): Promise<void> {
    const choice = await questionMaker([START_ACTION_PICKER]);
    this.actionToPerform = choice.action as SupportedActions;
  }

  private startSelectedAction(): void {
    switch (this.actionToPerform) {
      case SupportedActions.stash:
        new LogsStasher().init();
        break;
      case SupportedActions.newFeature:
        new NewFeatureStarter().start();
        break;
      case SupportedActions.closeFeature:
        new FeatureCloserHandler().close();
        break;
      case SupportedActions.newRelease:
        new NewReleaseMaker().init();
        break;
      case SupportedActions.closeRelease:
        new ReleaseCloser().close();
        break;
      case SupportedActions.md:
        rendererStarter(this.actionToPerform);
        break;
    }
  }

}
