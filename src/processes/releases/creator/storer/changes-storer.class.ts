import { Storer } from 'changelog-flow/processes/common-ops/storer.class';
import { ChangeDetails } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';

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
