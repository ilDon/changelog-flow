import { FlowBase } from '@bohr/changelogger/libs/flow//flow-base.class';
import { handleUncommittedChanges } from '@bohr/changelogger/processes/common-ops/handle-uncommitted-changes.function';
import { FEATURE_NAME } from '@bohr/changelogger/questions/git/feature-name.constant';
import { questionMaker } from '@bohr/changelogger/questions/question-maker.function';
import { argv } from 'yargs';

export class NewFeatureStarter extends FlowBase {

  private featureName: string;

  public async start(): Promise<void> {
    if (!argv.sg)
      await handleUncommittedChanges();

    await this.getFeatureName();

    this.cleanFeatureName();

    this.init();

    await this.checkoutToBranch('develop');

    await this.createBranch(`feature/${this.featureName}`);

    await this.pushCurrent();
  }

  private async getFeatureName(): Promise<void> {
    const res = await questionMaker(FEATURE_NAME);
    this.featureName = res.name;
  }

  private cleanFeatureName(): void {
    this.featureName = this.removeSpecialChars(this.featureName);
    this.featureName = this.featureName.replace(/\s{1,}/g, '_');
    this.featureName = this.featureName.replace(/\.{1,}/g, '-');
    this.featureName = this.featureName.replace(/\/{1,}/g, '-');
    this.featureName = this.featureName.toLowerCase();
  }

  private removeSpecialChars(source: string): string {
    let r = source.toLowerCase();
    const non_asciis = {
      a: '[àáâãäå]',
      ae: 'æ',
      c: 'ç',
      e: '[èéêë]',
      i: '[ìíîï]',
      n: 'ñ',
      o: '[òóôõö]',
      oe: 'œ',
      u: '[ùúûűü]',
      y: '[ýÿ]'
    };
    for (const i in non_asciis)
      r = r.replace(new RegExp(non_asciis[i], 'g'), i);

    return r;
  }

}
