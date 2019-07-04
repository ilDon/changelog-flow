import { Storer } from '@bohr/changelogger/processes/common-ops/storer.class';
import { ChangeItems } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';

export class TempStorer extends Storer {

  constructor(
    private newChanges: Array<ChangeItems>
  ) {
    super();
  }

  public store(): void {
    this.init();
    this.addTempChanges();
    this.finish();
  }

  private addTempChanges(): void {
    if (!this.changeLogger.temp)
      this.changeLogger.temp = this.newChanges;
    else
      this.newChanges.forEach(change => this.changeLogger.temp.push(change));
  }

}
