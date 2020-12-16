import { FeatureCloserHandler } from '@bohr/changelogger/processes/features/feature-closer-handler.class';
import { NewFeatureStarter } from '@bohr/changelogger/processes/features/new-feature.starter.class';
import { ReleaseCloser } from '@bohr/changelogger/processes/releases/closer/release-closer.class';
import { NewReleaseMaker } from '@bohr/changelogger/processes/releases/creator/new-release-maker.class';
import { LogsStasher } from '@bohr/changelogger/processes/stash-logs/logs-stasher.class';
import { questionMaker } from '@bohr/changelogger/questions/question-maker.function';
import { START_ACTION_PICKER, SupportedActions } from '@bohr/changelogger/questions/start-action-picker/start-action-picker';
import { rendererStarter } from '@bohr/changelogger/renderers/renderer-starter.function';
import { argv } from 'yargs';

export class ActionPicker {

  private actionToPerform: SupportedActions;

  public async get(): Promise<void> {
    this.getFromArgs();

    if (!this.actionToPerform)
      await this.askUser();

    this.startSelectedAction();
  }

  private getFromArgs(): void {
    if (argv.action && Object.keys(SupportedActions).includes(argv.action))
      this.actionToPerform = argv.action;
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
