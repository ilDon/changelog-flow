import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { ChangeDetails, ChangeItems } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';

export class VersionPreparator {

  private packageInfo;
  private changeDetails: ChangeDetails;

  constructor(
    private changeItems: Array<ChangeItems>
  ) { }

  public make(): ChangeDetails {
    this.getPackageInfo();
    this.setChangeDetails();
    return this.changeDetails;
  }

  private getPackageInfo(): void {
    const finalPath = join(DIRS.path, 'package.json');
    this.packageInfo = readJSONSync(finalPath);
  }

  private setChangeDetails(): void {
    this.changeDetails = {
      version: this.packageInfo.version,
      date: this.isoDate(),
      items: this.changeItems
    };
  }

  private isoDate(): string {
    const d = new Date();
    let month = `${d.getMonth() + 1}`;
    let day = `${d.getDate()}`;
    const year = d.getFullYear();

    if (month.length < 2)
      month = `0${month}`;
    if (day.length < 2)
      day = `0${day}`;

    return [year, month, day].join('-');
  }

}
