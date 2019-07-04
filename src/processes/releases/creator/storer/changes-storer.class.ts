import { Storer } from '@bohr/changelogger/processes/common-ops/storer.class';
import { ChangeDetails } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';

export class ChangesStorer extends Storer {

  constructor(
    private changeDetails: ChangeDetails
  ) {
    super();
  }

  public storeChanges(): void {
    this.init();
    this.addChangeDetails();
    this.finish();
  }

  private addChangeDetails(): void {
    this.changeLogger.changes.unshift(this.changeDetails);
  }

}
